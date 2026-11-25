import 'dotenv/config'
import mysql from 'mysql2/promise'

const rawUrl = process.env.DATABASE_URL
if (!rawUrl || rawUrl.includes('USER.root:PASSWORD')) {
  console.error('[ERROR] DATABASE_URL belum dikonfigurasi di file .env')
  process.exit(1)
}

const parsed = new URL(rawUrl)
const database = parsed.pathname.replace(/^\//, '')

const connection = await mysql.createConnection({
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : 4000,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: process.env.TIDB_SSL_REJECT_UNAUTHORIZED !== 'false'
  }
})

const statements = [
  {
    name: 'dimsum_stock',
    sql: `
      CREATE TABLE IF NOT EXISTS \`dimsum_stock\` (
        \`id\` int NOT NULL,
        \`stok_pcs\` int NOT NULL DEFAULT 0,
        \`stok_minimum_pcs\` int NOT NULL DEFAULT 20,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`dimsum_stock_id\` PRIMARY KEY(\`id\`)
      );
    `
  },
  {
    name: 'users',
    sql: `
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id_user\` int AUTO_INCREMENT NOT NULL,
        \`nama\` varchar(100) NOT NULL,
        \`username\` varchar(50) NOT NULL,
        \`password\` varchar(255) NOT NULL,
        \`role\` enum('admin','kasir') NOT NULL DEFAULT 'kasir',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT \`users_id_user\` PRIMARY KEY(\`id_user\`),
        CONSTRAINT \`users_username_unique\` UNIQUE(\`username\`)
      );
    `
  },
  {
    name: 'products',
    sql: `
      CREATE TABLE IF NOT EXISTS \`products\` (
        \`id_produk\` int AUTO_INCREMENT NOT NULL,
        \`kode_barang\` varchar(50) NOT NULL,
        \`nama_menu\` varchar(150) NOT NULL,
        \`kategori\` enum('Dimsum Kukus','Dimsum Goreng','Paket Mix','Minuman & Saus') NOT NULL,
        \`satuan\` varchar(30) NOT NULL DEFAULT 'Porsi',
        \`isi_pcs\` int NOT NULL DEFAULT 1,
        \`harga_modal\` decimal(12,2) NOT NULL,
        \`harga_jual\` decimal(12,2) NOT NULL,
        \`stok\` int NOT NULL DEFAULT 0,
        \`stok_minimum\` int NOT NULL DEFAULT 5,
        \`foto_url\` varchar(500),
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`products_id_produk\` PRIMARY KEY(\`id_produk\`),
        CONSTRAINT \`products_kode_barang_unique\` UNIQUE(\`kode_barang\`)
      );
    `
  },
  {
    name: 'transactions',
    sql: `
      CREATE TABLE IF NOT EXISTS \`transactions\` (
        \`no_faktur\` varchar(50) NOT NULL,
        \`id_user\` int NOT NULL,
        \`tanggal_transaksi\` datetime NOT NULL,
        \`tipe_pesanan\` enum('Dine-In','Takeaway') NOT NULL DEFAULT 'Dine-In',
        \`nomor_meja\` varchar(20),
        \`total_harga\` decimal(12,2) NOT NULL,
        \`bayar\` decimal(12,2) NOT NULL,
        \`kembalian\` decimal(12,2) NOT NULL,
        \`metode_pembayaran\` enum('Tunai','QRIS','ShopeeFood','GoFood') NOT NULL DEFAULT 'Tunai',
        \`status_pesanan\` varchar(30) NULL,
        \`kode_order_driver\` varchar(100) NULL,
        CONSTRAINT \`transactions_no_faktur\` PRIMARY KEY(\`no_faktur\`),
        CONSTRAINT \`transactions_id_user_users_id_user_fk\` FOREIGN KEY (\`id_user\`) REFERENCES \`users\`(\`id_user\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `
  },
  {
    name: 'transaction_details',
    sql: `
      CREATE TABLE IF NOT EXISTS \`transaction_details\` (
        \`id_detail\` bigint AUTO_INCREMENT NOT NULL,
        \`no_faktur\` varchar(50) NOT NULL,
        \`id_produk\` int NOT NULL,
        \`harga_satuan\` decimal(12,2) NOT NULL,
        \`qty\` int NOT NULL,
        \`subtotal\` decimal(12,2) NOT NULL,
        \`catatan\` varchar(255),
        CONSTRAINT \`transaction_details_id_detail\` PRIMARY KEY(\`id_detail\`),
        CONSTRAINT \`transaction_details_no_faktur_transactions_no_faktur_fk\` FOREIGN KEY (\`no_faktur\`) REFERENCES \`transactions\`(\`no_faktur\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`transaction_details_id_produk_products_id_produk_fk\` FOREIGN KEY (\`id_produk\`) REFERENCES \`products\`(\`id_produk\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `
  },
  {
    name: 'production_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS \`production_logs\` (
        \`id_produksi\` bigint AUTO_INCREMENT NOT NULL,
        \`id_produk\` int NULL,
        \`id_user\` int NOT NULL,
        \`tanggal_produksi\` datetime NOT NULL,
        \`qty_produksi\` int NOT NULL,
        \`stok_sebelum\` int NOT NULL,
        \`stok_sesudah\` int NOT NULL,
        \`tipe_input\` enum('tambah','set_harian') NOT NULL DEFAULT 'tambah',
        \`catatan\` varchar(255),
        CONSTRAINT \`production_logs_id_produksi\` PRIMARY KEY(\`id_produksi\`),
        CONSTRAINT \`production_logs_id_produk_products_id_produk_fk\` FOREIGN KEY (\`id_produk\`) REFERENCES \`products\`(\`id_produk\`) ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT \`production_logs_id_user_users_id_user_fk\` FOREIGN KEY (\`id_user\`) REFERENCES \`users\`(\`id_user\`) ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `
  },
  {
    name: 'uploaded_files',
    sql: `
      CREATE TABLE IF NOT EXISTS \`uploaded_files\` (
        \`filename\` varchar(180) NOT NULL,
        \`mime_type\` varchar(80) NOT NULL,
        \`data_base64\` longtext NOT NULL,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`uploaded_files_filename\` PRIMARY KEY(\`filename\`)
      );
    `
  },
  {
    name: 'stock_requests',
    sql: `
      CREATE TABLE IF NOT EXISTS \`stock_requests\` (
        \`id_request\` bigint AUTO_INCREMENT NOT NULL,
        \`id_kasir\` int NOT NULL,
        \`id_admin\` int NULL,
        \`stok_saat_lapor\` int NOT NULL DEFAULT 0,
        \`qty_diminta\` int NOT NULL,
        \`qty_dikirim\` int NULL,
        \`status\` enum('Menunggu Admin','Sedang Diproduksi','Dikirim ke Kasir','Diterima Kasir') NOT NULL DEFAULT 'Menunggu Admin',
        \`catatan_kasir\` varchar(255) NULL,
        \`catatan_admin\` varchar(255) NULL,
        \`created_at\` datetime NOT NULL,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`stock_requests_id_request\` PRIMARY KEY(\`id_request\`),
        CONSTRAINT \`stock_requests_id_kasir_fk\` FOREIGN KEY (\`id_kasir\`) REFERENCES \`users\`(\`id_user\`) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT \`stock_requests_id_admin_fk\` FOREIGN KEY (\`id_admin\`) REFERENCES \`users\`(\`id_user\`) ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `
  }
]

try {
  for (const item of statements) {
    await connection.query(item.sql)
    console.log(`[OK] Tabel "${item.name}" siap.`)
  }

  await connection.query(`
    INSERT IGNORE INTO \`dimsum_stock\` (\`id\`, \`stok_pcs\`, \`stok_minimum_pcs\`)
    VALUES (1, 200, 20);
  `)

  const [cols] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'isi_pcs'
  `)
  if (Array.isArray(cols) && cols.length === 0) {
    await connection.query('ALTER TABLE `products` ADD COLUMN `isi_pcs` int NOT NULL DEFAULT 1 AFTER `satuan`;')
    await connection.query("UPDATE `products` SET `isi_pcs` = 0 WHERE `kategori` = 'Minuman & Saus';")
    await connection.query("UPDATE `products` SET `isi_pcs` = 10 WHERE `nama_menu` LIKE '%10 Pcs%' AND `kategori` != 'Minuman & Saus';")
    console.log('[OK] Kolom "isi_pcs" ditambahkan pada tabel products.')
  }

  const [prodLogCols] = await connection.query(`
    SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'production_logs' AND COLUMN_NAME = 'id_produk'
  `)
  if (Array.isArray(prodLogCols) && prodLogCols[0]?.IS_NULLABLE === 'NO') {
    await connection.query('ALTER TABLE `production_logs` MODIFY COLUMN `id_produk` int NULL;')
    console.log('[OK] Kolom "production_logs.id_produk" diubah menjadi nullable.')
  }

  const [trxCols] = await connection.query(`
    SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME IN ('metode_pembayaran', 'status_pesanan', 'kode_order_driver')
  `)
  const trxColMap = new Map(Array.isArray(trxCols) ? trxCols.map(r => [r.COLUMN_NAME, String(r.COLUMN_TYPE || '')]) : [])
  if (trxColMap.get('metode_pembayaran') && !trxColMap.get('metode_pembayaran').includes('ShopeeFood')) {
    await connection.query("ALTER TABLE `transactions` MODIFY COLUMN `metode_pembayaran` enum('Tunai','QRIS','ShopeeFood','GoFood') NOT NULL DEFAULT 'Tunai';")
    console.log('[OK] Enum metode_pembayaran diperbarui (Tunai, QRIS, ShopeeFood, GoFood).')
  }
  if (!trxColMap.has('status_pesanan')) {
    await connection.query('ALTER TABLE `transactions` ADD COLUMN `status_pesanan` varchar(30) NULL AFTER `metode_pembayaran`;')
    console.log('[OK] Kolom "transactions.status_pesanan" ditambahkan.')
  }
  if (!trxColMap.has('kode_order_driver')) {
    await connection.query('ALTER TABLE `transactions` ADD COLUMN `kode_order_driver` varchar(100) NULL AFTER `status_pesanan`;')
    console.log('[OK] Kolom "transactions.kode_order_driver" ditambahkan.')
  }

  console.log('\n[SUKSES] Semua tabel & kolom stok dimsum bersama siap di TiDB Cloud (tanpa hapus data)!')
} finally {
  await connection.end()
}
