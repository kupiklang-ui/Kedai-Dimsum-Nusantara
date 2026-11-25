import { and, asc, eq, like, or } from 'drizzle-orm'
import { getDb } from '../../database'
import { dimsumStock, PRODUCT_CATEGORIES, products, type ProductCategory } from '../../database/schema'
import { ensureProductionLogsTable, isSharedDimsumCategory } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin', 'kasir'])

  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const kategori = typeof query.kategori === 'string' ? query.kategori.trim() : ''
  const lowStockOnly = query.lowStock === 'true' || query.lowStock === '1'

  const conditions = []

  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(
        like(products.nama_menu, pattern),
        like(products.kode_barang, pattern)
      )
    )
  }

  if (kategori && kategori !== 'Semua') {
    if (PRODUCT_CATEGORIES.includes(kategori as ProductCategory)) {
      conditions.push(eq(products.kategori, kategori as ProductCategory))
    }
  }

  const db = getDb()
  await ensureProductionLogsTable()

  const [[stockRow], rows] = await Promise.all([
    db.select().from(dimsumStock).where(eq(dimsumStock.id, 1)).limit(1),
    db
      .select()
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(products.kategori), asc(products.nama_menu))
  ])

  const sharedPcs = stockRow?.stok_pcs ?? 0
  const sharedMinPcs = stockRow?.stok_minimum_pcs ?? 20
  const sharedIsLow = sharedPcs <= sharedMinPcs

  let mapped = rows.map((row) => {
    const usesShared = isSharedDimsumCategory(row.kategori)
    const isiPcs = usesShared ? Math.max(1, row.isi_pcs || 1) : 0
    const effectiveStock = usesShared ? Math.floor(sharedPcs / isiPcs) : row.stok
    const isLow = usesShared ? sharedIsLow || effectiveStock <= 0 : row.stok <= row.stok_minimum

    return {
      ...row,
      isi_pcs: isiPcs,
      uses_shared_dimsum_stock: usesShared,
      harga_modal: Number(row.harga_modal),
      harga_jual: Number(row.harga_jual),
      stok: effectiveStock,
      shared_dimsum_pcs: usesShared ? sharedPcs : undefined,
      is_low_stock: isLow
    }
  })

  if (lowStockOnly) {
    mapped = mapped.filter(item => item.is_low_stock)
  }

  return {
    success: true,
    dimsumStock: {
      stok_pcs: sharedPcs,
      stok_minimum_pcs: sharedMinPcs,
      is_low_stock: sharedIsLow,
      updated_at: stockRow?.updated_at ? new Date(stockRow.updated_at).toISOString() : undefined
    },
    data: mapped
  }
})
