import { and, eq, ne } from 'drizzle-orm'
import { getDb } from '../../database'
import { dimsumStock, PRODUCT_CATEGORIES, products, type ProductCategory } from '../../database/schema'
import { toDecimalString } from '../../utils/datetime'
import { ensureProductionLogsTable, isSharedDimsumCategory } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface UpdateProductBody {
  kode_barang?: string
  nama_menu?: string
  kategori?: string
  satuan?: string
  isi_pcs?: number | string
  harga_modal?: number | string
  harga_jual?: number | string
  stok?: number | string
  stok_minimum?: number | string
  foto_url?: string | null
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])

  const idParam = getRouterParam(event, 'id')
  const idProduk = Number(idParam)

  if (!Number.isInteger(idProduk) || idProduk <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID produk tidak valid.'
    })
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const [existing] = await db
    .select()
    .from(products)
    .where(eq(products.id_produk, idProduk))
    .limit(1)

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Menu dimsum tidak ditemukan.'
    })
  }

  const body = await readBody<UpdateProductBody>(event)

  const kodeBarang = body?.kode_barang !== undefined ? body.kode_barang.trim().toUpperCase() : existing.kode_barang
  const namaMenu = body?.nama_menu !== undefined ? body.nama_menu.trim() : existing.nama_menu
  const kategori = body?.kategori !== undefined ? body.kategori.trim() : existing.kategori
  const usesShared = isSharedDimsumCategory(kategori)
  const satuan = body?.satuan !== undefined ? (body.satuan.trim() || (usesShared ? 'Pcs' : 'Porsi')) : existing.satuan
  const isiPcs = usesShared
    ? (body?.isi_pcs !== undefined ? Number(body.isi_pcs) : Math.max(1, existing.isi_pcs || 1))
    : 0
  const hargaModal = body?.harga_modal !== undefined ? Number(body.harga_modal) : Number(existing.harga_modal)
  const hargaJual = body?.harga_jual !== undefined ? Number(body.harga_jual) : Number(existing.harga_jual)
  const stok = usesShared
    ? existing.stok
    : (body?.stok !== undefined ? Number(body.stok) : existing.stok)
  const stokMinimum = usesShared
    ? existing.stok_minimum
    : (body?.stok_minimum !== undefined ? Number(body.stok_minimum) : existing.stok_minimum)
  const fotoUrl = body?.foto_url !== undefined ? (body.foto_url?.trim() || null) : existing.foto_url

  if (!kodeBarang || !namaMenu) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kode barang dan nama menu tidak boleh kosong.'
    })
  }

  if (!PRODUCT_CATEGORIES.includes(kategori as ProductCategory)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Kategori tidak valid. Pilihan: ${PRODUCT_CATEGORIES.join(', ')}`
    })
  }

  if (usesShared && (!Number.isInteger(isiPcs) || isiPcs <= 0)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Potongan stok dimsum (isi pcs) harus berupa bilangan bulat minimal 1 pcs.'
    })
  }

  if (!Number.isFinite(hargaModal) || hargaModal < 0 || !Number.isFinite(hargaJual) || hargaJual < 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Harga modal dan harga jual harus berupa angka bernilai 0 atau lebih.'
    })
  }

  if (!usesShared && (!Number.isInteger(stok) || stok < 0 || !Number.isInteger(stokMinimum) || stokMinimum < 0)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Stok dan stok minimum harus berupa bilangan bulat 0 atau lebih.'
    })
  }

  if (kodeBarang !== existing.kode_barang) {
    const duplicate = await db
      .select({ id_produk: products.id_produk })
      .from(products)
      .where(and(eq(products.kode_barang, kodeBarang), ne(products.id_produk, idProduk)))
      .limit(1)

    if (duplicate.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `Kode barang "${kodeBarang}" sudah digunakan oleh menu lain.`
      })
    }
  }

  await db
    .update(products)
    .set({
      kode_barang: kodeBarang,
      nama_menu: namaMenu,
      kategori: kategori as ProductCategory,
      satuan,
      isi_pcs: isiPcs,
      harga_modal: toDecimalString(hargaModal),
      harga_jual: toDecimalString(hargaJual),
      stok,
      stok_minimum: stokMinimum,
      foto_url: fotoUrl
    })
    .where(eq(products.id_produk, idProduk))

  const [[updated], [stockRow]] = await Promise.all([
    db.select().from(products).where(eq(products.id_produk, idProduk)).limit(1),
    db.select().from(dimsumStock).where(eq(dimsumStock.id, 1)).limit(1)
  ])

  const sharedPcs = stockRow?.stok_pcs ?? 0
  const sharedMin = stockRow?.stok_minimum_pcs ?? 20

  return {
    success: true,
    message: 'Menu berhasil diperbarui.',
    data: updated
      ? {
          ...updated,
          isi_pcs: usesShared ? Math.max(1, updated.isi_pcs) : 0,
          uses_shared_dimsum_stock: usesShared,
          harga_modal: Number(updated.harga_modal),
          harga_jual: Number(updated.harga_jual),
          stok: usesShared ? Math.floor(sharedPcs / Math.max(1, updated.isi_pcs)) : updated.stok,
          shared_dimsum_pcs: usesShared ? sharedPcs : undefined,
          is_low_stock: usesShared ? sharedPcs <= sharedMin : updated.stok <= updated.stok_minimum
        }
      : null
  }
})
