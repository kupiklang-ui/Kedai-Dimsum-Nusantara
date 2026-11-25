import { relations } from 'drizzle-orm'
import {
  bigint,
  datetime,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar
} from 'drizzle-orm/mysql-core'

export const USER_ROLES = ['admin', 'kasir'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const PRODUCT_CATEGORIES = [
  'Dimsum Kukus',
  'Dimsum Goreng',
  'Paket Mix',
  'Minuman & Saus'
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const ORDER_TYPES = ['Dine-In', 'Takeaway'] as const
export type OrderType = (typeof ORDER_TYPES)[number]

export const PAYMENT_METHODS = ['Tunai', 'QRIS', 'ShopeeFood', 'GoFood'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const DRIVER_FOOD_METHODS = ['ShopeeFood', 'GoFood'] as const
export type DriverFoodMethod = (typeof DRIVER_FOOD_METHODS)[number]

export const DRIVER_ORDER_STATUSES = [
  'Sedang Diolah',
  'Sedang Dibungkus',
  'Sudah Siap',
  'Diambil Driver'
] as const
export type DriverOrderStatus = (typeof DRIVER_ORDER_STATUSES)[number]

export const PRODUCTION_INPUT_TYPES = ['tambah', 'set_harian'] as const
export type ProductionInputType = (typeof PRODUCTION_INPUT_TYPES)[number]

export const STOCK_REQUEST_STATUSES = [
  'Menunggu Admin',
  'Sedang Diproduksi',
  'Dikirim ke Kasir',
  'Diterima Kasir'
] as const
export type StockRequestStatus = (typeof STOCK_REQUEST_STATUSES)[number]

export const SHIFT_STATUSES = ['open', 'closed'] as const
export type ShiftStatus = (typeof SHIFT_STATUSES)[number]

export const dimsumStock = mysqlTable('dimsum_stock', {
  id: int('id').primaryKey(),
  stok_pcs: int('stok_pcs').notNull().default(0),
  stok_minimum_pcs: int('stok_minimum_pcs').notNull().default(20),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull()
})

export const users = mysqlTable('users', {
  id_user: int('id_user').autoincrement().primaryKey(),
  nama: varchar('nama', { length: 100 }).notNull(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: mysqlEnum('role', USER_ROLES).notNull().default('kasir'),
  created_at: timestamp('created_at').defaultNow().notNull()
})

export const products = mysqlTable('products', {
  id_produk: int('id_produk').autoincrement().primaryKey(),
  kode_barang: varchar('kode_barang', { length: 50 }).notNull().unique(),
  nama_menu: varchar('nama_menu', { length: 150 }).notNull(),
  kategori: mysqlEnum('kategori', PRODUCT_CATEGORIES).notNull(),
  satuan: varchar('satuan', { length: 30 }).notNull().default('Porsi'),
  isi_pcs: int('isi_pcs').notNull().default(1),
  harga_modal: decimal('harga_modal', { precision: 12, scale: 2 }).notNull(),
  harga_jual: decimal('harga_jual', { precision: 12, scale: 2 }).notNull(),
  stok: int('stok').notNull().default(0),
  stok_minimum: int('stok_minimum').notNull().default(5),
  foto_url: varchar('foto_url', { length: 500 }),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull()
})

export const transactions = mysqlTable('transactions', {
  no_faktur: varchar('no_faktur', { length: 50 }).primaryKey(),
  id_user: int('id_user')
    .notNull()
    .references(() => users.id_user),
  tanggal_transaksi: datetime('tanggal_transaksi').notNull(),
  tipe_pesanan: mysqlEnum('tipe_pesanan', ORDER_TYPES).notNull().default('Dine-In'),
  nomor_meja: varchar('nomor_meja', { length: 20 }),
  total_harga: decimal('total_harga', { precision: 12, scale: 2 }).notNull(),
  bayar: decimal('bayar', { precision: 12, scale: 2 }).notNull(),
  kembalian: decimal('kembalian', { precision: 12, scale: 2 }).notNull(),
  metode_pembayaran: mysqlEnum('metode_pembayaran', PAYMENT_METHODS).notNull().default('Tunai'),
  status_pesanan: varchar('status_pesanan', { length: 30 }),
  kode_order_driver: varchar('kode_order_driver', { length: 100 })
})

export const transactionDetails = mysqlTable('transaction_details', {
  id_detail: bigint('id_detail', { mode: 'number' }).autoincrement().primaryKey(),
  no_faktur: varchar('no_faktur', { length: 50 })
    .notNull()
    .references(() => transactions.no_faktur, { onDelete: 'cascade' }),
  id_produk: int('id_produk')
    .notNull()
    .references(() => products.id_produk),
  harga_satuan: decimal('harga_satuan', { precision: 12, scale: 2 }).notNull(),
  qty: int('qty').notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  catatan: varchar('catatan', { length: 255 })
})

export const productionLogs = mysqlTable('production_logs', {
  id_produksi: bigint('id_produksi', { mode: 'number' }).autoincrement().primaryKey(),
  id_produk: int('id_produk')
    .references(() => products.id_produk),
  id_user: int('id_user')
    .notNull()
    .references(() => users.id_user),
  tanggal_produksi: datetime('tanggal_produksi').notNull(),
  qty_produksi: int('qty_produksi').notNull(),
  stok_sebelum: int('stok_sebelum').notNull(),
  stok_sesudah: int('stok_sesudah').notNull(),
  tipe_input: mysqlEnum('tipe_input', PRODUCTION_INPUT_TYPES).notNull().default('tambah'),
  catatan: varchar('catatan', { length: 255 })
})

export const stockRequests = mysqlTable('stock_requests', {
  id_request: bigint('id_request', { mode: 'number' }).autoincrement().primaryKey(),
  id_kasir: int('id_kasir')
    .notNull()
    .references(() => users.id_user),
  id_admin: int('id_admin')
    .references(() => users.id_user),
  stok_saat_lapor: int('stok_saat_lapor').notNull().default(0),
  qty_diminta: int('qty_diminta').notNull(),
  qty_dikirim: int('qty_dikirim'),
  status: mysqlEnum('status', STOCK_REQUEST_STATUSES).notNull().default('Menunggu Admin'),
  catatan_kasir: varchar('catatan_kasir', { length: 255 }),
  catatan_admin: varchar('catatan_admin', { length: 255 }),
  created_at: datetime('created_at').notNull(),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull()
})

export const cashierShifts = mysqlTable('cashier_shifts', {
  id_shift: bigint('id_shift', { mode: 'number' }).autoincrement().primaryKey(),
  id_kasir: int('id_kasir')
    .notNull()
    .references(() => users.id_user),
  waktu_buka: datetime('waktu_buka').notNull(),
  waktu_tutup: datetime('waktu_tutup'),
  status: mysqlEnum('status', SHIFT_STATUSES).notNull().default('open'),
  modal_awal: decimal('modal_awal', { precision: 12, scale: 2 }).notNull().default('0.00'),
  total_transaksi: int('total_transaksi').notNull().default(0),
  total_omzet: decimal('total_omzet', { precision: 12, scale: 2 }).notNull().default('0.00'),
  total_tunai_sistem: decimal('total_tunai_sistem', { precision: 12, scale: 2 }).notNull().default('0.00'),
  total_qris_sistem: decimal('total_qris_sistem', { precision: 12, scale: 2 }).notNull().default('0.00'),
  total_shopeefood_sistem: decimal('total_shopeefood_sistem', { precision: 12, scale: 2 }).notNull().default('0.00'),
  total_gofood_sistem: decimal('total_gofood_sistem', { precision: 12, scale: 2 }).notNull().default('0.00'),
  ekspektasi_kas_laci: decimal('ekspektasi_kas_laci', { precision: 12, scale: 2 }).notNull().default('0.00'),
  uang_fisik_laci: decimal('uang_fisik_laci', { precision: 12, scale: 2 }),
  selisih_kas: decimal('selisih_kas', { precision: 12, scale: 2 }),
  catatan: varchar('catatan', { length: 255 }),
  updated_at: timestamp('updated_at').defaultNow().onUpdateNow().notNull()
})

export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  productionLogs: many(productionLogs)
}))

export const productsRelations = relations(products, ({ many }) => ({
  transactionDetails: many(transactionDetails),
  productionLogs: many(productionLogs)
}))

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, {
    fields: [transactions.id_user],
    references: [users.id_user]
  }),
  details: many(transactionDetails)
}))

export const transactionDetailsRelations = relations(transactionDetails, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionDetails.no_faktur],
    references: [transactions.no_faktur]
  }),
  product: one(products, {
    fields: [transactionDetails.id_produk],
    references: [products.id_produk]
  })
}))

export const productionLogsRelations = relations(productionLogs, ({ one }) => ({
  product: one(products, {
    fields: [productionLogs.id_produk],
    references: [products.id_produk]
  }),
  user: one(users, {
    fields: [productionLogs.id_user],
    references: [users.id_user]
  })
}))

export type DimsumStock = typeof dimsumStock.$inferSelect
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type TransactionDetail = typeof transactionDetails.$inferSelect
export type NewTransactionDetail = typeof transactionDetails.$inferInsert
export type ProductionLog = typeof productionLogs.$inferSelect
export type NewProductionLog = typeof productionLogs.$inferInsert
