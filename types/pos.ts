export type UserRole = 'admin' | 'kasir'

export interface SessionUser {
  id_user: number
  nama: string
  username: string
  role: UserRole
}

export const PRODUCT_CATEGORIES = [
  'Dimsum Kukus',
  'Dimsum Goreng',
  'Paket Mix',
  'Minuman & Saus'
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export type OrderType = 'Dine-In' | 'Takeaway'
export type PaymentMethod = 'Tunai' | 'QRIS' | 'ShopeeFood' | 'GoFood'
export type DriverFoodMethod = 'ShopeeFood' | 'GoFood'

export const DRIVER_ORDER_STATUSES = [
  'Sedang Diolah',
  'Sedang Dibungkus',
  'Sudah Siap',
  'Diambil Driver'
] as const

export type DriverOrderStatus = (typeof DRIVER_ORDER_STATUSES)[number]

export function isDriverFoodPayment(method: string): method is DriverFoodMethod {
  return method === 'ShopeeFood' || method === 'GoFood'
}

export function formatPaymentMethodLabel(method: PaymentMethod): string {
  switch (method) {
    case 'ShopeeFood':
      return 'Driver ShopeeFood'
    case 'GoFood':
      return 'Driver GoFood (Gojek)'
    case 'QRIS':
      return 'QRIS'
    default:
      return 'Tunai'
  }
}

export interface SharedDimsumStock {
  stok_pcs: number
  stok_minimum_pcs: number
  is_low_stock: boolean
  updated_at?: string
}

export interface ProductItem {
  id_produk: number
  kode_barang: string
  nama_menu: string
  kategori: ProductCategory
  satuan: string
  isi_pcs: number
  uses_shared_dimsum_stock: boolean
  harga_modal: number
  harga_jual: number
  stok: number
  stok_minimum: number
  shared_dimsum_pcs?: number
  foto_url: string | null
  updated_at?: string
  is_low_stock?: boolean
}

export interface CartItem {
  id_produk: number
  kode_barang: string
  nama_menu: string
  kategori: ProductCategory
  satuan: string
  isi_pcs: number
  uses_shared_dimsum_stock: boolean
  harga_jual: number
  stok_tersedia: number
  foto_url: string | null
  qty: number
  catatan: string
  subtotal: number
}

export interface ReceiptItem {
  id_produk: number
  nama_menu: string
  kode_barang: string
  satuan: string
  harga_satuan: number
  qty: number
  subtotal: number
  catatan: string | null
}

export interface ReceiptData {
  no_faktur: string
  tanggal_transaksi: string
  kasir: {
    id_user: number
    nama: string
    username: string
  }
  tipe_pesanan: OrderType
  nomor_meja: string | null
  metode_pembayaran: PaymentMethod
  status_pesanan?: DriverOrderStatus | null
  kode_order_driver?: string | null
  total_harga: number
  bayar: number
  kembalian: number
  items: ReceiptItem[]
}

export interface SalesTrendPoint {
  date: string
  label: string
  omzet: number
  labaKotor: number
  totalTransaksi: number
}

export interface CategoryStatItem {
  kategori: ProductCategory
  totalTerjual: number
  totalPendapatan: number
  persentase: number
}

export interface ChannelStats {
  totalTransaksi7Hari: number
  dineInCount: number
  dineInPct: number
  takeawayCount: number
  takeawayPct: number
  qrisCount: number
  qrisPct: number
  tunaiCount: number
  tunaiPct: number
  shopeeFoodCount: number
  shopeeFoodPct: number
  goFoodCount: number
  goFoodPct: number
}

export interface TopMenuItem {
  id_produk: number
  kode_barang: string
  nama_menu: string
  kategori: ProductCategory
  satuan: string
  harga_jual: number
  total_terjual: number
  total_pendapatan: number
}

export interface DashboardSummary {
  success: boolean
  tanggal: string
  tanggalLabel: string
  dimsumStock: {
    stok_pcs: number
    stok_minimum_pcs: number
    is_low_stock: boolean
    diproduksiHariIniPcs: number
    terjualHariIniPcs: number
  }
  kpi: {
    omzetHariIni: number
    estimasiLabaKotorHariIni: number
    totalPesananHariIni: number
    totalDineInHariIni: number
    totalTakeawayHariIni: number
    totalTunaiHariIni: number
    totalQrisHariIni: number
    totalShopeeFoodHariIni: number
    totalGoFoodHariIni: number
    driverFoodAktifCount: number
    jumlahStokMenipis: number
    omzetGrowthPct: number
    pesananGrowthPct: number
    labaGrowthPct: number
  }
  trenPenjualan7Hari: SalesTrendPoint[]
  categoryStats: CategoryStatItem[]
  categoryStatsByRange?: {
    today: CategoryStatItem[]
    week: CategoryStatItem[]
    all: CategoryStatItem[]
  }
  channelStats: ChannelStats
  top5MenuTerlaris: TopMenuItem[]
  stokMenipis: ProductItem[]
}

export interface SalesHistoryTransaction extends ReceiptData {
  total_qty: number
  estimasi_laba: number
}

export interface MonthlyDailyBreakdownRow {
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
}

export interface SalesReportResponse {
  success: boolean
  mode: 'daily' | 'monthly'
  period: string
  periodLabel: string
  summary: {
    totalOmzet: number
    totalLabaKotor: number
    totalTransaksi: number
    totalItemTerjual: number
    totalTunai: number
    totalQris: number
    totalShopeeFood: number
    totalGoFood: number
    totalDineIn: number
    totalTakeaway: number
  }
  dailyBreakdown: MonthlyDailyBreakdownRow[]
  transactions: SalesHistoryTransaction[]
}

export interface DriverOrderItem extends ReceiptData {
  metode_pembayaran: DriverFoodMethod
  status_pesanan: DriverOrderStatus
  kode_order_driver: string | null
  total_qty: number
}

export interface DriverOrdersResponse {
  success: boolean
  date: string
  dateLabel: string
  pendingDimsumPcs?: number
  counts: {
    semuaAktif: number
    sedangDiolah: number
    sedangDibungkus: number
    sudahSiap: number
    diambilDriver: number
    totalHariIni: number
  }
  orders: DriverOrderItem[]
}

export type ProductionInputType = 'tambah' | 'set_harian'

export interface DailyDimsumMenuUsageRow {
  id_produk: number
  kode_barang: string
  nama_menu: string
  kategori: ProductCategory
  satuan: string
  isi_pcs: number
  qty_terjual_hari_ini: number
  pcs_terpakai_hari_ini: number
  max_porsi_tersisa: number
}

export interface ProductionLogItem {
  id_produksi: number
  id_produk: number | null
  kode_barang: string | null
  nama_menu: string
  satuan: string
  tanggal_produksi: string
  qty_produksi: number
  stok_sebelum: number
  stok_sesudah: number
  tipe_input: ProductionInputType
  catatan: string | null
  admin_nama: string
}

export interface DailyProductionResponse {
  success: boolean
  date: string
  dateLabel: string
  dimsumStock: SharedDimsumStock
  summary: {
    totalDimsumDiproduksiPcs: number
    totalDimsumTerjualPcs: number
    sisaDimsumPcs: number
    jumlahBatchHariIni: number
  }
  dimsumMenus: DailyDimsumMenuUsageRow[]
  separateStockMenus: ProductItem[]
  logs: ProductionLogItem[]
}

export const STOCK_REQUEST_STATUSES = [
  'Menunggu Admin',
  'Sedang Diproduksi',
  'Dikirim ke Kasir',
  'Diterima Kasir'
] as const

export type StockRequestStatus = (typeof STOCK_REQUEST_STATUSES)[number]

export interface StockRequestItem {
  id_request: number
  id_kasir: number
  kasir_nama: string
  kasir_username: string
  id_admin: number | null
  admin_nama: string | null
  stok_saat_lapor: number
  qty_diminta: number
  qty_dikirim: number | null
  status: StockRequestStatus
  catatan_kasir: string | null
  catatan_admin: string | null
  created_at: string
  updated_at: string
}

export interface StockRequestsResponse {
  success: boolean
  currentDimsumPcs: number
  counts: {
    menungguAdmin: number
    sedangDiproduksi: number
    dikirimKeKasir: number
    diterimaKasir: number
    aktifAdmin: number
  }
  requests: StockRequestItem[]
}

export type ShiftStatus = 'open' | 'closed'

export interface CashierShiftItem {
  id_shift: number
  id_kasir: number
  kasir_nama: string
  kasir_username: string
  waktu_buka: string
  waktu_tutup: string | null
  status: ShiftStatus
  modal_awal: number
  total_transaksi: number
  total_omzet: number
  total_tunai_sistem: number
  total_qris_sistem: number
  total_shopeefood_sistem: number
  total_gofood_sistem: number
  ekspektasi_kas_laci: number
  uang_fisik_laci: number | null
  selisih_kas: number | null
  catatan: string | null
}

export interface CurrentShiftResponse {
  success: boolean
  hasOpenShift: boolean
  activeShift: {
    id_shift: number | null
    waktu_buka: string
    modal_awal: number
    total_transaksi: number
    total_non_tunai: number
    total_qris: number
    total_shopeefood: number
    total_gofood: number
  }
  waConfigured: boolean
  recentClosedShifts: CashierShiftItem[]
}

export interface CloseShiftResponse {
  success: boolean
  message: string
  shift: CashierShiftItem
  whatsapp: {
    configured: boolean
    enabled: boolean
    waUrl: string | null
  }
}

export interface ShiftHistoryResponse {
  success: boolean
  mode: 'daily' | 'monthly'
  period: string
  summary: {
    totalShifts: number
    pasCount: number
    lebihCount: number
    kurangCount: number
    totalUangFisik: number
    totalEkspektasiKas: number
    totalSelisihBersih: number
  }
  shifts: CashierShiftItem[]
}
