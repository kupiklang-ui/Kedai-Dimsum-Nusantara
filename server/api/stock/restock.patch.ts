import { eq, sql } from 'drizzle-orm'
import { getDb } from '../../database'
import { productionLogs, products } from '../../database/schema'
import { ensureProductionLogsTable } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface RestockBody {
  id_produk?: number | string
  qty_masuk?: number | string
  catatan?: string | null
}

export default defineEventHandler(async (event) => {
  const admin = requireAuth(event, ['admin'])

  const body = await readBody<RestockBody>(event)
  const idProduk = Number(body?.id_produk)
  const qtyMasuk = Number(body?.qty_masuk)
  const catatan = body?.catatan ? String(body.catatan).trim().slice(0, 255) : 'Tambah Stok Produksi Cepat'

  if (!Number.isInteger(idProduk) || idProduk <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID produk tidak valid.'
    })
  }

  if (!Number.isInteger(qtyMasuk) || qtyMasuk <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Jumlah tambah stok (qty_masuk) harus berupa bilangan bulat lebih dari 0.'
    })
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(products)
      .where(eq(products.id_produk, idProduk))
      .for('update')
      .limit(1)

    if (!current) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Menu dimsum tidak ditemukan.'
      })
    }

    const stokSesudah = current.stok + qtyMasuk

    await tx
      .update(products)
      .set({
        stok: sql`${products.stok} + ${qtyMasuk}`
      })
      .where(eq(products.id_produk, idProduk))

    await tx.insert(productionLogs).values({
      id_produk: idProduk,
      id_user: admin.id_user,
      tanggal_produksi: new Date(),
      qty_produksi: qtyMasuk,
      stok_sebelum: current.stok,
      stok_sesudah: stokSesudah,
      tipe_input: 'tambah',
      catatan
    })

    const [updated] = await tx
      .select()
      .from(products)
      .where(eq(products.id_produk, idProduk))
      .limit(1)

    return {
      stokSebelumnya: current.stok,
      updated: updated!
    }
  })

  return {
    success: true,
    message: `Stok produksi ${result.updated.nama_menu} berhasil ditambah ${qtyMasuk} ${result.updated.satuan}.`,
    data: {
      ...result.updated,
      harga_modal: Number(result.updated.harga_modal),
      harga_jual: Number(result.updated.harga_jual),
      stok_sebelumnya: result.stokSebelumnya,
      qty_masuk: qtyMasuk,
      is_low_stock: result.updated.stok <= result.updated.stok_minimum
    }
  }
})
