import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from '../database'

export interface WhatsAppSettings {
  enabled: boolean
  adminPhone: string
}

export interface WhatsAppDispatchResult {
  configured: boolean
  enabled: boolean
  waUrl: string | null
  messagePreview: string
}

let settingsTableReady = false

async function ensureStoreSettingsTable(): Promise<void> {
  if (settingsTableReady) {
    return
  }

  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`store_settings\` (
      \`setting_key\` varchar(80) NOT NULL,
      \`setting_value\` text NULL,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`store_settings_pk\` PRIMARY KEY(\`setting_key\`)
    );
  `)
  settingsTableReady = true
}

export function normalizeIndonesianPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D+/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`
  }
  if (digits.startsWith('8')) {
    return `62${digits}`
  }
  return digits
}

export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  await ensureStoreSettingsTable()
  const pool = getPool()

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT setting_key, setting_value
    FROM store_settings
    WHERE setting_key IN ('wa_enabled', 'wa_admin_phone')
  `)

  const map = new Map<string, string>()
  if (Array.isArray(rows)) {
    for (const row of rows) {
      map.set(String(row.setting_key), String(row.setting_value ?? ''))
    }
  }

  const envPhone = normalizeIndonesianPhone(process.env.WA_ADMIN_PHONE || '')
  const adminPhone = normalizeIndonesianPhone(map.get('wa_admin_phone') || envPhone)

  const rawEnabled = map.get('wa_enabled')
  const enabled = rawEnabled !== undefined
    ? rawEnabled === 'true'
    : Boolean(adminPhone)

  return {
    enabled,
    adminPhone
  }
}

export async function saveWhatsAppSettings(input: {
  enabled: boolean
  adminPhone: string
}): Promise<WhatsAppSettings> {
  await ensureStoreSettingsTable()

  const normalizedPhone = normalizeIndonesianPhone(input.adminPhone)
  const entries: Array<[string, string]> = [
    ['wa_enabled', input.enabled ? 'true' : 'false'],
    ['wa_admin_phone', normalizedPhone]
  ]

  const pool = getPool()
  for (const [key, val] of entries) {
    await pool.query(
      `INSERT INTO store_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, val]
    )
  }

  return getWhatsAppSettings()
}

export function buildWaMeUrl(phone: string, message: string): string | null {
  const clean = normalizeIndonesianPhone(phone)
  if (!clean) return null
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

function formatWibNow(date: Date): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date) + ' WIB'
  } catch {
    return date.toISOString()
  }
}

export function buildStockRequestWhatsAppMessage(params: {
  storeName: string
  idRequest: number
  namaKasir: string
  stokSaatLapor: number
  qtyDiminta: number
  catatanKasir: string
  createdAt: Date
}): string {
  const statusStok = params.stokSaatLapor <= 0
    ? 'HABIS (0 pcs)'
    : `MENIPIS (${params.stokSaatLapor} pcs)`

  return [
    `🚨 *PENGAJUAN PASOKAN DIMSUM*`,
    `*${params.storeName}*`,
    '',
    `• No. Pengajuan: *#${params.idRequest}*`,
    `• Status Stok Kasir: *${statusStok}*`,
    `• Jumlah Diajukan: *+${params.qtyDiminta} pcs*`,
    `• Pelapor (Kasir): *${params.namaKasir}*`,
    `• Waktu Lapor: ${formatWibNow(params.createdAt)}`,
    `• Catatan: _${params.catatanKasir}_`,
    '',
    `Mohon segera diproduksi dan konfirmasi pengiriman stok di menu *Produksi Harian* Admin.`
  ].join('\n')
}

export function buildShiftClosingWhatsAppMessage(params: {
  storeName: string
  idShift: number
  namaKasir: string
  waktuBuka: Date
  waktuTutup: Date
  modalAwal: number
  totalTransaksi: number
  totalOmzet: number
  totalTunai: number
  totalQris: number
  totalShopeeFood: number
  totalGoFood: number
  ekspektasiKasLaci: number
  uangFisikLaci: number
  selisihKas: number
  catatan: string | null
}): string {
  const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`
  const selisihLabel =
    params.selisihKas === 0
      ? 'PAS (Rp 0) ✅'
      : params.selisihKas > 0
        ? `LEBIH +${rp(params.selisihKas)} ℹ️`
        : `KURANG -${rp(Math.abs(params.selisihKas))} ⚠️`

  const lines = [
    `📊 *LAPORAN TUTUP KASIR (CLOSING)*`,
    `*${params.storeName}*`,
    '',
    `• Shift: *#${params.idShift}*`,
    `• Kasir: *${params.namaKasir}*`,
    `• Waktu: ${formatWibNow(params.waktuBuka)} s/d ${formatWibNow(params.waktuTutup)}`,
    `• Total Transaksi: *${params.totalTransaksi} order*`,
    '',
    `*REKAP KAS LACI (TUNAI)*`,
    `• Modal Awal Laci: ${rp(params.modalAwal)}`,
    `• Penjualan Tunai: ${rp(params.totalTunai)}`,
    `• Target Kas Laci: *${rp(params.ekspektasiKasLaci)}*`,
    `• Uang Fisik Laci: *${rp(params.uangFisikLaci)}*`,
    `• Status Selisih: *${selisihLabel}*`,
    '',
    `*NON-TUNAI & OMZET*`,
    `• QRIS: ${rp(params.totalQris)}`,
    `• ShopeeFood: ${rp(params.totalShopeeFood)}`,
    `• GoFood: ${rp(params.totalGoFood)}`,
    `• Total Omzet Shift: *${rp(params.totalOmzet)}*`
  ]

  if (params.catatan) {
    lines.push('', `• Catatan Kasir: _${params.catatan}_`)
  }

  return lines.join('\n')
}

export async function prepareWhatsAppLink(params: {
  message: string
  overrideSettings?: WhatsAppSettings
}): Promise<WhatsAppDispatchResult> {
  const settings = params.overrideSettings ?? await getWhatsAppSettings()
  const configured = Boolean(settings.adminPhone)
  const waUrl = (configured && settings.enabled)
    ? buildWaMeUrl(settings.adminPhone, params.message)
    : null

  return {
    configured,
    enabled: settings.enabled,
    waUrl,
    messagePreview: params.message
  }
}
