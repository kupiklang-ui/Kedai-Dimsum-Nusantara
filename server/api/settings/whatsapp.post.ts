import { requireAuth } from '../../utils/session'
import {
  normalizeIndonesianPhone,
  saveWhatsAppSettings
} from '../../utils/whatsappNotify'

interface UpdateWhatsAppBody {
  enabled?: boolean
  adminPhone?: string
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])
  const body = await readBody<UpdateWhatsAppBody>(event)

  const enabled = Boolean(body?.enabled)
  const adminPhone = normalizeIndonesianPhone(body?.adminPhone || '')

  if (enabled && (!adminPhone || adminPhone.length < 10 || adminPhone.length > 16)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nomor WhatsApp Admin tidak valid. Gunakan format 08xxx atau 628xxx (10-16 digit).'
    })
  }

  const saved = await saveWhatsAppSettings({
    enabled,
    adminPhone
  })

  return {
    success: true,
    message: 'Nomor WhatsApp Admin berhasil disimpan.',
    data: {
      enabled: saved.enabled,
      adminPhone: saved.adminPhone
    }
  }
})
