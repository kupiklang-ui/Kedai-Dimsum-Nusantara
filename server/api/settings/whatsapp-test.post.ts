import { requireAuth } from '../../utils/session'
import {
  buildWaMeUrl,
  getWhatsAppSettings,
  normalizeIndonesianPhone
} from '../../utils/whatsappNotify'

interface TestWhatsAppBody {
  adminPhone?: string
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['admin'])
  const config = useRuntimeConfig()
  const body = await readBody<TestWhatsAppBody>(event).catch(() => ({} as TestWhatsAppBody))

  const stored = await getWhatsAppSettings()
  const adminPhone = normalizeIndonesianPhone(body?.adminPhone || stored.adminPhone)

  if (!adminPhone || adminPhone.length < 10) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Isi Nomor WhatsApp Admin terlebih dahulu (cth: 081234567890).'
    })
  }

  const storeName = config.public.storeName || 'Kedai Dimsum Nusantara'
  const testMessage = [
    `✅ *TES NOTIFIKASI WHATSAPP*`,
    `*${storeName}*`,
    '',
    `Halo Admin (${user.nama}), nomor WhatsApp ini sudah terhubung untuk menerima laporan pengajuan stok dimsum dari Kasir!`
  ].join('\n')

  return {
    success: true,
    waUrl: buildWaMeUrl(adminPhone, testMessage)
  }
})
