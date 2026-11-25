import { and, inArray, like } from 'drizzle-orm'
import { getDb } from '../../database'
import { DRIVER_FOOD_METHODS, transactions } from '../../database/schema'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin', 'kasir'])

  const db = getDb()
  await ensureProductionLogsTable()

  const [result] = await db
    .delete(transactions)
    .where(and(
      inArray(transactions.metode_pembayaran, [...DRIVER_FOOD_METHODS]),
      like(transactions.kode_order_driver, '%(Demo)%')
    ))

  const deletedCount = result?.affectedRows ?? 0

  return {
    success: true,
    deletedCount,
    message: deletedCount > 0
      ? `${deletedCount} pesanan demo Driver Food berhasil dibersihkan (transaksi asli tetap aman).`
      : 'Tidak ada pesanan demo Driver Food yang perlu dibersihkan.'
  }
})
