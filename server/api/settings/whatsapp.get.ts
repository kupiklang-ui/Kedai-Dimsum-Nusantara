import { requireAuth } from '../../utils/session'
import { getWhatsAppSettings } from '../../utils/whatsappNotify'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['admin', 'kasir'])
  const settings = await getWhatsAppSettings()

  const configured = Boolean(settings.adminPhone)

  if (user.role === 'kasir') {
    return {
      success: true,
      enabled: settings.enabled,
      configured
    }
  }

  return {
    success: true,
    enabled: settings.enabled,
    configured,
    adminPhone: settings.adminPhone
  }
})
