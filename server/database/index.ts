import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import mysql, { type Pool, type PoolOptions } from 'mysql2/promise'
import * as schema from './schema'

export type Database = MySql2Database<typeof schema>

interface GlobalDbCache {
  __dimsumPosPool?: Pool
  __dimsumPosDb?: Database
  __dimsumPosUrl?: string
}

const globalCache = globalThis as unknown as GlobalDbCache

function resolveDatabaseUrl(): string {
  try {
    const config = useRuntimeConfig()
    if (config.databaseUrl) {
      return config.databaseUrl
    }
  } catch {
    // Fallback when imported outside Nitro request/runtime context
  }

  return process.env.DATABASE_URL || ''
}

function buildPoolOptions(databaseUrl: string): PoolOptions {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Format DATABASE_URL tidak valid. Pastikan menggunakan format mysql://user:pass@host:4000/db'
    })
  }

  const database = parsed.pathname.replace(/^\//, '')
  if (!parsed.hostname || !database) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATABASE_URL harus menyertakan host dan nama database TiDB Cloud.'
    })
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 4000,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: process.env.TIDB_SSL_REJECT_UNAUTHORIZED !== 'false'
    },
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  }
}

export function getPool(): Pool {
  const databaseUrl = resolveDatabaseUrl()
  if (!databaseUrl || databaseUrl.includes('USER.root:PASSWORD')) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATABASE_URL TiDB Cloud belum dikonfigurasi pada file .env'
    })
  }

  if (globalCache.__dimsumPosPool && globalCache.__dimsumPosUrl === databaseUrl) {
    return globalCache.__dimsumPosPool
  }

  const pool = mysql.createPool(buildPoolOptions(databaseUrl))
  globalCache.__dimsumPosPool = pool
  globalCache.__dimsumPosUrl = databaseUrl
  globalCache.__dimsumPosDb = drizzle(pool, { schema, mode: 'default' })

  return pool
}

export function getDb(): Database {
  getPool()
  return globalCache.__dimsumPosDb!
}

export async function checkDatabaseConnection(): Promise<{
  connected: boolean
  latencyMs: number
  error?: string
}> {
  const start = Date.now()
  try {
    const pool = getPool()
    await pool.query('SELECT 1 AS ok')
    return {
      connected: true,
      latencyMs: Date.now() - start
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal terhubung ke TiDB Cloud'
    return {
      connected: false,
      latencyMs: Date.now() - start,
      error: message
    }
  }
}

export { schema }
