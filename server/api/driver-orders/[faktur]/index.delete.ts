import { eq } from 'drizzle-orm'
import { getDb } from '../../../database'
import { DRIVER_FOOD_METHODS, transactions } from '../../../database/schema'
import { ensureProductionLogsTable } from '../../../utils/ensureProductionTable'
import { requireAuth } from '../../../utils/session'

/**
 * Membatalkan pesanan Driver Food yang BELUM diambil driver.
 * Karena stok & pemasukan belum dipotong, pembatalan langsung menghapus antrean dengan aman.
 */
export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin', 'kasir'])

  const faktur = getRouterParam(event, 'faktur')
  if (!faktur) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nomor faktur tidak valid.'
    })
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const [existing] = await db
    .select({
      no_faktur: transactions.no_faktur,
      metode_pembayaran: transactions.metode_pembayaran,
      status_pesanan: transactions.status_pesanan
    })
    .from(transactions)
    .where(eq(transactions.no_faktur, faktur))
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
      statusMessage: 'Pembatalan antrean hanya berlaku untuk pesanan ShopeeFood dan GoFood.'
    })
  }

  if (existing.status_pesanan === 'Diambil Driver') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pesanan yang sudah Diambil Driver tidak dapat dibatalkan karena stok dan pemasukan sudah tercatat.'
    })
  }

  await db
    .delete(transactions)
    .where(eq(transactions.no_faktur, faktur))

  return {
    success: true,
    message: `Pesanan driver ${faktur} berhasil dibatalkan (stok & omzet tetap aman tidak berkurang).`
  }
})
