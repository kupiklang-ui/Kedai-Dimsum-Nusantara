import { eq, sql } from 'drizzle-orm'
import { getDb } from '../../database'
import {
  dimsumStock,
  PRODUCTION_INPUT_TYPES,
  productionLogs,
  type ProductionInputType
} from '../../database/schema'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface CreateGlobalProductionBody {
  tipe_input?: string
  qty_produksi?: number | string
  stok_minimum_pcs?: number | string
  catatan?: string | null
}

export default defineEventHandler(async (event) => {
  const admin = requireAuth(event, ['admin'])
  const body = await readBody<CreateGlobalProductionBody>(event)

  const tipeInput = (body?.tipe_input?.trim() || 'tambah') as ProductionInputType
  if (!PRODUCTION_INPUT_TYPES.includes(tipeInput)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tipe input produksi tidak valid. Gunakan "tambah" atau "set_harian".'
    })
  }

  const qtyProduksi = Number(body?.qty_produksi)
  const hasMinUpdate = body?.stok_minimum_pcs !== undefined && body?.stok_minimum_pcs !== ''
  const nextMinPcs = hasMinUpdate ? Number(body?.stok_minimum_pcs) : undefined
  const catatan = body?.catatan ? String(body.catatan).trim().slice(0, 255) : null

  if (!Number.isInteger(qtyProduksi) || qtyProduksi <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Jumlah produksi dimsum (pcs) harus berupa bilangan bulat minimal 1.'
    })
  }

  if (nextMinPcs !== undefined && (!Number.isInteger(nextMinPcs) || nextMinPcs < 0)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Batas stok minimum dimsum harus berupa bilangan bulat 0 atau lebih.'
    })
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(dimsumStock)
      .where(eq(dimsumStock.id, 1))
      .for('update')
      .limit(1)

    const stokSebelum = current?.stok_pcs ?? 0
    const stokSesudah = tipeInput === 'set_harian'
      ? qtyProduksi
      : stokSebelum + qtyProduksi
    const minPcs = nextMinPcs !== undefined ? nextMinPcs : (current?.stok_minimum_pcs ?? 20)

    if (!current) {
      await tx.insert(dimsumStock).values({
        id: 1,
        stok_pcs: stokSesudah,
        stok_minimum_pcs: minPcs
      })
    } else if (tipeInput === 'set_harian') {
      await tx
        .update(dimsumStock)
        .set({
          stok_pcs: qtyProduksi,
          stok_minimum_pcs: minPcs
        })
        .where(eq(dimsumStock.id, 1))
    } else {
      await tx
        .update(dimsumStock)
        .set({
          stok_pcs: sql`${dimsumStock.stok_pcs} + ${qtyProduksi}`,
          stok_minimum_pcs: minPcs
        })
        .where(eq(dimsumStock.id, 1))
    }

    await tx.insert(productionLogs).values({
      id_produk: null,
      id_user: admin.id_user,
      tanggal_produksi: new Date(),
      qty_produksi: qtyProduksi,
      stok_sebelum: stokSebelum,
      stok_sesudah: stokSesudah,
      tipe_input: tipeInput,
      catatan: catatan || (tipeInput === 'set_harian' ? 'Stok Produksi Dimsum Pagi' : 'Batch Produksi Dimsum')
    })

    return {
      stokSebelum,
      stokSesudah,
      stokMinimumPcs: minPcs
    }
  })

  setResponseStatus(event, 201)

  return {
    success: true,
    message: tipeInput === 'set_harian'
      ? `Stok produksi dimsum hari ini diatur menjadi ${result.stokSesudah} pcs.`
      : `Berhasil menambahkan +${qtyProduksi} pcs ke stok produksi dimsum (total sekarang ${result.stokSesudah} pcs).`,
    data: result
  }
})
