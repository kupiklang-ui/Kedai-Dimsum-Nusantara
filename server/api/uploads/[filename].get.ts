import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { getUploadedFile } from '../../utils/uploadedFiles'

const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9._-]+$/

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

export default defineEventHandler(async (event) => {
  const filename = getRouterParam(event, 'filename')

  if (!filename || !SAFE_FILENAME_REGEX.test(filename) || filename.includes('..')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Nama file tidak valid.'
    })
  }

  const ext = extname(filename).toLowerCase()
  const contentType = EXT_TO_CONTENT_TYPE[ext]
  if (!contentType) {
    throw createError({
      statusCode: 404,
      statusMessage: 'File tidak ditemukan.'
    })
  }

  // 1. Cek terlebih dahulu di TiDB Cloud (persisten di Vercel/Netlify)
  try {
    const stored = await getUploadedFile(filename)
    if (stored) {
      setResponseHeader(event, 'Content-Type', stored.mimeType || contentType)
      setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
      return stored.buffer
    }
  } catch {
    // Lanjut fallback lokal jika DB belum tersedia
  }

  // 2. Fallback ke folder lokal uploads/menu (kompatibel dengan file lama saat dev lokal)
  const filePath = join(process.cwd(), 'uploads', 'menu', filename)
  try {
    const buffer = await readFile(filePath)
    setResponseHeader(event, 'Content-Type', contentType)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
    return buffer
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: 'Foto menu tidak ditemukan.'
    })
  }
})
