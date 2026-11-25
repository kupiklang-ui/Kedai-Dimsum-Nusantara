import { eq } from 'drizzle-orm'
import { getDb } from '../../database'
import { users } from '../../database/schema'
import { verifyPassword } from '../../utils/password'
import { setSessionCookie } from '../../utils/session'

interface LoginBody {
  username?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)
  const username = body?.username?.trim()
  const password = body?.password

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username dan password wajib diisi.'
    })
  }

  const db = getDb()
  const [foundUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!foundUser) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Username atau password salah.'
    })
  }

  const isPasswordValid = await verifyPassword(password, foundUser.password)
  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Username atau password salah.'
    })
  }

  const sessionUser = {
    id_user: foundUser.id_user,
    nama: foundUser.nama,
    username: foundUser.username,
    role: foundUser.role
  }

  setSessionCookie(event, sessionUser)

  return {
    success: true,
    message: 'Login berhasil.',
    user: sessionUser,
    redirectTo: sessionUser.role === 'admin' ? '/' : '/pos'
  }
})
