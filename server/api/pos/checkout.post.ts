import { and, desc, eq, gte, inArray, like, sql } from 'drizzle-orm'
import { getDb } from '../../database'
import {
  dimsumStock,
  products,
  transactionDetails,
  transactions,
  type OrderType,
  type PaymentMethod
} from '../../database/schema'
import { getWibCompactDate, toDecimalString } from '../../utils/datetime'
import { ensureProductionLogsTable, isSharedDimsumCategory } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface CheckoutItemInput {
  id_produk?: number | string
  qty?: number | string
  catatan?: string | null
}

interface CheckoutBody {
  tipe_pesanan?: string
  nomor_meja?: string | null
  metode_pembayaran?: string
  kode_order_driver?: string | null
  bayar?: number | string
  items?: CheckoutItemInput[]
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['kasir'])
  const body = await readBody<CheckoutBody>(event)

  const tipePesanan: OrderType = 'Takeaway'
  const metodePembayaran = body?.metode_pembayaran?.trim() as PaymentMethod
  const nomorMeja = null
  const kodeOrderDriver = null
  const initialDriverStatus = null
  const rawItems = Array.isArray(body?.items) ? body.items : []

  if (metodePembayaran !== 'Tunai' && metodePembayaran !== 'QRIS') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pembayaran kasir langsung hanya mendukung Tunai atau QRIS. Pesanan ShopeeFood & GoFood diproses lewat menu Driver Food.'
    })
  }

  if (rawItems.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Keranjang pesanan tidak boleh kosong.'
    })
  }

  const normalizedItems = rawItems.map((item, idx) => {
    const idProduk = Number(item?.id_produk)
    const qty = Number(item?.qty)
    const catatan = item?.catatan ? String(item.catatan).trim().slice(0, 255) : null

    if (!Number.isInteger(idProduk) || idProduk <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Item #${idx + 1} memiliki ID produk tidak valid.`
      })
    }

    if (!Number.isInteger(qty) || qty <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Item #${idx + 1} harus memiliki kuantitas minimal 1.`
      })
    }

    return {
      id_produk: idProduk,
      qty,
      catatan: catatan || null
    }
  })

  const requestedQtyByProduct = new Map<number, number>()
  for (const item of normalizedItems) {
    requestedQtyByProduct.set(
      item.id_produk,
      (requestedQtyByProduct.get(item.id_produk) || 0) + item.qty
    )
  }

  const productIds = Array.from(requestedQtyByProduct.keys())
  const db = getDb()
  await ensureProductionLogsTable()

  const receipt = await db.transaction(async (tx) => {
    // 1. Kunci baris produk yang terlibat
    const lockedProducts = await tx
      .select()
      .from(products)
      .where(inArray(products.id_produk, productIds))
      .for('update')

    const productMap = new Map(lockedProducts.map(p => [p.id_produk, p]))

    // 2. Pisahkan kebutuhan stok bersama (dimsum pcs) vs stok terpisah (Minuman & Saus)
    let totalDimsumPcsNeeded = 0
    const separateStockNeeded = new Map<number, number>()

    for (const [idProduk, totalQty] of requestedQtyByProduct.entries()) {
      const product = productMap.get(idProduk)
      if (!product) {
        throw createError({
          statusCode: 404,
          statusMessage: `Produk dengan ID ${idProduk} tidak ditemukan.`
        })
      }

      if (isSharedDimsumCategory(product.kategori)) {
        const pcsPerUnit = Math.max(1, product.isi_pcs || 1)
        totalDimsumPcsNeeded += totalQty * pcsPerUnit
      } else {
        separateStockNeeded.set(idProduk, totalQty)
      }
    }

    // 3. Validasi ketersediaan stok dimsum produksi bersama (FOR UPDATE pada dimsum_stock id = 1)
    if (totalDimsumPcsNeeded > 0) {
      const [lockedShared] = await tx
        .select()
        .from(dimsumStock)
        .where(eq(dimsumStock.id, 1))
        .for('update')
        .limit(1)

      const availablePcs = lockedShared?.stok_pcs ?? 0
      if (availablePcs < totalDimsumPcsNeeded) {
        throw createError({
          statusCode: 400,
          statusMessage: `Stok produksi dimsum tidak mencukupi: dibutuhkan ${totalDimsumPcsNeeded} pcs, sisa stok produksi tinggal ${availablePcs} pcs.`
        })
      }
    }

    // 4. Validasi ketersediaan stok terpisah (khusus Minuman & Saus)
    const separateErrors: string[] = []
    for (const [idProduk, qtyNeeded] of separateStockNeeded.entries()) {
      const product = productMap.get(idProduk)!
      if (product.stok < qtyNeeded) {
        separateErrors.push(`${product.nama_menu} (diminta: ${qtyNeeded}, sisa: ${product.stok} ${product.satuan})`)
      }
    }

    if (separateErrors.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Stok tidak mencukupi: ${separateErrors.join('; ')}`
      })
    }

    // 5. Hitung subtotal & grand total secara otoritatif di server
    let totalHarga = 0
    const preparedDetails = normalizedItems.map((item) => {
      const product = productMap.get(item.id_produk)!
      const hargaSatuan = Number(product.harga_jual)
      const subtotal = hargaSatuan * item.qty
      totalHarga += subtotal

      return {
        id_produk: item.id_produk,
        nama_menu: product.nama_menu,
        kode_barang: product.kode_barang,
        satuan: product.satuan,
        harga_satuan: hargaSatuan,
        qty: item.qty,
        subtotal,
        catatan: item.catatan
      }
    })

    // 6. Validasi pembayaran & hitung kembalian
    let bayar: number
    let kembalian: number

    if (metodePembayaran === 'QRIS') {
      bayar = totalHarga
      kembalian = 0
    } else {
      bayar = Number(body?.bayar)
      if (!Number.isFinite(bayar) || bayar < totalHarga) {
        throw createError({
          statusCode: 400,
          statusMessage: `Nominal pembayaran tunai (Rp ${Number.isFinite(bayar) ? bayar.toLocaleString('id-ID') : 0}) kurang dari total belanja (Rp ${totalHarga.toLocaleString('id-ID')}).`
        })
      }
      kembalian = bayar - totalHarga
    }

    // 7. Generate nomor faktur unik (INV-YYYYMMDD-XXX)
    const now = new Date()
    const datePart = getWibCompactDate(now)
    const invoicePrefix = `INV-${datePart}-`

    const [latestInvoice] = await tx
      .select({ no_faktur: transactions.no_faktur })
      .from(transactions)
      .where(like(transactions.no_faktur, `${invoicePrefix}%`))
      .orderBy(desc(transactions.no_faktur))
      .limit(1)
      .for('update')

    let nextSeq = 1
    if (latestInvoice?.no_faktur) {
      const suffix = latestInvoice.no_faktur.slice(invoicePrefix.length)
      const parsedSeq = Number.parseInt(suffix, 10)
      if (Number.isFinite(parsedSeq) && parsedSeq >= 1) {
        nextSeq = parsedSeq + 1
      }
    }

    const noFaktur = `${invoicePrefix}${String(nextSeq).padStart(3, '0')}`

    // 8. Simpan header & rincian transaksi
    await tx.insert(transactions).values({
      no_faktur: noFaktur,
      id_user: user.id_user,
      tanggal_transaksi: now,
      tipe_pesanan: tipePesanan,
      nomor_meja: nomorMeja,
      total_harga: toDecimalString(totalHarga),
      bayar: toDecimalString(bayar),
      kembalian: toDecimalString(kembalian),
      metode_pembayaran: metodePembayaran,
      status_pesanan: initialDriverStatus,
      kode_order_driver: kodeOrderDriver
    })

    await tx.insert(transactionDetails).values(
      preparedDetails.map(detail => ({
        no_faktur: noFaktur,
        id_produk: detail.id_produk,
        harga_satuan: toDecimalString(detail.harga_satuan),
        qty: detail.qty,
        subtotal: toDecimalString(detail.subtotal),
        catatan: detail.catatan
      }))
    )

    // 9. Kurangi stok dimsum produksi bersama secara atomik
    if (totalDimsumPcsNeeded > 0) {
      const [deductShared] = await tx
        .update(dimsumStock)
        .set({
          stok_pcs: sql`${dimsumStock.stok_pcs} - ${totalDimsumPcsNeeded}`
        })
        .where(
          and(
            eq(dimsumStock.id, 1),
            gte(dimsumStock.stok_pcs, totalDimsumPcsNeeded)
          )
        )

      if (deductShared.affectedRows !== 1) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Gagal memotong stok produksi dimsum bersama. Transaksi dibatalkan.'
        })
      }
    }

    // 10. Kurangi stok terpisah (Minuman & Saus) secara atomik
    for (const [idProduk, qtyKeluar] of separateStockNeeded.entries()) {
      const [updateResult] = await tx
        .update(products)
        .set({
          stok: sql`${products.stok} - ${qtyKeluar}`
        })
        .where(
          and(
            eq(products.id_produk, idProduk),
            gte(products.stok, qtyKeluar)
          )
        )

      if (updateResult.affectedRows !== 1) {
        const product = productMap.get(idProduk)
        throw createError({
          statusCode: 409,
          statusMessage: `Gagal mengurangi stok untuk ${product?.nama_menu || `ID ${idProduk}`}. Transaksi dibatalkan.`
        })
      }
    }

    return {
      no_faktur: noFaktur,
      tanggal_transaksi: now.toISOString(),
      kasir: {
        id_user: user.id_user,
        nama: user.nama,
        username: user.username
      },
      tipe_pesanan: tipePesanan,
      nomor_meja: nomorMeja,
      metode_pembayaran: metodePembayaran,
      status_pesanan: initialDriverStatus,
      kode_order_driver: kodeOrderDriver,
      total_harga: totalHarga,
      bayar,
      kembalian,
      items: preparedDetails
    }
  })

  setResponseStatus(event, 201)

  return {
    success: true,
    message: `Transaksi ${receipt.no_faktur} berhasil disimpan.`,
    data: receipt
  }
})
