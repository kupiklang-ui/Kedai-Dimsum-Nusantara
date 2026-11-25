import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { getDb } from '../../database'
import { products, transactionDetails, transactions, users } from '../../database/schema'
import { formatShortIndonesianDate, getWibDateKey } from '../../utils/datetime'
import { ensureProductionLogsTable, isFinalizedTransaction } from '../../utils/ensureProductionTable'
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

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${ID_FULL_MONTHS[(m || 1) - 1]} ${y}`
}

function parseDateBounds(mode: 'daily' | 'monthly', period: string): { queryStart: Date, queryEnd: Date } {
  const oneDayMs = 24 * 60 * 60 * 1000

  if (mode === 'daily') {
    const [y, m, d] = period.split('-').map(Number)
    const startUtc = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
    // Buffer ±1 hari agar query tidak terpengaruh offset timezone server DB; filter ketat di WIB
    return {
      queryStart: new Date(startUtc - oneDayMs),
      queryEnd: new Date(startUtc + 2 * oneDayMs)
    }
  }

  const [y, m] = period.split('-').map(Number)
  const startUtc = Date.UTC(y, m - 1, 1, 0, 0, 0, 0)
  const nextMonthUtc = Date.UTC(y, m, 1, 0, 0, 0, 0)
  return {
    queryStart: new Date(startUtc - oneDayMs),
    queryEnd: new Date(nextMonthUtc + oneDayMs)
  }
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin'])

  const query = getQuery(event)
  const mode = query.mode === 'monthly' ? 'monthly' : 'daily'

  const todayKey = getWibDateKey(new Date())
  const currentMonthKey = todayKey.slice(0, 7)

  const rawDate = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
    ? query.date
    : todayKey

  const rawMonth = typeof query.month === 'string' && /^\d{4}-\d{2}$/.test(query.month)
    ? query.month
    : currentMonthKey

  const period = mode === 'daily' ? rawDate : rawMonth
  const periodLabel = mode === 'daily' ? formatFullDateLabel(period) : formatMonthLabel(period)

  const paymentFilter = typeof query.payment === 'string' ? query.payment : 'Semua'
  const orderTypeFilter = typeof query.orderType === 'string' ? query.orderType : 'Semua'
  const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : ''

  const { queryStart, queryEnd } = parseDateBounds(mode, period)
  const db = getDb()
  await ensureProductionLogsTable()

  const rawRows = await db
    .select({
      no_faktur: transactions.no_faktur,
      id_user: transactions.id_user,
      tanggal_transaksi: transactions.tanggal_transaksi,
      tipe_pesanan: transactions.tipe_pesanan,
      nomor_meja: transactions.nomor_meja,
      total_harga: transactions.total_harga,
      bayar: transactions.bayar,
      kembalian: transactions.kembalian,
      metode_pembayaran: transactions.metode_pembayaran,
      status_pesanan: transactions.status_pesanan,
      kode_order_driver: transactions.kode_order_driver,
      kasir_nama: users.nama,
      kasir_username: users.username
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.id_user, users.id_user))
    .where(and(
      gte(transactions.tanggal_transaksi, queryStart),
      lte(transactions.tanggal_transaksi, queryEnd)
    ))
    .orderBy(desc(transactions.tanggal_transaksi))

  // Filter tepat berdasarkan kalender WIB + hanya transaksi final (Driver Food wajib sudah Diambil Driver)
  const matchedRows = rawRows.filter((row) => {
    if (!isFinalizedTransaction(row.metode_pembayaran, row.status_pesanan)) return false

    const wibDate = getWibDateKey(new Date(row.tanggal_transaksi))
    const matchesPeriod = mode === 'daily'
      ? wibDate === period
      : wibDate.startsWith(period)

    if (!matchesPeriod) return false

    if (paymentFilter === 'DriverFood') {
      if (row.metode_pembayaran !== 'ShopeeFood' && row.metode_pembayaran !== 'GoFood') return false
    } else if (
      paymentFilter === 'Tunai' ||
      paymentFilter === 'QRIS' ||
      paymentFilter === 'ShopeeFood' ||
      paymentFilter === 'GoFood'
    ) {
      if (row.metode_pembayaran !== paymentFilter) return false
    }

    if (orderTypeFilter === 'Dine-In' || orderTypeFilter === 'Takeaway') {
      if (row.tipe_pesanan !== orderTypeFilter) return false
    }

    if (search) {
      const hay = `${row.no_faktur} ${row.kasir_nama} ${row.kasir_username} ${row.kode_order_driver || ''} ${row.metode_pembayaran}`.toLowerCase()
      if (!hay.includes(search)) return false
    }

    return true
  })

  const invoiceIds = matchedRows.map(r => r.no_faktur)

  interface DetailWithProduct {
    no_faktur: string
    id_produk: number
    nama_menu: string
    kode_barang: string
    satuan: string
    harga_satuan: number
    harga_modal: number
    qty: number
    subtotal: number
    catatan: string | null
  }

  const detailsByInvoice = new Map<string, DetailWithProduct[]>()

  if (invoiceIds.length > 0) {
    const detailRows = await db
      .select({
        no_faktur: transactionDetails.no_faktur,
        id_produk: transactionDetails.id_produk,
        harga_satuan: transactionDetails.harga_satuan,
        qty: transactionDetails.qty,
        subtotal: transactionDetails.subtotal,
        catatan: transactionDetails.catatan,
        nama_menu: products.nama_menu,
        kode_barang: products.kode_barang,
        satuan: products.satuan,
        harga_modal: products.harga_modal
      })
      .from(transactionDetails)
      .innerJoin(products, eq(transactionDetails.id_produk, products.id_produk))
      .where(inArray(transactionDetails.no_faktur, invoiceIds))

    for (const d of detailRows) {
      const list = detailsByInvoice.get(d.no_faktur) || []
      list.push({
        no_faktur: d.no_faktur,
        id_produk: d.id_produk,
        nama_menu: d.nama_menu,
        kode_barang: d.kode_barang,
        satuan: d.satuan,
        harga_satuan: Number(d.harga_satuan),
        harga_modal: Number(d.harga_modal),
        qty: d.qty,
        subtotal: Number(d.subtotal),
        catatan: d.catatan
      })
      detailsByInvoice.set(d.no_faktur, list)
    }
  }

  let totalOmzet = 0
  let totalLabaKotor = 0
  let totalItemTerjual = 0
  let totalTunai = 0
  let totalQris = 0
  let totalShopeeFood = 0
  let totalGoFood = 0
  let totalDineIn = 0
  let totalTakeaway = 0

  const breakdownMap = new Map<string, {
    date: string
    label: string
    totalTransaksi: number
    totalItem: number
    totalOmzet: number
    totalLabaKotor: number
    totalTunai: number
    totalQris: number
    totalShopeeFood: number
    totalGoFood: number
  }>()

  const formattedTransactions = matchedRows.map((row) => {
    const items = detailsByInvoice.get(row.no_faktur) || []
    const totalHarga = Number(row.total_harga)
    const bayar = Number(row.bayar)
    const kembalian = Number(row.kembalian)

    let totalQty = 0
    let estimasiLaba = 0
    for (const item of items) {
      totalQty += item.qty
      estimasiLaba += (item.harga_satuan - item.harga_modal) * item.qty
    }

    totalOmzet += totalHarga
    totalLabaKotor += estimasiLaba
    totalItemTerjual += totalQty

    if (row.metode_pembayaran === 'Tunai') {
      totalTunai += totalHarga
    } else if (row.metode_pembayaran === 'QRIS') {
      totalQris += totalHarga
    } else if (row.metode_pembayaran === 'ShopeeFood') {
      totalShopeeFood += totalHarga
    } else if (row.metode_pembayaran === 'GoFood') {
      totalGoFood += totalHarga
    }

    if (row.tipe_pesanan === 'Dine-In') {
      totalDineIn += 1
    } else {
      totalTakeaway += 1
    }

    if (mode === 'monthly') {
      const dayKey = getWibDateKey(new Date(row.tanggal_transaksi))
      const bucket = breakdownMap.get(dayKey) || {
        date: dayKey,
        label: formatShortIndonesianDate(dayKey),
        totalTransaksi: 0,
        totalItem: 0,
        totalOmzet: 0,
        totalLabaKotor: 0,
        totalTunai: 0,
        totalQris: 0,
        totalShopeeFood: 0,
        totalGoFood: 0
      }

      bucket.totalTransaksi += 1
      bucket.totalItem += totalQty
      bucket.totalOmzet += totalHarga
      bucket.totalLabaKotor += estimasiLaba
      if (row.metode_pembayaran === 'Tunai') {
        bucket.totalTunai += totalHarga
      } else if (row.metode_pembayaran === 'QRIS') {
        bucket.totalQris += totalHarga
      } else if (row.metode_pembayaran === 'ShopeeFood') {
        bucket.totalShopeeFood += totalHarga
      } else if (row.metode_pembayaran === 'GoFood') {
        bucket.totalGoFood += totalHarga
      }

      breakdownMap.set(dayKey, bucket)
    }

    return {
      no_faktur: row.no_faktur,
      tanggal_transaksi: new Date(row.tanggal_transaksi).toISOString(),
      kasir: {
        id_user: row.id_user,
        nama: row.kasir_nama,
        username: row.kasir_username
      },
      tipe_pesanan: row.tipe_pesanan,
      nomor_meja: row.nomor_meja,
      metode_pembayaran: row.metode_pembayaran,
      status_pesanan: row.status_pesanan,
      kode_order_driver: row.kode_order_driver,
      total_harga: totalHarga,
      bayar,
      kembalian,
      total_qty: totalQty,
      estimasi_laba: estimasiLaba,
      items: items.map(({ harga_modal: _hm, no_faktur: _nf, ...rest }) => rest)
    }
  })

  const dailyBreakdown = Array.from(breakdownMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  )

  return {
    success: true,
    mode,
    period,
    periodLabel,
    summary: {
      totalOmzet,
      totalLabaKotor,
      totalTransaksi: formattedTransactions.length,
      totalItemTerjual,
      totalTunai,
      totalQris,
      totalShopeeFood,
      totalGoFood,
      totalDineIn,
      totalTakeaway
    },
    dailyBreakdown,
    transactions: formattedTransactions
  }
})
