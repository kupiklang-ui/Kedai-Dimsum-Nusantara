import { eq } from 'drizzle-orm'
import { getDb } from '../../database'
import { dimsumStock, PRODUCT_CATEGORIES, products, type ProductCategory } from '../../database/schema'
import { toDecimalString } from '../../utils/datetime'
import { ensureProductionLogsTable, isSharedDimsumCategory } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

interface CreateProductBody {
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

  const body = await readBody<CreateProductBody>(event)

  const kodeBarang = body?.kode_barang?.trim().toUpperCase()
  const namaMenu = body?.nama_menu?.trim()
  const kategori = body?.kategori?.trim()
  const usesShared = kategori ? isSharedDimsumCategory(kategori) : true
  const satuan = body?.satuan?.trim() || (usesShared ? 'Pcs' : 'Porsi')
  const isiPcs = usesShared
    ? (body?.isi_pcs !== undefined && body?.isi_pcs !== '' ? Number(body.isi_pcs) : 1)
    : 0
  const hargaModal = Number(body?.harga_modal)
  const hargaJual = Number(body?.harga_jual)
  const stok = usesShared
    ? 0
    : (body?.stok !== undefined && body?.stok !== '' ? Number(body.stok) : 0)
  const stokMinimum = usesShared
    ? 5
    : (body?.stok_minimum !== undefined && body?.stok_minimum !== '' ? Number(body.stok_minimum) : 5)
  const fotoUrl = body?.foto_url?.trim() || null

  if (!kodeBarang || !namaMenu) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kode barang dan nama menu wajib diisi.'
    })
  }

  if (!kategori || !PRODUCT_CATEGORIES.includes(kategori as ProductCategory)) {
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

  const db = getDb()
  await ensureProductionLogsTable()

  const existing = await db
    .select({ id_produk: products.id_produk })
    .from(products)
    .where(eq(products.kode_barang, kodeBarang))
    .limit(1)

  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Kode barang "${kodeBarang}" sudah digunakan oleh menu lain.`
    })
  }

  const [result] = await db.insert(products).values({
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

  const insertedId = Number(result.insertId)
  const [[created], [stockRow]] = await Promise.all([
    db.select().from(products).where(eq(products.id_produk, insertedId)).limit(1),
    db.select().from(dimsumStock).where(eq(dimsumStock.id, 1)).limit(1)
  ])

  const sharedPcs = stockRow?.stok_pcs ?? 0
  const sharedMin = stockRow?.stok_minimum_pcs ?? 20

  setResponseStatus(event, 201)

  return {
    success: true,
    message: 'Menu berhasil ditambahkan.',
    data: created
      ? {
          ...created,
          isi_pcs: usesShared ? Math.max(1, created.isi_pcs) : 0,
          uses_shared_dimsum_stock: usesShared,
          harga_modal: Number(created.harga_modal),
          harga_jual: Number(created.harga_jual),
          stok: usesShared ? Math.floor(sharedPcs / Math.max(1, created.isi_pcs)) : created.stok,
          shared_dimsum_pcs: usesShared ? sharedPcs : undefined,
          is_low_stock: usesShared ? sharedPcs <= sharedMin : created.stok <= created.stok_minimum
        }
      : null
  }
})
