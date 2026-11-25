import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { getDb } from '../../database'
import { dimsumStock, productionLogs, products, transactionDetails, transactions, users } from '../../database/schema'
import { getWibDateKey } from '../../utils/datetime'
import { ensureProductionLogsTable, isFinalizedTransaction, isSharedDimsumCategory } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

const ID_FULL_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]
const ID_FULL_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function formatFullDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${ID_FULL_DAYS[dt.getUTCDay()]}, ${d} ${ID_FULL_MONTHS[dt.getUTCMonth()]} ${y}`
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])

  const query = getQuery(event)
  const todayKey = getWibDateKey(new Date())
  const dateKey = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
    ? query.date
    : todayKey

  const [y, m, d] = dateKey.split('-').map(Number)
  const startUtc = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const oneDayMs = 24 * 60 * 60 * 1000
  const queryStart = new Date(startUtc - oneDayMs)
  const queryEnd = new Date(startUtc + 2 * oneDayMs)

  const db = getDb()
  await ensureProductionLogsTable()

  const [[stockRow], allProducts, rawProductionRows, rawTrxRows] = await Promise.all([
    db.select().from(dimsumStock).where(eq(dimsumStock.id, 1)).limit(1),

    db
      .select()
      .from(products)
      .orderBy(asc(products.kategori), asc(products.nama_menu)),

    db
      .select({
        id_produksi: productionLogs.id_produksi,
        id_produk: productionLogs.id_produk,
        tanggal_produksi: productionLogs.tanggal_produksi,
        qty_produksi: productionLogs.qty_produksi,
        stok_sebelum: productionLogs.stok_sebelum,
        stok_sesudah: productionLogs.stok_sesudah,
        tipe_input: productionLogs.tipe_input,
        catatan: productionLogs.catatan,
        kode_barang: products.kode_barang,
        nama_menu: products.nama_menu,
        satuan: products.satuan,
        admin_nama: users.nama
      })
      .from(productionLogs)
      .leftJoin(products, eq(productionLogs.id_produk, products.id_produk))
      .innerJoin(users, eq(productionLogs.id_user, users.id_user))
      .where(and(
        gte(productionLogs.tanggal_produksi, queryStart),
        lte(productionLogs.tanggal_produksi, queryEnd)
      ))
      .orderBy(desc(productionLogs.tanggal_produksi), desc(productionLogs.id_produksi)),

    db
      .select({
        no_faktur: transactions.no_faktur,
        tanggal_transaksi: transactions.tanggal_transaksi,
        metode_pembayaran: transactions.metode_pembayaran,
        status_pesanan: transactions.status_pesanan
      })
      .from(transactions)
      .where(and(
        gte(transactions.tanggal_transaksi, queryStart),
        lte(transactions.tanggal_transaksi, queryEnd)
      ))
  ])

  const sharedPcs = stockRow?.stok_pcs ?? 0
  const sharedMinPcs = stockRow?.stok_minimum_pcs ?? 20

  const dayProductionLogs = rawProductionRows.filter(
    row => getWibDateKey(new Date(row.tanggal_produksi)) === dateKey
  )

  const dayInvoiceIds = rawTrxRows
    .filter(row =>
      isFinalizedTransaction(row.metode_pembayaran, row.status_pesanan) &&
      getWibDateKey(new Date(row.tanggal_transaksi)) === dateKey
    )
    .map(row => row.no_faktur)

  const soldQtyByProduct = new Map<number, number>()
  if (dayInvoiceIds.length > 0) {
    const detailRows = await db
      .select({
        id_produk: transactionDetails.id_produk,
        qty: transactionDetails.qty
      })
      .from(transactionDetails)
      .where(inArray(transactionDetails.no_faktur, dayInvoiceIds))

    for (const row of detailRows) {
      soldQtyByProduct.set(row.id_produk, (soldQtyByProduct.get(row.id_produk) || 0) + row.qty)
    }
  }

  let totalDimsumDiproduksiPcs = 0
  for (const log of dayProductionLogs) {
    if (log.id_produk === null) {
      totalDimsumDiproduksiPcs += log.qty_produksi
    }
  }

  let totalDimsumTerjualPcs = 0
  const dimsumMenus = []
  const separateStockMenus = []

  for (const item of allProducts) {
    if (isSharedDimsumCategory(item.kategori)) {
      const isiPcs = Math.max(1, item.isi_pcs || 1)
      const qtySold = soldQtyByProduct.get(item.id_produk) || 0
      const pcsUsed = qtySold * isiPcs
      totalDimsumTerjualPcs += pcsUsed

      dimsumMenus.push({
        id_produk: item.id_produk,
        kode_barang: item.kode_barang,
        nama_menu: item.nama_menu,
        kategori: item.kategori,
        satuan: item.satuan,
        isi_pcs: isiPcs,
        qty_terjual_hari_ini: qtySold,
        pcs_terpakai_hari_ini: pcsUsed,
        max_porsi_tersisa: Math.floor(sharedPcs / isiPcs)
      })
    } else {
      separateStockMenus.push({
        ...item,
        isi_pcs: 0,
        uses_shared_dimsum_stock: false,
        harga_modal: Number(item.harga_modal),
        harga_jual: Number(item.harga_jual),
        is_low_stock: item.stok <= item.stok_minimum
      })
    }
  }

  return {
    success: true,
    date: dateKey,
    dateLabel: formatFullDateLabel(dateKey),
    dimsumStock: {
      stok_pcs: sharedPcs,
      stok_minimum_pcs: sharedMinPcs,
      is_low_stock: sharedPcs <= sharedMinPcs,
      updated_at: stockRow?.updated_at ? new Date(stockRow.updated_at).toISOString() : undefined
    },
    summary: {
      totalDimsumDiproduksiPcs,
      totalDimsumTerjualPcs,
      sisaDimsumPcs: sharedPcs,
      jumlahBatchHariIni: dayProductionLogs.filter(l => l.id_produk === null).length
    },
    dimsumMenus,
    separateStockMenus,
    logs: dayProductionLogs.map(log => ({
      id_produksi: log.id_produksi,
      id_produk: log.id_produk,
      kode_barang: log.kode_barang,
      nama_menu: log.id_produk === null ? 'Stok Dimsum Produksi (Global)' : (log.nama_menu || 'Menu Terhapus'),
      satuan: log.id_produk === null ? 'Pcs' : (log.satuan || 'Porsi'),
      tanggal_produksi: new Date(log.tanggal_produksi).toISOString(),
      qty_produksi: log.qty_produksi,
      stok_sebelum: log.stok_sebelum,
      stok_sesudah: log.stok_sesudah,
      tipe_input: log.tipe_input,
      catatan: log.catatan,
      admin_nama: log.admin_nama
    }))
  }
})
