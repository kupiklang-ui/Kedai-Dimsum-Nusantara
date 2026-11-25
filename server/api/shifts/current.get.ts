import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '../../database'
import { cashierShifts, transactions, users } from '../../database/schema'
import { ensureProductionLogsTable, isFinalizedTransaction } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'
import { getWhatsAppSettings } from '../../utils/whatsappNotify'

function getStartOfTodayWib(): Date {
  const now = new Date()
  // Format tanggal hari ini di Asia/Jakarta (UTC+7)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)
  return new Date(`${parts}T00:00:00+07:00`)
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['kasir'])
  const db = getDb()
  await ensureProductionLogsTable()

  // Cari shift yang masih open milik kasir ini
  const [openShift] = await db
    .select()
    .from(cashierShifts)
    .where(and(eq(cashierShifts.id_kasir, user.id_user), eq(cashierShifts.status, 'open')))
    .orderBy(desc(cashierShifts.id_shift))
    .limit(1)

  // Ambil 5 riwayat shift terakhir milik kasir ini
  const recentRows = await db
    .select({
      shift: cashierShifts,
      kasirNama: users.nama,
      kasirUsername: users.username
    })
    .from(cashierShifts)
    .innerJoin(users, eq(cashierShifts.id_kasir, users.id_user))
    .where(and(eq(cashierShifts.id_kasir, user.id_user), eq(cashierShifts.status, 'closed')))
    .orderBy(desc(cashierShifts.waktu_tutup))
    .limit(5)

  const startOfToday = getStartOfTodayWib()
  const latestClosedToday = recentRows[0]?.shift.waktu_tutup
    ? new Date(recentRows[0].shift.waktu_tutup)
    : null

  // Jika belum ada shift open, gunakan awal hari ini (atau waktu tutup shift sebelumnya hari ini)
  let windowStart = openShift?.waktu_buka ? new Date(openShift.waktu_buka) : startOfToday
  if (!openShift && latestClosedToday && latestClosedToday > windowStart) {
    windowStart = latestClosedToday
  }

  const now = new Date()

  // Hitung transaksi final dalam periode shift berjalan (Driver Food hanya jika sudah Diambil Driver)
  const rawTrxRows = await db
    .select({
      total_harga: transactions.total_harga,
      metode_pembayaran: transactions.metode_pembayaran,
      status_pesanan: transactions.status_pesanan
    })
    .from(transactions)
    .where(and(
      eq(transactions.id_user, user.id_user),
      gte(transactions.tanggal_transaksi, windowStart),
      lte(transactions.tanggal_transaksi, now)
    ))

  const trxRows = rawTrxRows.filter(r => isFinalizedTransaction(r.metode_pembayaran, r.status_pesanan))

  let totalQris = 0
  let totalShopeeFood = 0
  let totalGoFood = 0

  for (const row of trxRows) {
    const amount = Number(row.total_harga || 0)
    if (row.metode_pembayaran === 'QRIS') totalQris += amount
    else if (row.metode_pembayaran === 'ShopeeFood') totalShopeeFood += amount
    else if (row.metode_pembayaran === 'GoFood') totalGoFood += amount
  }

  const waSettings = await getWhatsAppSettings()

  return {
    success: true,
    hasOpenShift: Boolean(openShift),
    activeShift: {
      id_shift: openShift ? Number(openShift.id_shift) : null,
      waktu_buka: windowStart.toISOString(),
      modal_awal: openShift ? Number(openShift.modal_awal || 0) : 0,
      total_transaksi: trxRows.length,
      total_non_tunai: totalQris + totalShopeeFood + totalGoFood,
      total_qris: totalQris,
      total_shopeefood: totalShopeeFood,
      total_gofood: totalGoFood
    },
    waConfigured: Boolean(waSettings.enabled && waSettings.adminPhone),
    recentClosedShifts: recentRows.map(({ shift, kasirNama, kasirUsername }) => ({
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
      ekspektasi_kas_laci: Number(shift.ekspektasi_kas_laci || 0),
      uang_fisik_laci: shift.uang_fisik_laci !== null ? Number(shift.uang_fisik_laci) : null,
      selisih_kas: shift.selisih_kas !== null ? Number(shift.selisih_kas) : null,
      catatan: shift.catatan
    }))
  }
})
