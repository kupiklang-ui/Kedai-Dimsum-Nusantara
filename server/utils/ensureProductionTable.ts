import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from '../database'

let schemaEnsured = false

export function isSharedDimsumCategory(kategori: string): boolean {
  return kategori !== 'Minuman & Saus'
}

/**
 * Transaksi dihitung sebagai pemasukan & stok terjual jika:
 * - Pembayaran walk-in (Tunai / QRIS), ATAU
 * - Pesanan Driver Food (ShopeeFood / GoFood) yang statusnya sudah 'Diambil Driver'.
 */
export function isFinalizedTransaction(metodePembayaran: string, statusPesanan: string | null | undefined): boolean {
  if (metodePembayaran === 'ShopeeFood' || metodePembayaran === 'GoFood') {
    return statusPesanan === 'Diambil Driver'
  }
  return true
}

export async function ensureProductionLogsTable(): Promise<void> {
  if (schemaEnsured) {
    return
  }

  const pool = getPool()

  // 1. Pastikan tabel global dimsum_stock tersedia (1 baris master id = 1)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`dimsum_stock\` (
      \`id\` int NOT NULL,
      \`stok_pcs\` int NOT NULL DEFAULT 0,
      \`stok_minimum_pcs\` int NOT NULL DEFAULT 20,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`dimsum_stock_id\` PRIMARY KEY(\`id\`)
    );
  `)

  await pool.query(`
    INSERT IGNORE INTO \`dimsum_stock\` (\`id\`, \`stok_pcs\`, \`stok_minimum_pcs\`)
    VALUES (1, 200, 20);
  `)

  // 2. Pastikan kolom isi_pcs tersedia pada tabel products
  const [cols] = await pool.query<RowDataPacket[]>(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'isi_pcs'
  `)

  if (!Array.isArray(cols) || cols.length === 0) {
    await pool.query(`
      ALTER TABLE \`products\`
      ADD COLUMN \`isi_pcs\` int NOT NULL DEFAULT 1 AFTER \`satuan\`;
    `)

    // Set default isi_pcs yang masuk akal untuk data awal yang sudah ada
    await pool.query(`
      UPDATE \`products\`
      SET \`isi_pcs\` = 0
      WHERE \`kategori\` = 'Minuman & Saus';
    `)

    await pool.query(`
      UPDATE \`products\`
      SET \`isi_pcs\` = 10
      WHERE \`nama_menu\` LIKE '%10 Pcs%' AND \`kategori\` != 'Minuman & Saus';
    `)
  }

  // 3. Pastikan tabel production_logs tersedia & kolom id_produk boleh NULL (untuk stok dimsum global)
  await pool.query(`
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
  `)

  const [prodLogCols] = await pool.query<RowDataPacket[]>(`
    SELECT IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'production_logs'
      AND COLUMN_NAME = 'id_produk'
  `)

  if (Array.isArray(prodLogCols) && prodLogCols[0]?.IS_NULLABLE === 'NO') {
    await pool.query(`
      ALTER TABLE \`production_logs\`
      MODIFY COLUMN \`id_produk\` int NULL;
    `)
  }

  // 4. Pastikan transaksi mendukung ShopeeFood & GoFood + status pengolahan driver food
  const [trxCols] = await pool.query<RowDataPacket[]>(`
    SELECT COLUMN_NAME, COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'transactions'
      AND COLUMN_NAME IN ('metode_pembayaran', 'status_pesanan', 'kode_order_driver')
  `)

  const colMap = new Map<string, string>()
  if (Array.isArray(trxCols)) {
    for (const row of trxCols) {
      colMap.set(String(row.COLUMN_NAME), String(row.COLUMN_TYPE || ''))
    }
  }

  const paymentColType = colMap.get('metode_pembayaran') || ''
  if (paymentColType && (!paymentColType.includes('ShopeeFood') || !paymentColType.includes('GoFood'))) {
    await pool.query(`
      ALTER TABLE \`transactions\`
      MODIFY COLUMN \`metode_pembayaran\` enum('Tunai','QRIS','ShopeeFood','GoFood') NOT NULL DEFAULT 'Tunai';
    `)
  }

  if (!colMap.has('status_pesanan')) {
    await pool.query(`
      ALTER TABLE \`transactions\`
      ADD COLUMN \`status_pesanan\` varchar(30) NULL AFTER \`metode_pembayaran\`;
    `)
  }

  if (!colMap.has('kode_order_driver')) {
    await pool.query(`
      ALTER TABLE \`transactions\`
      ADD COLUMN \`kode_order_driver\` varchar(100) NULL AFTER \`status_pesanan\`;
    `)
  }

  // 5. Pastikan tabel stock_requests tersedia untuk pengajuan & pengiriman stok Kasir <-> Admin
  await pool.query(`
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
  `)

  // 6. Pastikan tabel cashier_shifts tersedia untuk Tutup Kasir / Closing & Rekap Laci
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`cashier_shifts\` (
      \`id_shift\` bigint AUTO_INCREMENT NOT NULL,
      \`id_kasir\` int NOT NULL,
      \`waktu_buka\` datetime NOT NULL,
      \`waktu_tutup\` datetime NULL,
      \`status\` enum('open','closed') NOT NULL DEFAULT 'open',
      \`modal_awal\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`total_transaksi\` int NOT NULL DEFAULT 0,
      \`total_omzet\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`total_tunai_sistem\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`total_qris_sistem\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`total_shopeefood_sistem\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`total_gofood_sistem\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`ekspektasi_kas_laci\` decimal(12,2) NOT NULL DEFAULT 0.00,
      \`uang_fisik_laci\` decimal(12,2) NULL,
      \`selisih_kas\` decimal(12,2) NULL,
      \`catatan\` varchar(255) NULL,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT \`cashier_shifts_id_shift\` PRIMARY KEY(\`id_shift\`),
      CONSTRAINT \`cashier_shifts_id_kasir_fk\` FOREIGN KEY (\`id_kasir\`) REFERENCES \`users\`(\`id_user\`) ON DELETE NO ACTION ON UPDATE NO ACTION
    );
  `)

  schemaEnsured = true
}
