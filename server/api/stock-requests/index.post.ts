import { eq } from 'drizzle-orm'
import { getDb } from '../../database'
import { dimsumStock, stockRequests } from '../../database/schema'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'
import {
  buildStockRequestWhatsAppMessage,
  prepareWhatsAppLink
} from '../../utils/whatsappNotify'

interface CreateStockRequestBody {
  qty_diminta?: number | string
  catatan_kasir?: string | null
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['kasir'])
  const config = useRuntimeConfig()
  const body = await readBody<CreateStockRequestBody>(event)

  const qtyDiminta = Number(body?.qty_diminta)
  if (!Number.isInteger(qtyDiminta) || qtyDiminta <= 0 || qtyDiminta > 10000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Jumlah pengajuan dimsum harus bilangan bulat antara 1 sampai 10.000 pcs.'
    })
  }

  const catatanKasir = body?.catatan_kasir ? String(body.catatan_kasir).trim().slice(0, 255) : null

  const db = getDb()
  await ensureProductionLogsTable()

  const [stockRow] = await db
    .select()
    .from(dimsumStock)
    .where(eq(dimsumStock.id, 1))
    .limit(1)

  const currentStok = stockRow?.stok_pcs ?? 0
  const now = new Date()
  const finalNote = catatanKasir || (
    currentStok <= 0
      ? 'Stok dimsum di kasir sudah habis, mohon segera diproduksi.'
      : 'Stok dimsum menipis, mohon tambahan pasokan.'
  )

  const [insertResult] = await db.insert(stockRequests).values({
    id_kasir: user.id_user,
    id_admin: null,
    stok_saat_lapor: currentStok,
    qty_diminta: qtyDiminta,
    qty_dikirim: null,
    status: 'Menunggu Admin',
    catatan_kasir: finalNote,
    catatan_admin: null,
    created_at: now
  })

  const idRequest = Number(insertResult.insertId)
  const storeName = config.public.storeName || 'Kedai Dimsum Nusantara'
  const waMessage = buildStockRequestWhatsAppMessage({
    storeName,
    idRequest,
    namaKasir: user.nama,
    stokSaatLapor: currentStok,
    qtyDiminta,
    catatanKasir: finalNote,
    createdAt: now
  })

  // Siapkan link WhatsApp manual (wa.me) untuk langsung kirim laporan ke WA Admin
  const whatsapp = await prepareWhatsAppLink({
    message: waMessage
  })

  setResponseStatus(event, 201)

  const waSuffix = whatsapp.waUrl
    ? ' — siap diteruskan ke WhatsApp Admin.'
    : '.'

  return {
    success: true,
    message: `Pengajuan pasokan +${qtyDiminta} pcs berhasil dikirim ke Admin${waSuffix}`,
    data: {
      id_request: idRequest,
      stok_saat_lapor: currentStok,
      qty_diminta: qtyDiminta,
      status: 'Menunggu Admin' as const
    },
    whatsapp
  }
})
