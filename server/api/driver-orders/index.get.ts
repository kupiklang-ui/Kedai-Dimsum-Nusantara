import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { getDb } from '../../database'
import {
  DRIVER_FOOD_METHODS,
  products,
  transactionDetails,
  transactions,
  users,
  type DriverFoodMethod,
  type DriverOrderStatus
} from '../../database/schema'
import { getWibDateKey } from '../../utils/datetime'
import { ensureProductionLogsTable, isSharedDimsumCategory } from '../../utils/ensureProductionTable'
import { requireAuth } from '../../utils/session'

const ID_FULL_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const ID_FULL_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

function formatFullDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return `${ID_FULL_DAYS[dt.getUTCDay()]}, ${d} ${ID_FULL_MONTHS[dt.getUTCMonth()]} ${y}`
}

function normalizeDriverStatus(raw: string | null): DriverOrderStatus {
  if (
    raw === 'Sedang Diolah' ||
    raw === 'Sedang Dibungkus' ||
    raw === 'Sudah Siap' ||
    raw === 'Diambil Driver'
  ) {
    return raw
  }
  return 'Sedang Diolah'
}

export default defineEventHandler(async (event) => {
  requireAuth(event, ['admin', 'kasir'])

  const query = getQuery(event)
  const todayKey = getWibDateKey(new Date())
  const selectedDate = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
    ? query.date
    : todayKey
  const platformFilter = typeof query.platform === 'string' ? query.platform : 'Semua'
  const statusFilter = typeof query.status === 'string' ? query.status : 'Semua Aktif'

  const [y, m, d] = selectedDate.split('-').map(Number)
  const oneDayMs = 24 * 60 * 60 * 1000
  const startUtc = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const queryStart = new Date(startUtc - oneDayMs)
  const queryEnd = new Date(startUtc + 2 * oneDayMs)

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
      inArray(transactions.metode_pembayaran, [...DRIVER_FOOD_METHODS]),
      gte(transactions.tanggal_transaksi, queryStart),
      lte(transactions.tanggal_transaksi, queryEnd)
    ))
    .orderBy(desc(transactions.tanggal_transaksi))

  // Filter ketat pada tanggal WIB yang dipilih
  const sameDayRows = rawRows.filter((row) => {
    const wibDate = getWibDateKey(new Date(row.tanggal_transaksi))
    if (wibDate !== selectedDate) return false
    if (platformFilter === 'ShopeeFood' || platformFilter === 'GoFood') {
      return row.metode_pembayaran === platformFilter
    }
    return true
  })

  const counts = {
    semuaAktif: 0,
    sedangDiolah: 0,
    sedangDibungkus: 0,
    sudahSiap: 0,
    diambilDriver: 0,
    totalHariIni: sameDayRows.length
  }

  for (const row of sameDayRows) {
    const st = normalizeDriverStatus(row.status_pesanan)
    if (st === 'Sedang Diolah') {
      counts.sedangDiolah += 1
      counts.semuaAktif += 1
    } else if (st === 'Sedang Dibungkus') {
      counts.sedangDibungkus += 1
      counts.semuaAktif += 1
    } else if (st === 'Sudah Siap') {
      counts.sudahSiap += 1
      counts.semuaAktif += 1
    } else {
      counts.diambilDriver += 1
    }
  }

  const filteredRows = sameDayRows.filter((row) => {
    const st = normalizeDriverStatus(row.status_pesanan)
    if (statusFilter === 'Semua') return true
    if (statusFilter === 'Semua Aktif') return st !== 'Diambil Driver'
    return st === statusFilter
  })

  const invoiceIds = filteredRows.map(r => r.no_faktur)
  const detailsByInvoice = new Map<string, Array<{
    id_produk: number
    nama_menu: string
    kode_barang: string
    satuan: string
    harga_satuan: number
    qty: number
    subtotal: number
    catatan: string | null
  }>>()

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
        satuan: products.satuan
      })
      .from(transactionDetails)
      .innerJoin(products, eq(transactionDetails.id_produk, products.id_produk))
      .where(inArray(transactionDetails.no_faktur, invoiceIds))

    for (const row of detailRows) {
      const list = detailsByInvoice.get(row.no_faktur) || []
      list.push({
        id_produk: row.id_produk,
        nama_menu: row.nama_menu,
        kode_barang: row.kode_barang,
        satuan: row.satuan,
        harga_satuan: Number(row.harga_satuan),
        qty: row.qty,
        subtotal: Number(row.subtotal),
        catatan: row.catatan
      })
      detailsByInvoice.set(row.no_faktur, list)
    }
  }

  const orders = filteredRows.map((row) => {
    const items = detailsByInvoice.get(row.no_faktur) || []
    const totalQty = items.reduce((sum, item) => sum + item.qty, 0)

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
      metode_pembayaran: row.metode_pembayaran as DriverFoodMethod,
      status_pesanan: normalizeDriverStatus(row.status_pesanan),
      kode_order_driver: row.kode_order_driver,
      total_harga: Number(row.total_harga),
      bayar: Number(row.bayar),
      kembalian: Number(row.kembalian),
      total_qty: totalQty,
      items
    }
  })

  // Hitung kebutuhan dimsum (pcs) dari semua antrean driver aktif hari ini (belum Diambil Driver)
  const pendingInvoiceIds = sameDayRows
    .filter(r => normalizeDriverStatus(r.status_pesanan) !== 'Diambil Driver')
    .map(r => r.no_faktur)

  let pendingDimsumPcs = 0
  if (pendingInvoiceIds.length > 0) {
    const pendingDetails = await db
      .select({
        qty: transactionDetails.qty,
        kategori: products.kategori,
        isi_pcs: products.isi_pcs
      })
      .from(transactionDetails)
      .innerJoin(products, eq(transactionDetails.id_produk, products.id_produk))
      .where(inArray(transactionDetails.no_faktur, pendingInvoiceIds))

    for (const d of pendingDetails) {
      if (isSharedDimsumCategory(d.kategori)) {
        pendingDimsumPcs += d.qty * Math.max(1, d.isi_pcs || 1)
      }
    }
  }

  return {
    success: true,
    date: selectedDate,
    dateLabel: formatFullDateLabel(selectedDate),
    pendingDimsumPcs,
    counts,
    orders
  }
})
