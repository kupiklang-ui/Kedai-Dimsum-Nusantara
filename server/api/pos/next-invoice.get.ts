import { desc, like } from 'drizzle-orm'
import { getDb } from '../../database'
import { transactions } from '../../database/schema'
import { getWibCompactDate } from '../../utils/datetime'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['kasir'])

  const db = getDb()
  const datePart = getWibCompactDate(new Date())
  const invoicePrefix = `INV-${datePart}-`

  const [latestInvoice] = await db
    .select({ no_faktur: transactions.no_faktur })
    .from(transactions)
    .where(like(transactions.no_faktur, `${invoicePrefix}%`))
    .orderBy(desc(transactions.no_faktur))
    .limit(1)

  let nextSeq = 1
  if (latestInvoice?.no_faktur) {
    const suffix = latestInvoice.no_faktur.slice(invoicePrefix.length)
    const parsedSeq = Number.parseInt(suffix, 10)
    if (Number.isFinite(parsedSeq) && parsedSeq >= 1) {
      nextSeq = parsedSeq + 1
    }
  }

  return {
    success: true,
    no_faktur: `${invoicePrefix}${String(nextSeq).padStart(3, '0')}`
  }
})
