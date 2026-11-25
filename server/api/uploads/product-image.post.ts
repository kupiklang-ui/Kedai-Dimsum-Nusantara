import { randomBytes } from 'node:crypto'
import { requireAuth } from '../../utils/session'
import { saveUploadedFile } from '../../utils/uploadedFiles'

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024 // 4 MB (aman untuk Vercel/Netlify serverless)

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])

  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File gambar tidak ditemukan pada permintaan.'
    })
  }

  const filePart = formData.find(part => part.name === 'file' && part.data && part.data.length > 0)
  if (!filePart || !filePart.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Silakan pilih file foto makanan untuk diunggah.'
    })
  }

  const mimeType = (filePart.type || '').toLowerCase()
  const ext = ALLOWED_MIME_TO_EXT[mimeType]
  if (!ext) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Format gambar tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF.'
    })
  }

  if (filePart.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Ukuran foto terlalu besar. Maksimal 4 MB.'
    })
  }

  const filename = `menu-${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`
  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType

  await saveUploadedFile(filename, normalizedMime, filePart.data)

  return {
    success: true,
    message: 'Foto menu berhasil diunggah & tersimpan di cloud.',
    filename,
    url: `/api/uploads/${filename}`
  }
})
