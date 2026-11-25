import { desc, inArray, like } from 'drizzle-orm'
import { getDb } from '../../database'
import {
  DRIVER_FOOD_METHODS,
  products,
  transactionDetails,
  transactions,
  type DriverFoodMethod
} from '../../database/schema'
import { getWibCompactDate, toDecimalString } from '../../utils/datetime'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface DriverOrderItemInput {
  id_produk?: number | string
  qty?: number | string
  catatan?: string | null
}

interface CreateDriverOrderBody {
  platform?: string
  kode_order_driver?: string | null
  items?: DriverOrderItemInput[]
}

/**
 * Mencatat pesanan masuk asli dari ShopeeFood / GoFood ke antrean Driver Food (status: 'Sedang Diolah').
 * Stok dimsum & pencatatan pemasukan BELUM diproses sampai tombol 'Diambil Driver' ditekan.
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['admin', 'kasir'])
  const body = await readBody<CreateDriverOrderBody>(event)

  const platform = body?.platform?.trim() as DriverFoodMethod
  if (!DRIVER_FOOD_METHODS.includes(platform)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Platform driver tidak valid. Pilih ShopeeFood atau GoFood.'
    })
  }

  const rawItems = Array.isArray(body?.items) ? body.items : []
  if (rawItems.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pilih minimal 1 menu untuk pesanan Driver Food.'
    })
  }

  const normalizedItems = rawItems.map((item, idx) => {
    const idProduk = Number(item?.id_produk)
    const qty = Number(item?.qty)
    const catatan = item?.catatan ? String(item.catatan).trim().slice(0, 255) : null

    if (!Number.isInteger(idProduk) || idProduk <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Menu #${idx + 1} tidak valid.`
      })
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Jumlah menu #${idx + 1} minimal 1.`
      })
    }

    return { id_produk: idProduk, qty, catatan }
  })

  const kodeOrderDriver = body?.kode_order_driver
    ? String(body.kode_order_driver).trim().slice(0, 100)
    : null

  const db = getDb()
  await ensureProductionLogsTable()

  const productIds = Array.from(new Set(normalizedItems.map(i => i.id_produk)))
  const productRows = await db
    .select()
    .from(products)
    .where(inArray(products.id_produk, productIds))

  const productMap = new Map(productRows.map(p => [p.id_produk, p]))
  for (const idProduk of productIds) {
    if (!productMap.has(idProduk)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Menu dengan ID ${idProduk} tidak ditemukan.`
      })
    }
  }

  const created = await db.transaction(async (tx) => {
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
      const parsed = Number.parseInt(suffix, 10)
      if (Number.isFinite(parsed) && parsed >= 1) {
        nextSeq = parsed + 1
      }
    }

    const noFaktur = `${invoicePrefix}${String(nextSeq).padStart(3, '0')}`

    let totalHarga = 0
    const details = normalizedItems.map((it) => {
      const prod = productMap.get(it.id_produk)!
      const hargaSatuan = Number(prod.harga_jual)
      const subtotal = hargaSatuan * it.qty
      totalHarga += subtotal
      return {
        id_produk: it.id_produk,
        harga_satuan: hargaSatuan,
        qty: it.qty,
        subtotal,
        catatan: it.catatan
      }
    })

    await tx.insert(transactions).values({
      no_faktur: noFaktur,
      id_user: user.id_user,
      tanggal_transaksi: now,
      tipe_pesanan: 'Takeaway',
      nomor_meja: null,
      total_harga: toDecimalString(totalHarga),
      bayar: toDecimalString(totalHarga),
      kembalian: '0.00',
      metode_pembayaran: platform,
      status_pesanan: 'Sedang Diolah',
      kode_order_driver: kodeOrderDriver
    })

    await tx.insert(transactionDetails).values(
      details.map(d => ({
        no_faktur: noFaktur,
        id_produk: d.id_produk,
        harga_satuan: toDecimalString(d.harga_satuan),
        qty: d.qty,
        subtotal: toDecimalString(d.subtotal),
        catatan: d.catatan
      }))
    )

    return {
      no_faktur: noFaktur,
      platform,
      total_harga: totalHarga,
      status_pesanan: 'Sedang Diolah' as const
    }
  })

  setResponseStatus(event, 201)

  return {
    success: true,
    message: `Order ${platform} (${created.no_faktur}) masuk antrean Sedang Diolah. Stok & omzet baru diproses saat Diambil Driver.`,
    data: created
  }
})
