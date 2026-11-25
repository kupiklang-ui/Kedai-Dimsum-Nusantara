import { unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../../database'
import { productionLogs, products, transactionDetails } from '../../database/schema'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])

  const idParam = getRouterParam(event, 'id')
  const idProduk = Number(idParam)

  if (!Number.isInteger(idProduk) || idProduk <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID produk tidak valid.'
    })
  }

  const db = getDb()
  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id_produk, idProduk))
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Menu dimsum tidak ditemukan.'
    })
  }

  // Cek apakah menu sudah tercatat pada riwayat transaksi penjualan
  const [trxUsage] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(transactionDetails)
    .where(eq(transactionDetails.id_produk, idProduk))

  const usedInTransactions = Number(trxUsage?.count || 0)
  if (usedInTransactions > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Menu "${existing.nama_menu}" sudah tercatat di ${usedInTransactions} riwayat transaksi penjualan sehingga tidak bisa dihapus permanen. Ubah stok menjadi 0 jika menu sudah tidak dijual.`
    })
  }

  await db.transaction(async (tx) => {
    // Hapus log produksi terkait (jika ada) agar FK tidak menghalangi penghapusan menu yang belum pernah terjual
    try {
      await tx
        .delete(productionLogs)
        .where(eq(productionLogs.id_produk, idProduk))
    } catch {
      // Abaikan bila tabel production_logs belum dibuat
    }

    await tx
      .delete(products)
      .where(eq(products.id_produk, idProduk))
  })

  // Bersihkan file foto lokal jika foto berasal dari upload lokal (/api/uploads/<file>)
  if (existing.foto_url && existing.foto_url.startsWith('/api/uploads/')) {
    const fileName = basename(existing.foto_url.split('?')[0])
    if (fileName && fileName !== 'qris') {
      try {
        await unlink(join(process.cwd(), 'uploads', 'menu', fileName))
      } catch {
        // Abaikan jika file sudah tidak ada
      }
    }
  }

  return {
    success: true,
    message: `Menu "${existing.nama_menu}" berhasil dihapus.`
  }
})
