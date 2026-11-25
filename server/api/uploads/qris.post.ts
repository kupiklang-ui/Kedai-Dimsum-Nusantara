import { requireAuth } from '../../utils/session'
import { saveUploadedFile } from '../../utils/uploadedFiles'

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024 // 4 MB (aman untuk Vercel/Netlify serverless)
const QRIS_STORAGE_KEY = 'store-qris'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
])

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File gambar QRIS tidak ditemukan.'
    })
  }

  const filePart = formData.find(part => part.name === 'file' && part.data && part.data.length > 0)
  if (!filePart || !filePart.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Silakan pilih file gambar QRIS toko Anda.'
    })
  }

  const mimeType = (filePart.type || '').toLowerCase()
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Format QRIS harus JPG, PNG, atau WEBP.'
    })
  }

  if (filePart.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ukuran gambar QRIS maksimal 4 MB.'
    })
  }

  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType
  await saveUploadedFile(QRIS_STORAGE_KEY, normalizedMime, filePart.data)

  return {
    success: true,
    message: 'Gambar QRIS toko berhasil diperbarui & tersimpan di cloud.',
    url: `/api/uploads/qris?raw=1&v=${Date.now()}`
  }
})
