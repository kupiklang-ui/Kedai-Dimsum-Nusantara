import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '../../database'
import { cashierShifts, users } from '../../database/schema'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

function getWibTodayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])
  const query = getQuery(event)

  const mode = query.mode === 'monthly' ? 'monthly' : 'daily'
  const todayKey = getWibTodayKey()
  const dateParam = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
    ? query.date
    : todayKey
  const monthParam = typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
    ? query.month
    : todayKey.slice(0, 7)

  let startDate: Date
  let endDate: Date
  let period: string

  if (mode === 'monthly') {
    period = monthParam
    const [yearStr, monthStr] = monthParam.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const lastDay = new Date(year, month, 0).getDate()
    startDate = new Date(`${monthParam}-01T00:00:00+07:00`)
    endDate = new Date(`${monthParam}-${String(lastDay).padStart(2, '0')}T23:59:59+07:00`)
  } else {
    period = dateParam
    startDate = new Date(`${dateParam}T00:00:00+07:00`)
    endDate = new Date(`${dateParam}T23:59:59+07:00`)
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const rows = await db
    .select({
      shift: cashierShifts,
      kasirNama: users.nama,
      kasirUsername: users.username
    })
    .from(cashierShifts)
    .innerJoin(users, eq(cashierShifts.id_kasir, users.id_user))
    .where(and(
      eq(cashierShifts.status, 'closed'),
      gte(cashierShifts.waktu_tutup, startDate),
      lte(cashierShifts.waktu_tutup, endDate)
    ))
    .orderBy(desc(cashierShifts.waktu_tutup))
    .limit(200)

  let pasCount = 0
  let lebihCount = 0
  let kurangCount = 0
  let totalUangFisik = 0
  let totalEkspektasiKas = 0
  let totalSelisihBersih = 0

  const shifts = rows.map(({ shift, kasirNama, kasirUsername }) => {
    const ekspektasi = Number(shift.ekspektasi_kas_laci || 0)
    const fisik = shift.uang_fisik_laci !== null ? Number(shift.uang_fisik_laci) : 0
    const selisih = shift.selisih_kas !== null ? Number(shift.selisih_kas) : 0

    if (selisih === 0) pasCount += 1
    else if (selisih > 0) lebihCount += 1
    else kurangCount += 1

    totalUangFisik += fisik
    totalEkspektasiKas += ekspektasi
    totalSelisihBersih += selisih

    return {
      id_shift: Number(shift.id_shift),
      id_kasir: shift.id_kasir,
      kasir_nama: kasirNama,
      kasir_username: kasirUsername,
      waktu_buka: new Date(shift.waktu_buka).toISOString(),
      waktu_tutup: shift.waktu_tutup ? new Date(shift.waktu_tutup).toISOString() : null,
      status: shift.status,
      modal_awal: Number(shift.modal_awal || 0),
      total_transaksi: shift.total_transaksi,
      total_omzet: Number(shift.total_omzet || 0),
      total_tunai_sistem: Number(shift.total_tunai_sistem || 0),
      total_qris_sistem: Number(shift.total_qris_sistem || 0),
      total_shopeefood_sistem: Number(shift.total_shopeefood_sistem || 0),
      total_gofood_sistem: Number(shift.total_gofood_sistem || 0),
      ekspektasi_kas_laci: ekspektasi,
      uang_fisik_laci: shift.uang_fisik_laci !== null ? fisik : null,
      selisih_kas: shift.selisih_kas !== null ? selisih : null,
      catatan: shift.catatan
    }
  })

  return {
    success: true,
    mode,
    period,
    summary: {
      totalShifts: shifts.length,
      pasCount,
      lebihCount,
      kurangCount,
      totalUangFisik,
      totalEkspektasiKas,
      totalSelisihBersih
    },
    shifts
  }
})
