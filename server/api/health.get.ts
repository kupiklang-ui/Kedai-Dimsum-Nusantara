import { checkDatabaseConnection } from '../database'

export default defineEventHandler(async () => {
  const result = await checkDatabaseConnection()

  return {
    status: result.connected ? 'ok' : 'error',
    database: result.connected ? 'connected' : 'disconnected',
    provider: 'TiDB Cloud Serverless',
    latencyMs: result.latencyMs,
    ...(result.error ? { error: result.error } : {}),
    timestamp: new Date().toISOString()
  }
})
