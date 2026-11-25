import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from '../database'

let uploadedFilesTableEnsured = false

export interface StoredUploadedFile {
  filename: string
  mimeType: string
  buffer: Buffer
  updatedAtMs: number
}

export async function ensureUploadedFilesTable(): Promise<void> {
  if (uploadedFilesTableEnsured) {
    return
  }

  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`uploaded_files\` (
      \`filename\` varchar(180) NOT NULL,
      \`mime_type\` varchar(80) NOT NULL,
      \`data_base64\` longtext NOT NULL,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`uploaded_files_filename\` PRIMARY KEY(\`filename\`)
    );
  `)

  uploadedFilesTableEnsured = true
}

export async function saveUploadedFile(filename: string, mimeType: string, data: Buffer): Promise<void> {
  await ensureUploadedFilesTable()
  const pool = getPool()
  const base64 = data.toString('base64')

  await pool.query(
    `
      INSERT INTO \`uploaded_files\` (\`filename\`, \`mime_type\`, \`data_base64\`)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        \`mime_type\` = VALUES(\`mime_type\`),
        \`data_base64\` = VALUES(\`data_base64\`),
        \`updated_at\` = CURRENT_TIMESTAMP
    `,
    [filename, mimeType, base64]
  )
}

export async function getUploadedFile(filename: string): Promise<StoredUploadedFile | null> {
  await ensureUploadedFilesTable()
  const pool = getPool()

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT \`filename\`, \`mime_type\`, \`data_base64\`, UNIX_TIMESTAMP(\`updated_at\`) * 1000 AS \`updated_ms\`
      FROM \`uploaded_files\`
      WHERE \`filename\` = ?
      LIMIT 1
    `,
    [filename]
  )

  const row = rows?.[0]
  if (!row || !row.data_base64) {
    return null
  }

  return {
    filename: String(row.filename),
    mimeType: String(row.mime_type || 'application/octet-stream'),
    buffer: Buffer.from(String(row.data_base64), 'base64'),
    updatedAtMs: Number(row.updated_ms || Date.now())
  }
}

export async function getUploadedFileMeta(filename: string): Promise<{ mimeType: string, updatedAtMs: number } | null> {
  await ensureUploadedFilesTable()
  const pool = getPool()

  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT \`mime_type\`, UNIX_TIMESTAMP(\`updated_at\`) * 1000 AS \`updated_ms\`
      FROM \`uploaded_files\`
      WHERE \`filename\` = ?
      LIMIT 1
    `,
    [filename]
  )

  const row = rows?.[0]
  if (!row) {
    return null
  }

  return {
    mimeType: String(row.mime_type || 'application/octet-stream'),
    updatedAtMs: Number(row.updated_ms || Date.now())
  }
}
