import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '../../database'
import { cashierShifts } from '../../database/schema'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface OpenShiftBody {
  modal_awal?: number | string
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['kasir'])
  const body = await readBody<OpenShiftBody>(event)

  const modalAwal = Number(body?.modal_awal ?? 0)
  if (!Number.isFinite(modalAwal) || modalAwal < 0 || modalAwal > 100_000_000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Modal awal laci harus berupa angka valid minimal Rp 0.'
    })
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const [existingOpen] = await db
    .select()
    .from(cashierShifts)
    .where(and(eq(cashierShifts.id_kasir, user.id_user), eq(cashierShifts.status, 'open')))
    .orderBy(desc(cashierShifts.id_shift))
    .limit(1)

  if (existingOpen) {
    await db
      .update(cashierShifts)
      .set({
        modal_awal: modalAwal.toFixed(2)
      })
      .where(eq(cashierShifts.id_shift, existingOpen.id_shift))

    return {
      success: true,
      message: 'Modal awal shift aktif berhasil diperbarui.',
      id_shift: Number(existingOpen.id_shift),
      modal_awal: modalAwal
    }
  }

  const now = new Date()
  const [inserted] = await db.insert(cashierShifts).values({
    id_kasir: user.id_user,
    waktu_buka: now,
    waktu_tutup: null,
    status: 'open',
    modal_awal: modalAwal.toFixed(2)
  })

  setResponseStatus(event, 201)

  return {
    success: true,
    message: 'Shift kasir berhasil dibuka.',
    id_shift: Number(inserted.insertId),
    modal_awal: modalAwal
  }
})
