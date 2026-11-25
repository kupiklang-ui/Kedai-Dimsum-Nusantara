import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

function buildTiDbUrl(rawUrl: string): string {
  if (!rawUrl) {
    return ''
  }

  try {
    const parsed = new URL(rawUrl)
    if (!parsed.port) {
      parsed.port = '4000'
    }
    if (!parsed.searchParams.has('ssl')) {
      parsed.searchParams.set('ssl', JSON.stringify({
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }))
    }
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: buildTiDbUrl(process.env.DATABASE_URL || '')
  },
  verbose: true,
  strict: true
})
