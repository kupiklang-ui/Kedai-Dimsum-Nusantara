import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { getDb } from '../../database'
import {
  dimsumStock,
  PRODUCT_CATEGORIES,
  productionLogs,
  products,
  transactionDetails,
  transactions,
  type ProductCategory
} from '../../database/schema'
import { formatShortIndonesianDate, getWibDateKey, getWibDayRange } from '../../utils/datetime'
import { ensureProductionLogsTable, isFinalizedTransaction, isSharedDimsumCategory } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

const ID_FULL_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const ID_FULL_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

function formatFullIndonesianDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${ID_FULL_DAYS[dt.getUTCDay()]}, ${d} ${ID_FULL_MONTHS[dt.getUTCMonth()]} ${y}`
}

function calcGrowthPct(today: number, yesterday: number): number {
  if (yesterday <= 0) {
    return today > 0 ? 100 : 0
  }
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])

  const db = getDb()
  await ensureProductionLogsTable()

  const todayRange = getWibDayRange(0)
  const yesterdayRange = getWibDayRange(1)
  const oldestRange = getWibDayRange(6)
  const queryStart = new Date(oldestRange.start.getTime() - 24 * 60 * 60 * 1000)
  const todayProdQueryStart = new Date(todayRange.start.getTime() - 24 * 60 * 60 * 1000)

  const [[stockRow], recentTransactions, top5Rows, categoryRows, lowStockSeparateRows, recentGlobalProdLogs] = await Promise.all([
    db.select().from(dimsumStock).where(eq(dimsumStock.id, 1)).limit(1),

    db
      .select()
      .from(transactions)
      .where(gte(transactions.tanggal_transaksi, queryStart))
      .orderBy(desc(transactions.tanggal_transaksi)),

    db
      .select({
        id_produk: products.id_produk,
        kode_barang: products.kode_barang,
        nama_menu: products.nama_menu,
        kategori: products.kategori,
        satuan: products.satuan,
        harga_jual: products.harga_jual,
        total_terjual: sql<number>`COALESCE(SUM(${transactionDetails.qty}), 0)`,
        total_pendapatan: sql<number>`COALESCE(SUM(${transactionDetails.subtotal}), 0)`
      })
      .from(transactionDetails)
      .innerJoin(transactions, eq(transactionDetails.no_faktur, transactions.no_faktur))
      .innerJoin(products, eq(transactionDetails.id_produk, products.id_produk))
      .where(sql`(${transactions.metode_pembayaran} NOT IN ('ShopeeFood', 'GoFood') OR ${transactions.status_pesanan} = 'Diambil Driver')`)
      .groupBy(
        products.id_produk,
        products.kode_barang,
        products.nama_menu,
        products.kategori,
        products.satuan,
        products.harga_jual
      )
      .orderBy(desc(sql`SUM(${transactionDetails.qty})`), desc(sql`SUM(${transactionDetails.subtotal})`))
      .limit(5),

    db
      .select({
        kategori: products.kategori,
        total_terjual: sql<number>`COALESCE(SUM(${transactionDetails.qty}), 0)`,
        total_pendapatan: sql<number>`COALESCE(SUM(${transactionDetails.subtotal}), 0)`
      })
      .from(transactionDetails)
      .innerJoin(transactions, eq(transactionDetails.no_faktur, transactions.no_faktur))
      .innerJoin(products, eq(transactionDetails.id_produk, products.id_produk))
      .where(sql`(${transactions.metode_pembayaran} NOT IN ('ShopeeFood', 'GoFood') OR ${transactions.status_pesanan} = 'Diambil Driver')`)
      .groupBy(products.kategori),

    db
      .select()
      .from(products)
      .where(and(
        eq(products.kategori, 'Minuman & Saus'),
        lte(products.stok, products.stok_minimum)
      ))
      .orderBy(asc(products.stok), asc(products.nama_menu)),

    db
      .select()
      .from(productionLogs)
      .where(and(
        isNull(productionLogs.id_produk),
        gte(productionLogs.tanggal_produksi, todayProdQueryStart)
      ))
  ])

  const trendMap = new Map<string, {
    date: string
    label: string
    omzet: number
    labaKotor: number
    totalTransaksi: number
  }>()

  for (let i = 6; i >= 0; i--) {
    const { dateKey } = getWibDayRange(i)
    trendMap.set(dateKey, {
      date: dateKey,
      label: formatShortIndonesianDate(dateKey),
      omzet: 0,
      labaKotor: 0,
      totalTransaksi: 0
    })
  }

  let omzetHariIni = 0
  let omzetKemarin = 0
  let totalPesananHariIni = 0
  let totalPesananKemarin = 0
  let totalDineInHariIni = 0
  let totalTakeawayHariIni = 0
  let totalTunaiHariIni = 0
  let totalQrisHariIni = 0
  let totalShopeeFoodHariIni = 0
  let totalGoFoodHariIni = 0
  let driverFoodAktifCount = 0

  // Channel stats over the 7-day window
  let totalTrx7Hari = 0
  let dineIn7Hari = 0
  let takeaway7Hari = 0
  let qris7Hari = 0
  let tunai7Hari = 0
  let shopeeFood7Hari = 0
  let goFood7Hari = 0

  const invoiceDateMap = new Map<string, string>()

  for (const trx of recentTransactions) {
    const trxDateKey = getWibDateKey(new Date(trx.tanggal_transaksi))
    const total = Number(trx.total_harga)
    const isFinalized = isFinalizedTransaction(trx.metode_pembayaran, trx.status_pesanan)

    // Pesanan Driver Food yang belum 'Diambil Driver' hanya dihitung sebagai antrean aktif, belum masuk omzet/laporan
    if (!isFinalized) {
      if (trxDateKey === todayRange.dateKey) {
        driverFoodAktifCount += 1
      }
      continue
    }

    const bucket = trendMap.get(trxDateKey)
    if (bucket) {
      bucket.omzet += total
      bucket.totalTransaksi += 1
      invoiceDateMap.set(trx.no_faktur, trxDateKey)

      totalTrx7Hari += 1
      if (trx.tipe_pesanan === 'Dine-In') dineIn7Hari += 1
      else takeaway7Hari += 1
      if (trx.metode_pembayaran === 'QRIS') qris7Hari += 1
      else if (trx.metode_pembayaran === 'ShopeeFood') shopeeFood7Hari += 1
      else if (trx.metode_pembayaran === 'GoFood') goFood7Hari += 1
      else tunai7Hari += 1
    }

    if (trxDateKey === todayRange.dateKey) {
      omzetHariIni += total
      totalPesananHariIni += 1
      if (trx.tipe_pesanan === 'Dine-In') totalDineInHariIni += 1
      else totalTakeawayHariIni += 1

      if (trx.metode_pembayaran === 'Tunai') {
        totalTunaiHariIni += total
      } else if (trx.metode_pembayaran === 'QRIS') {
        totalQrisHariIni += total
      } else if (trx.metode_pembayaran === 'ShopeeFood') {
        totalShopeeFoodHariIni += total
      } else if (trx.metode_pembayaran === 'GoFood') {
        totalGoFoodHariIni += total
      }
    } else if (trxDateKey === yesterdayRange.dateKey) {
      omzetKemarin += total
      totalPesananKemarin += 1
    }
  }

  // Hitung laba kotor per hari (7 hari terakhir) + total pcs dimsum terjual hari ini + kategori (Hari Ini & 7 Hari)
  let estimasiLabaKotorHariIni = 0
  let estimasiLabaKotorKemarin = 0
  let terjualHariIniPcs = 0

  const catTodayMap = new Map<ProductCategory, { totalTerjual: number, totalPendapatan: number }>()
  const catWeekMap = new Map<ProductCategory, { totalTerjual: number, totalPendapatan: number }>()
  for (const cat of PRODUCT_CATEGORIES) {
    catTodayMap.set(cat, { totalTerjual: 0, totalPendapatan: 0 })
    catWeekMap.set(cat, { totalTerjual: 0, totalPendapatan: 0 })
  }

  const trackedInvoiceIds = Array.from(invoiceDateMap.keys())
  if (trackedInvoiceIds.length > 0) {
    const detailRows = await db
      .select({
        no_faktur: transactionDetails.no_faktur,
        qty: transactionDetails.qty,
        subtotal: transactionDetails.subtotal,
        harga_satuan: transactionDetails.harga_satuan,
        harga_modal: products.harga_modal,
        kategori: products.kategori,
        isi_pcs: products.isi_pcs
      })
      .from(transactionDetails)
      .innerJoin(products, eq(transactionDetails.id_produk, products.id_produk))
      .where(inArray(transactionDetails.no_faktur, trackedInvoiceIds))

    for (const row of detailRows) {
      const dayKey = invoiceDateMap.get(row.no_faktur)
      if (!dayKey) continue

      const margin = (Number(row.harga_satuan) - Number(row.harga_modal)) * row.qty
      const sub = Number(row.subtotal)
      const bucket = trendMap.get(dayKey)
      if (bucket) {
        bucket.labaKotor += margin
      }

      const weekCat = catWeekMap.get(row.kategori)
      if (weekCat) {
        weekCat.totalTerjual += row.qty
        weekCat.totalPendapatan += sub
      }

      if (dayKey === todayRange.dateKey) {
        estimasiLabaKotorHariIni += margin
        const todayCat = catTodayMap.get(row.kategori)
        if (todayCat) {
          todayCat.totalTerjual += row.qty
          todayCat.totalPendapatan += sub
        }
        if (isSharedDimsumCategory(row.kategori)) {
          terjualHariIniPcs += row.qty * Math.max(1, row.isi_pcs || 1)
        }
      } else if (dayKey === yesterdayRange.dateKey) {
        estimasiLabaKotorKemarin += margin
      }
    }
  }

  function buildCategoryStats(map: Map<ProductCategory, { totalTerjual: number, totalPendapatan: number }>) {
    const total = Array.from(map.values()).reduce((sum, v) => sum + v.totalTerjual, 0)
    return PRODUCT_CATEGORIES
      .map((kategori) => {
        const item = map.get(kategori) || { totalTerjual: 0, totalPendapatan: 0 }
        const persentase = total > 0 ? Math.round((item.totalTerjual / total) * 100) : 0
        return {
          kategori,
          totalTerjual: item.totalTerjual,
          totalPendapatan: item.totalPendapatan,
          persentase
        }
      })
      .sort((a, b) => b.totalTerjual - a.totalTerjual)
  }

  // Category pie stats (All time)
  const catAllMap = new Map<ProductCategory, { totalTerjual: number, totalPendapatan: number }>()
  for (const cat of PRODUCT_CATEGORIES) {
    catAllMap.set(cat, { totalTerjual: 0, totalPendapatan: 0 })
  }
  for (const row of categoryRows) {
    catAllMap.set(row.kategori, {
      totalTerjual: Number(row.total_terjual),
      totalPendapatan: Number(row.total_pendapatan)
    })
  }

  const categoryStatsAll = buildCategoryStats(catAllMap)
  const categoryStatsWeek = buildCategoryStats(catWeekMap)
  const categoryStatsToday = buildCategoryStats(catTodayMap)
  const categoryStats = categoryStatsToday.some(i => i.totalTerjual > 0)
    ? categoryStatsToday
    : categoryStatsAll

  let diproduksiHariIniPcs = 0
  for (const log of recentGlobalProdLogs) {
    if (getWibDateKey(new Date(log.tanggal_produksi)) === todayRange.dateKey) {
      diproduksiHariIniPcs += log.qty_produksi
    }
  }

  const sharedPcs = stockRow?.stok_pcs ?? 0
  const sharedMinPcs = stockRow?.stok_minimum_pcs ?? 20
  const sharedIsLow = sharedPcs <= sharedMinPcs

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

  return {
    success: true,
    tanggal: todayRange.dateKey,
    tanggalLabel: formatFullIndonesianDate(todayRange.dateKey),
    dimsumStock: {
      stok_pcs: sharedPcs,
      stok_minimum_pcs: sharedMinPcs,
      is_low_stock: sharedIsLow,
      diproduksiHariIniPcs,
      terjualHariIniPcs
    },
    kpi: {
      omzetHariIni,
      estimasiLabaKotorHariIni,
      totalPesananHariIni,
      totalDineInHariIni,
      totalTakeawayHariIni,
      totalTunaiHariIni,
      totalQrisHariIni,
      totalShopeeFoodHariIni,
      totalGoFoodHariIni,
      driverFoodAktifCount,
      jumlahStokMenipis: lowStockSeparateRows.length + (sharedIsLow ? 1 : 0),
      omzetGrowthPct: calcGrowthPct(omzetHariIni, omzetKemarin),
      pesananGrowthPct: calcGrowthPct(totalPesananHariIni, totalPesananKemarin),
      labaGrowthPct: calcGrowthPct(estimasiLabaKotorHariIni, estimasiLabaKotorKemarin)
    },
    trenPenjualan7Hari: Array.from(trendMap.values()),
    categoryStats,
    categoryStatsByRange: {
      today: categoryStatsToday,
      week: categoryStatsWeek,
      all: categoryStatsAll
    },
    channelStats: {
      totalTransaksi7Hari: totalTrx7Hari,
      dineInCount: dineIn7Hari,
      dineInPct: pct(dineIn7Hari, totalTrx7Hari),
      takeawayCount: takeaway7Hari,
      takeawayPct: pct(takeaway7Hari, totalTrx7Hari),
      qrisCount: qris7Hari,
      qrisPct: pct(qris7Hari, totalTrx7Hari),
      tunaiCount: tunai7Hari,
      tunaiPct: pct(tunai7Hari, totalTrx7Hari),
      shopeeFoodCount: shopeeFood7Hari,
      shopeeFoodPct: pct(shopeeFood7Hari, totalTrx7Hari),
      goFoodCount: goFood7Hari,
      goFoodPct: pct(goFood7Hari, totalTrx7Hari)
    },
    top5MenuTerlaris: top5Rows.map(row => ({
      id_produk: row.id_produk,
      kode_barang: row.kode_barang,
      nama_menu: row.nama_menu,
      kategori: row.kategori,
      satuan: row.satuan,
      harga_jual: Number(row.harga_jual),
      total_terjual: Number(row.total_terjual),
      total_pendapatan: Number(row.total_pendapatan)
    })),
    stokMenipis: lowStockSeparateRows.map(row => ({
      id_produk: row.id_produk,
      kode_barang: row.kode_barang,
      nama_menu: row.nama_menu,
      kategori: row.kategori,
      satuan: row.satuan,
      isi_pcs: 0,
      uses_shared_dimsum_stock: false,
      harga_modal: Number(row.harga_modal),
      harga_jual: Number(row.harga_jual),
      stok: row.stok,
      stok_minimum: row.stok_minimum,
      foto_url: row.foto_url,
      is_low_stock: true
    }))
  }
})
