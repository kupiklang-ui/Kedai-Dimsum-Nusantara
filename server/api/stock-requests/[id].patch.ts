import { eq } from 'drizzle-orm'
import { getDb } from '../../database'
import { dimsumStock, productionLogs, stockRequests } from '../../database/schema'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface PatchStockRequestBody {
  action?: 'start_production' | 'produce_and_send' | 'confirm_received'
  qty_dikirim?: number | string
  catatan_admin?: string | null
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event, ['admin', 'kasir'])
  const idParam = Number(getRouterParam(event, 'id'))

  if (!Number.isInteger(idParam) || idParam <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID pengajuan stok tidak valid.'
    })
  }

  const body = await readBody<PatchStockRequestBody>(event)
  const action = body?.action

  if (!action || !['start_production', 'produce_and_send', 'confirm_received'].includes(action)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Aksi tidak valid.'
    })
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const [existing] = await db
    .select()
    .from(stockRequests)
    .where(eq(stockRequests.id_request, idParam))
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Pengajuan stok tidak ditemukan.'
    })
  }

  // 1. Kasir mengonfirmasi pasokan sudah diterima di kasir
  if (action === 'confirm_received') {
    if (user.role !== 'kasir') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Hanya Kasir yang dapat mengonfirmasi penerimaan pasokan.'
      })
    }

    await db
      .update(stockRequests)
      .set({ status: 'Diterima Kasir' })
      .where(eq(stockRequests.id_request, idParam))

    return {
      success: true,
      message: `Pasokan +${existing.qty_dikirim ?? existing.qty_diminta} pcs telah diterima di Kasir.`
    }
  }

  // Aksi di bawah khusus Admin
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Hanya Admin yang dapat memproses produksi dan mengirim pasokan.'
    })
  }

  const catatanAdmin = body?.catatan_admin ? String(body.catatan_admin).trim().slice(0, 255) : null

  // 2. Admin menandai sedang diproduksi di dapur
  if (action === 'start_production') {
    if (existing.status === 'Dikirim ke Kasir' || existing.status === 'Diterima Kasir') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Pengajuan ini sudah diproduksi dan dikirim ke Kasir.'
      })
    }

    await db
      .update(stockRequests)
      .set({
        id_admin: user.id_user,
        status: 'Sedang Diproduksi',
        catatan_admin: catatanAdmin || 'Dimsum sedang diproduksi di dapur, harap tunggu.'
      })
      .where(eq(stockRequests.id_request, idParam))

    return {
      success: true,
      message: `Status pengajuan #${idParam} diperbarui menjadi "Sedang Diproduksi".`
    }
  }

  // 3. Admin menyelesaikan produksi, menambah stok dimsum global (ACID), & mengirim notifikasi ke Kasir
  if (existing.status === 'Dikirim ke Kasir' || existing.status === 'Diterima Kasir') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pasokan untuk pengajuan ini sudah pernah dikirim sebelumnya.'
    })
  }

  const qtyDikirim = body?.qty_dikirim !== undefined ? Number(body.qty_dikirim) : existing.qty_diminta
  if (!Number.isInteger(qtyDikirim) || qtyDikirim <= 0 || qtyDikirim > 10000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Jumlah pcs yang dikirim harus bilangan bulat lebih dari 0.'
    })
  }

  const result = await db.transaction(async (tx) => {
    const [lockedStock] = await tx
      .select()
      .from(dimsumStock)
      .where(eq(dimsumStock.id, 1))
      .for('update')
      .limit(1)

    const stokSebelum = lockedStock?.stok_pcs ?? 0
    const stokSesudah = stokSebelum + qtyDikirim
    const now = new Date()

    if (lockedStock) {
      await tx
        .update(dimsumStock)
        .set({ stok_pcs: stokSesudah })
        .where(eq(dimsumStock.id, 1))
    } else {
      await tx.insert(dimsumStock).values({
        id: 1,
        stok_pcs: stokSesudah,
        stok_minimum_pcs: 20
      })
    }

    const finalAdminNote = catatanAdmin || `Pasokan +${qtyDikirim} pcs selesai diproduksi & sudah dikirim ke Kasir.`

    await tx.insert(productionLogs).values({
      id_produk: null,
      id_user: user.id_user,
      tanggal_produksi: now,
      qty_produksi: qtyDikirim,
      stok_sebelum: stokSebelum,
      stok_sesudah: stokSesudah,
      tipe_input: 'tambah',
      catatan: `Kirim ke Kasir (#REQ-${idParam}): ${finalAdminNote}`.slice(0, 255)
    })

    await tx
      .update(stockRequests)
      .set({
        id_admin: user.id_user,
        qty_dikirim: qtyDikirim,
        status: 'Dikirim ke Kasir',
        catatan_admin: finalAdminNote
      })
      .where(eq(stockRequests.id_request, idParam))

    return { stokSebelum, stokSesudah, qtyDikirim }
  })

  return {
    success: true,
    message: `Berhasil memproduksi +${result.qtyDikirim} pcs & mengirim pemberitahuan ke Kasir (Stok kini ${result.stokSesudah} pcs).`,
    data: result
  }
})
