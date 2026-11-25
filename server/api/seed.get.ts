import { eq } from 'drizzle-orm'
import { getDb } from '../database'
import { products, users, type NewProduct, type UserRole } from '../database/schema'
import { ensureProductionLogsTable } from '../utils/ensureProductionTable'
import { hashPassword } from '../utils/password'

interface SeedAccount {
  nama: string
  username: string
  plainPassword: string
  role: UserRole
}

const INITIAL_ACCOUNTS: SeedAccount[] = [
  {
    nama: 'Administrator Kedai',
    username: 'admin',
    plainPassword: 'admin123',
    role: 'admin'
  },
  {
    nama: 'Kasir Utama',
    username: 'kasir',
    plainPassword: 'kasir123',
    role: 'kasir'
  }
]

const INITIAL_PRODUCTS: NewProduct[] = [
  {
    kode_barang: 'DSM-001',
    nama_menu: 'Siomay Ayam',
    kategori: 'Dimsum Kukus',
    satuan: 'Pcs',
    isi_pcs: 1,
    harga_modal: '2500.00',
    harga_jual: '4500.00',
    stok: 0,
    stok_minimum: 5,
    foto_url: null
  },
  {
    kode_barang: 'DSM-002',
    nama_menu: 'Hakau Udang',
    kategori: 'Dimsum Kukus',
    satuan: 'Pcs',
    isi_pcs: 1,
    harga_modal: '3000.00',
    harga_jual: '5500.00',
    stok: 0,
    stok_minimum: 5,
    foto_url: null
  },
  {
    kode_barang: 'DSM-003',
    nama_menu: 'Dimsum Mentai',
    kategori: 'Dimsum Kukus',
    satuan: 'Pcs',
    isi_pcs: 1,
    harga_modal: '3500.00',
    harga_jual: '6500.00',
    stok: 0,
    stok_minimum: 5,
    foto_url: null
  },
  {
    kode_barang: 'DSM-004',
    nama_menu: 'Lumpia Kulit Tahu',
    kategori: 'Dimsum Goreng',
    satuan: 'Pcs',
    isi_pcs: 1,
    harga_modal: '3000.00',
    harga_jual: '5000.00',
    stok: 0,
    stok_minimum: 5,
    foto_url: null
  },
  {
    kode_barang: 'DSM-005',
    nama_menu: 'Paket Mix 10 Pcs',
    kategori: 'Paket Mix',
    satuan: 'Paket',
    isi_pcs: 10,
    harga_modal: '24000.00',
    harga_jual: '42000.00',
    stok: 0,
    stok_minimum: 5,
    foto_url: null
  },
  {
    kode_barang: 'DSM-006',
    nama_menu: 'Pangsit Goreng',
    kategori: 'Dimsum Goreng',
    satuan: 'Pcs',
    isi_pcs: 1,
    harga_modal: '2500.00',
    harga_jual: '4500.00',
    stok: 0,
    stok_minimum: 5,
    foto_url: null
  },
  {
    kode_barang: 'DSM-007',
    nama_menu: 'Extra Chili Oil',
    kategori: 'Minuman & Saus',
    satuan: 'Cup',
    isi_pcs: 0,
    harga_modal: '2000.00',
    harga_jual: '5000.00',
    stok: 40,
    stok_minimum: 10,
    foto_url: null
  },
  {
    kode_barang: 'DSM-008',
    nama_menu: 'Es Teh Manis',
    kategori: 'Minuman & Saus',
    satuan: 'Gelas',
    isi_pcs: 0,
    harga_modal: '2500.00',
    harga_jual: '7000.00',
    stok: 50,
    stok_minimum: 10,
    foto_url: null
  }
]

export default defineEventHandler(async () => {
  const db = getDb()
  await ensureProductionLogsTable()

  let usersInserted = 0
  let usersSkipped = 0
  let productsInserted = 0
  let productsSkipped = 0

  for (const account of INITIAL_ACCOUNTS) {
    const existing = await db
      .select({ id_user: users.id_user })
      .from(users)
      .where(eq(users.username, account.username))
      .limit(1)

    if (existing.length > 0) {
      usersSkipped++
      continue
    }

    const hashedPassword = await hashPassword(account.plainPassword)
    await db.insert(users).values({
      nama: account.nama,
      username: account.username,
      password: hashedPassword,
      role: account.role
    })
    usersInserted++
  }

  for (const item of INITIAL_PRODUCTS) {
    const existing = await db
      .select({ id_produk: products.id_produk })
      .from(products)
      .where(eq(products.kode_barang, item.kode_barang))
      .limit(1)

    if (existing.length > 0) {
      productsSkipped++
      continue
    }

    await db.insert(products).values(item)
    productsInserted++
  }

  return {
    success: true,
    message: 'Seeding database UMKM Dimsum selesai dijalankan.',
    summary: {
      usersInserted,
      usersSkipped,
      productsInserted,
      productsSkipped
    },
    seededAccounts: [
      { username: 'admin', role: 'admin' },
      { username: 'kasir', role: 'kasir' }
    ],
    totalInitialProducts: INITIAL_PRODUCTS.length
  }
})
