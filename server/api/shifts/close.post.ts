import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '../../database'
import { cashierShifts, transactions } from '../../database/schema'
import { ensureProductionLogsTable, isFinalizedTransaction } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'
import {
  buildShiftClosingWhatsAppMessage,
  prepareWhatsAppLink
} from '../../utils/whatsappNotify'

interface CloseShiftBody {
  uang_fisik_laci?: number | string
  modal_awal?: number | string
  catatan?: string | null
}

function getStartOfTodayWib(): Date {
  const now = new Date()
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
  const config = useRuntimeConfig()
  const body = await readBody<CloseShiftBody>(event)

  const uangFisik = Number(body?.uang_fisik_laci)
  if (!Number.isFinite(uangFisik) || uangFisik < 0 || uangFisik > 500_000_000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Uang tunai fisik di laci wajib diisi dengan angka valid (minimal Rp 0).'
    })
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const [openShift] = await db
    .select()
    .from(cashierShifts)
    .where(and(eq(cashierShifts.id_kasir, user.id_user), eq(cashierShifts.status, 'open')))
    .orderBy(desc(cashierShifts.id_shift))
    .limit(1)

  const [lastClosed] = await db
    .select()
    .from(cashierShifts)
    .where(and(eq(cashierShifts.id_kasir, user.id_user), eq(cashierShifts.status, 'closed')))
    .orderBy(desc(cashierShifts.waktu_tutup))
    .limit(1)

  const now = new Date()
  let waktuBuka = openShift?.waktu_buka ? new Date(openShift.waktu_buka) : getStartOfTodayWib()
  if (!openShift && lastClosed?.waktu_tutup) {
    const lastCloseDate = new Date(lastClosed.waktu_tutup)
    if (lastCloseDate > waktuBuka) {
      waktuBuka = lastCloseDate
    }
  }

  const modalAwal = body?.modal_awal !== undefined && body?.modal_awal !== ''
    ? Math.max(0, Number(body.modal_awal) || 0)
    : (openShift ? Number(openShift.modal_awal || 0) : 0)

  const catatan = body?.catatan ? String(body.catatan).trim().slice(0, 255) : null

  // Hitung total akurat hanya dari transaksi final (Driver Food wajib sudah Diambil Driver)
  const rawTrxRows = await db
    .select({
      total_harga: transactions.total_harga,
      metode_pembayaran: transactions.metode_pembayaran,
      status_pesanan: transactions.status_pesanan
    })
    .from(transactions)
    .where(and(
      eq(transactions.id_user, user.id_user),
      gte(transactions.tanggal_transaksi, waktuBuka),
      lte(transactions.tanggal_transaksi, now)
    ))

  const trxRows = rawTrxRows.filter(r => isFinalizedTransaction(r.metode_pembayaran, r.status_pesanan))

  let totalTunai = 0
  let totalQris = 0
  let totalShopeeFood = 0
  let totalGoFood = 0

  for (const row of trxRows) {
    const amount = Number(row.total_harga || 0)
    if (row.metode_pembayaran === 'Tunai') totalTunai += amount
    else if (row.metode_pembayaran === 'QRIS') totalQris += amount
    else if (row.metode_pembayaran === 'ShopeeFood') totalShopeeFood += amount
    else if (row.metode_pembayaran === 'GoFood') totalGoFood += amount
  }

  const totalTransaksi = trxRows.length
  const totalOmzet = totalTunai + totalQris + totalShopeeFood + totalGoFood
  const ekspektasiKasLaci = modalAwal + totalTunai
  const selisihKas = uangFisik - ekspektasiKasLaci

  let shiftId: number

  if (openShift) {
    shiftId = Number(openShift.id_shift)
    await db
      .update(cashierShifts)
      .set({
        waktu_tutup: now,
        status: 'closed',
        modal_awal: modalAwal.toFixed(2),
        total_transaksi: totalTransaksi,
        total_omzet: totalOmzet.toFixed(2),
        total_tunai_sistem: totalTunai.toFixed(2),
        total_qris_sistem: totalQris.toFixed(2),
        total_shopeefood_sistem: totalShopeeFood.toFixed(2),
        total_gofood_sistem: totalGoFood.toFixed(2),
        ekspektasi_kas_laci: ekspektasiKasLaci.toFixed(2),
        uang_fisik_laci: uangFisik.toFixed(2),
        selisih_kas: selisihKas.toFixed(2),
        catatan
      })
      .where(eq(cashierShifts.id_shift, openShift.id_shift))
  } else {
    const [inserted] = await db.insert(cashierShifts).values({
      id_kasir: user.id_user,
      waktu_buka: waktuBuka,
      waktu_tutup: now,
      status: 'closed',
      modal_awal: modalAwal.toFixed(2),
      total_transaksi: totalTransaksi,
      total_omzet: totalOmzet.toFixed(2),
      total_tunai_sistem: totalTunai.toFixed(2),
      total_qris_sistem: totalQris.toFixed(2),
      total_shopeefood_sistem: totalShopeeFood.toFixed(2),
      total_gofood_sistem: totalGoFood.toFixed(2),
      ekspektasi_kas_laci: ekspektasiKasLaci.toFixed(2),
      uang_fisik_laci: uangFisik.toFixed(2),
      selisih_kas: selisihKas.toFixed(2),
      catatan
    })
    shiftId = Number(inserted.insertId)
  }

  const storeName = config.public.storeName || 'Kedai Dimsum Nusantara'
  const waMessage = buildShiftClosingWhatsAppMessage({
    storeName,
    idShift: shiftId,
    namaKasir: user.nama,
    waktuBuka,
    waktuTutup: now,
    modalAwal,
    totalTransaksi,
    totalOmzet,
    totalTunai,
    totalQris,
    totalShopeeFood,
    totalGoFood,
    ekspektasiKasLaci,
    uangFisikLaci: uangFisik,
    selisihKas,
    catatan
  })

  const whatsapp = await prepareWhatsAppLink({
    message: waMessage
  })

  return {
    success: true,
    message: selisihKas === 0
      ? 'Shift berhasil ditutup — Uang laci PAS (Rp 0 selisih)!'
      : selisihKas > 0
        ? `Shift ditutup dengan selisih LEBIH +Rp ${Math.round(selisihKas).toLocaleString('id-ID')}.`
        : `Shift ditutup dengan selisih KURANG -Rp ${Math.round(Math.abs(selisihKas)).toLocaleString('id-ID')}.`,
    shift: {
      id_shift: shiftId,
      id_kasir: user.id_user,
      kasir_nama: user.nama,
      kasir_username: user.username,
      waktu_buka: waktuBuka.toISOString(),
      waktu_tutup: now.toISOString(),
      status: 'closed' as const,
      modal_awal: modalAwal,
      total_transaksi: totalTransaksi,
      total_omzet: totalOmzet,
      total_tunai_sistem: totalTunai,
      total_qris_sistem: totalQris,
      total_shopeefood_sistem: totalShopeeFood,
      total_gofood_sistem: totalGoFood,
      ekspektasi_kas_laci: ekspektasiKasLaci,
      uang_fisik_laci: uangFisik,
      selisih_kas: selisihKas,
      catatan
    },
    whatsapp: {
      configured: whatsapp.configured,
      enabled: whatsapp.enabled,
      waUrl: whatsapp.waUrl
    }
  }
})
