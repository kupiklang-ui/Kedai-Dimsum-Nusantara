import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { UserRole } from '../database/schema'

const SESSION_COOKIE_NAME = 'dimsum_pos_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12 // 12 jam

export interface SessionUser {
  id_user: number
  nama: string
  username: string
  role: UserRole
}

interface SessionPayload extends SessionUser {
  exp: number
}

function getEncryptionKey(): Buffer {
  const config = useRuntimeConfig()
  const secret = config.sessionSecret || process.env.SESSION_SECRET || 'dimsum-pos-fallback-secret-key'
  return createHash('sha256').update(secret).digest()
}

function encryptPayload(payload: SessionPayload): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`
}

function decryptPayload(token: string): SessionPayload | null {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return null
  }

  try {
    const [ivPart, tagPart, dataPart] = parts
    const key = getEncryptionKey()
    const iv = Buffer.from(ivPart, 'base64url')
    const authTag = Buffer.from(tagPart, 'base64url')
    const encrypted = Buffer.from(dataPart, 'base64url')

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    const parsed = JSON.parse(decrypted.toString('utf8')) as SessionPayload

    if (
      !parsed ||
      typeof parsed.id_user !== 'number' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.nama !== 'string' ||
      (parsed.role !== 'admin' && parsed.role !== 'kasir') ||
      typeof parsed.exp !== 'number'
    ) {
      return null
    }

    if (Date.now() > parsed.exp) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function setSessionCookie(event: H3Event, user: SessionUser): void {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  }

  const sealed = encryptPayload(payload)

  setCookie(event, SESSION_COOKIE_NAME, sealed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/'
  })
}

export function getSessionUser(event: H3Event): SessionUser | null {
  const token = getCookie(event, SESSION_COOKIE_NAME)
  if (!token) {
    return null
  }

  const payload = decryptPayload(token)
  if (!payload) {
    return null
  }

  return {
    id_user: payload.id_user,
    nama: payload.nama,
    username: payload.username,
    role: payload.role
  }
}

export function requireAuth(event: H3Event, allowedRoles?: UserRole[]): SessionUser {
  const user = getSessionUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Sesi tidak valid atau telah berakhir. Silakan login kembali.'
    })
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Akses ditolak. Peran akun Anda tidak memiliki izin untuk aksi ini.'
    })
  }

  return user
}
