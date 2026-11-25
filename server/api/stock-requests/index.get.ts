import { desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '../../database'
import { dimsumStock, stockRequests, users } from '../../database/schema'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin', 'kasir'])

  const db = getDb()
  await ensureProductionLogsTable()

  const [[stockRow], rows] = await Promise.all([
    db.select().from(dimsumStock).where(eq(dimsumStock.id, 1)).limit(1),
    db
      .select()
      .from(stockRequests)
      .orderBy(desc(stockRequests.created_at), desc(stockRequests.id_request))
      .limit(30)
  ])

  const userIds = new Set<number>()
  for (const r of rows) {
    userIds.add(r.id_kasir)
    if (r.id_admin) userIds.add(r.id_admin)
  }

  const userMap = new Map<number, { nama: string, username: string }>()
  if (userIds.size > 0) {
    const userRows = await db
      .select({
        id_user: users.id_user,
        nama: users.nama,
        username: users.username
      })
      .from(users)
      .where(inArray(users.id_user, Array.from(userIds)))

    for (const u of userRows) {
      userMap.set(u.id_user, { nama: u.nama, username: u.username })
    }
  }

  const counts = {
    menungguAdmin: 0,
    sedangDiproduksi: 0,
    dikirimKeKasir: 0,
    diterimaKasir: 0,
    aktifAdmin: 0
  }

  const formatted = rows.map((row) => {
    if (row.status === 'Menunggu Admin') {
      counts.menungguAdmin += 1
      counts.aktifAdmin += 1
    } else if (row.status === 'Sedang Diproduksi') {
      counts.sedangDiproduksi += 1
      counts.aktifAdmin += 1
    } else if (row.status === 'Dikirim ke Kasir') {
      counts.dikirimKeKasir += 1
    } else {
      counts.diterimaKasir += 1
    }

    const kasir = userMap.get(row.id_kasir)
    const admin = row.id_admin ? userMap.get(row.id_admin) : null

    return {
      id_request: row.id_request,
      id_kasir: row.id_kasir,
      kasir_nama: kasir?.nama || 'Kasir',
      kasir_username: kasir?.username || 'kasir',
      id_admin: row.id_admin,
      admin_nama: admin?.nama || null,
      stok_saat_lapor: row.stok_saat_lapor,
      qty_diminta: row.qty_diminta,
      qty_dikirim: row.qty_dikirim,
      status: row.status,
      catatan_kasir: row.catatan_kasir,
      catatan_admin: row.catatan_admin,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString()
    }
  })

  return {
    success: true,
    currentDimsumPcs: stockRow?.stok_pcs ?? 0,
    counts,
    requests: formatted
  }
})
