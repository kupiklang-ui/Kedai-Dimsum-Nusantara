import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { getUploadedFile, getUploadedFileMeta } from '../../utils/uploadedFiles'

const QRIS_STORAGE_KEY = 'store-qris'

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
}

async function findLocalQrisFile(): Promise<{ fullPath: string, ext: string, mtimeMs: number } | null> {
  const qrisDir = join(process.cwd(), 'uploads', 'qris')
  try {
    const files = await readdir(qrisDir)
    const match = files.find(name => name.startsWith('store-qris.'))
    if (!match) {
      return null
    }
    const fullPath = join(qrisDir, match)
    const ext = extname(match).toLowerCase()
    if (!EXT_TO_CONTENT_TYPE[ext]) {
      return null
    }
    const fileStat = await stat(fullPath)
    return { fullPath, ext, mtimeMs: Math.floor(fileStat.mtimeMs) }
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  if (query.raw === '1') {
    // 1. Cek TiDB Cloud dulu
    try {
      const stored = await getUploadedFile(QRIS_STORAGE_KEY)
      if (stored) {
        setResponseHeader(event, 'Content-Type', stored.mimeType)
        setResponseHeader(event, 'Cache-Control', 'no-cache')
        return stored.buffer
      }
    } catch {
      // Lanjut fallback lokal
    }

    // 2. Fallback lokal
    const localFile = await findLocalQrisFile()
    if (!localFile) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Gambar QRIS kustom belum diunggah.'
      })
    }

    const buffer = await readFile(localFile.fullPath)
    setResponseHeader(event, 'Content-Type', EXT_TO_CONTENT_TYPE[localFile.ext])
    setResponseHeader(event, 'Cache-Control', 'no-cache')
    return buffer
  }

  // Metadata mode
  try {
    const cloudMeta = await getUploadedFileMeta(QRIS_STORAGE_KEY)
    if (cloudMeta) {
      return {
        success: true,
        hasCustomQris: true,
        url: `/api/uploads/qris?raw=1&v=${cloudMeta.updatedAtMs}`
      }
    }
  } catch {
    // Lanjut fallback lokal
  }

  const localFile = await findLocalQrisFile()
  return {
    success: true,
    hasCustomQris: Boolean(localFile),
    url: localFile
      ? `/api/uploads/qris?raw=1&v=${localFile.mtimeMs}`
      : '/images/qris-default.svg'
  }
})
