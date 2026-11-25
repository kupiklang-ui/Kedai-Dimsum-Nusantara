import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { getDb } from '../../../database'
import {
  dimsumStock,
  DRIVER_FOOD_METHODS,
  DRIVER_ORDER_STATUSES,
  products,
  transactionDetails,
  transactions,
  type DriverOrderStatus
} from '../../../database/schema'
import { ensureProductionLogsTable, isSharedDimsumCategory } from '../../../utils/ensureProductionTable'
import { requireAuth } from '../../../utils/session'

interface UpdateStatusBody {
  status_pesanan?: string
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin', 'kasir'])

  const faktur = getRouterParam(event, 'faktur')
  if (!faktur) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nomor faktur tidak valid.'
    })
  }

  const body = await readBody<UpdateStatusBody>(event)
  const nextStatus = body?.status_pesanan?.trim() as DriverOrderStatus

  if (!DRIVER_ORDER_STATUSES.includes(nextStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Status tidak valid. Pilihan: ${DRIVER_ORDER_STATUSES.join(', ')}`
    })
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        no_faktur: transactions.no_faktur,
        metode_pembayaran: transactions.metode_pembayaran,
        status_pesanan: transactions.status_pesanan,
        total_harga: transactions.total_harga
      })
      .from(transactions)
      .where(eq(transactions.no_faktur, faktur))
      .for('update')
      .limit(1)

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: `Pesanan ${faktur} tidak ditemukan.`
      })
    }

    if (!DRIVER_FOOD_METHODS.includes(existing.metode_pembayaran as (typeof DRIVER_FOOD_METHODS)[number])) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Status pengolahan driver hanya berlaku untuk pesanan ShopeeFood dan GoFood.'
      })
    }

    if (existing.status_pesanan === 'Diambil Driver' && nextStatus !== 'Diambil Driver') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Pesanan yang sudah Diambil Driver sudah final (stok sudah dipotong & pemasukan tercatat), tidak bisa diubah kembali.'
      })
    }

    if (existing.status_pesanan === nextStatus) {
      return {
        finalizedNow: false,
        deductedDimsumPcs: 0,
        totalHarga: Number(existing.total_harga)
      }
    }

    // Jika belum Diambil Driver, cukup perbarui status antrean (belum potong stok & belum hitung omzet)
    if (nextStatus !== 'Diambil Driver') {
      await tx
        .update(transactions)
        .set({ status_pesanan: nextStatus })
        .where(eq(transactions.no_faktur, faktur))

      return {
        finalizedNow: false,
        deductedDimsumPcs: 0,
        totalHarga: Number(existing.total_harga)
      }
    }

    // FINALISASI: Saat tombol 'Diambil Driver' ditekan -> POTONG STOK ATOMIK + CATAT PEMASUKAN!
    const detailRows = await tx
      .select({
        id_produk: transactionDetails.id_produk,
        qty: transactionDetails.qty
      })
      .from(transactionDetails)
      .where(eq(transactionDetails.no_faktur, faktur))

    const qtyByProduct = new Map<number, number>()
    for (const d of detailRows) {
      qtyByProduct.set(d.id_produk, (qtyByProduct.get(d.id_produk) || 0) + d.qty)
    }

    const productIds = Array.from(qtyByProduct.keys())
    let totalDimsumPcsNeeded = 0
    const separateStockNeeded = new Map<number, number>()

    if (productIds.length > 0) {
      const lockedProducts = await tx
        .select()
        .from(products)
        .where(inArray(products.id_produk, productIds))
        .for('update')

      const productMap = new Map(lockedProducts.map(p => [p.id_produk, p]))

      for (const [idProduk, qtyTotal] of qtyByProduct.entries()) {
        const prod = productMap.get(idProduk)
        if (!prod) continue

        if (isSharedDimsumCategory(prod.kategori)) {
          totalDimsumPcsNeeded += qtyTotal * Math.max(1, prod.isi_pcs || 1)
        } else {
          separateStockNeeded.set(idProduk, qtyTotal)
        }
      }

      // Validasi & potong stok dimsum produksi bersama (Pcs)
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
            statusMessage: `Stok dimsum tidak mencukupi untuk menyelesaikan order driver ini: butuh ${totalDimsumPcsNeeded} pcs, sisa stok tinggal ${availablePcs} pcs. Tambahkan stok produksi terlebih dahulu.`
          })
        }

        const [deductShared] = await tx
          .update(dimsumStock)
          .set({
            stok_pcs: sql`${dimsumStock.stok_pcs} - ${totalDimsumPcsNeeded}`
          })
          .where(and(
            eq(dimsumStock.id, 1),
            gte(dimsumStock.stok_pcs, totalDimsumPcsNeeded)
          ))

        if (deductShared.affectedRows !== 1) {
          throw createError({
            statusCode: 409,
            statusMessage: 'Gagal memotong stok produksi dimsum secara atomik. Coba ulangi.'
          })
        }
      }

      // Validasi & potong stok terpisah (Minuman & Saus)
      for (const [idProduk, qtyKeluar] of separateStockNeeded.entries()) {
        const prod = productMap.get(idProduk)!
        if (prod.stok < qtyKeluar) {
          throw createError({
            statusCode: 400,
            statusMessage: `Stok ${prod.nama_menu} kurang: dibutuhkan ${qtyKeluar} ${prod.satuan}, tersisa ${prod.stok}.`
          })
        }

        const [updateRes] = await tx
          .update(products)
          .set({
            stok: sql`${products.stok} - ${qtyKeluar}`
          })
          .where(and(
            eq(products.id_produk, idProduk),
            gte(products.stok, qtyKeluar)
          ))

        if (updateRes.affectedRows !== 1) {
          throw createError({
            statusCode: 409,
            statusMessage: `Gagal memotong stok ${prod.nama_menu}. Coba ulangi.`
          })
        }
      }
    }

    // Tandai Diambil Driver & perbarui waktu transaksi ke momen serah terima agar masuk shift/laporan aktif
    await tx
      .update(transactions)
      .set({
        status_pesanan: 'Diambil Driver',
        tanggal_transaksi: new Date()
      })
      .where(eq(transactions.no_faktur, faktur))

    return {
      finalizedNow: true,
      deductedDimsumPcs: totalDimsumPcsNeeded,
      totalHarga: Number(existing.total_harga)
    }
  })

  const message = result.finalizedNow
    ? `Pesanan ${faktur} Diambil Driver! Stok berkurang ${result.deductedDimsumPcs} pcs & pemasukan Rp ${Math.round(result.totalHarga).toLocaleString('id-ID')} resmi tercatat.`
    : `Pesanan ${faktur} diperbarui menjadi "${nextStatus}" (belum potong stok sampai Diambil Driver).`

  return {
    success: true,
    message,
    data: {
      no_faktur: faktur,
      status_pesanan: nextStatus,
      finalized_now: result.finalizedNow,
      deducted_dimsum_pcs: result.deductedDimsumPcs,
      total_harga: result.totalHarga
    }
  }
})
