CREATE TABLE `products` (
	`id_produk` int AUTO_INCREMENT NOT NULL,
	`kode_barang` varchar(50) NOT NULL,
	`nama_menu` varchar(150) NOT NULL,
	`kategori` enum('Dimsum Kukus','Dimsum Goreng','Paket Mix','Minuman & Saus') NOT NULL,
	`satuan` varchar(30) NOT NULL DEFAULT 'Porsi',
	`harga_modal` decimal(12,2) NOT NULL,
	`harga_jual` decimal(12,2) NOT NULL,
	`stok` int NOT NULL DEFAULT 0,
	`stok_minimum` int NOT NULL DEFAULT 5,
	`foto_url` varchar(500),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id_produk` PRIMARY KEY(`id_produk`),
	CONSTRAINT `products_kode_barang_unique` UNIQUE(`kode_barang`)
);
--> statement-breakpoint
CREATE TABLE `transaction_details` (
	`id_detail` bigint AUTO_INCREMENT NOT NULL,
	`no_faktur` varchar(50) NOT NULL,
	`id_produk` int NOT NULL,
	`harga_satuan` decimal(12,2) NOT NULL,
	`qty` int NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`catatan` varchar(255),
	CONSTRAINT `transaction_details_id_detail` PRIMARY KEY(`id_detail`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`no_faktur` varchar(50) NOT NULL,
	`id_user` int NOT NULL,
	`tanggal_transaksi` datetime NOT NULL,
	`tipe_pesanan` enum('Dine-In','Takeaway') NOT NULL DEFAULT 'Dine-In',
	`nomor_meja` varchar(20),
	`total_harga` decimal(12,2) NOT NULL,
	`bayar` decimal(12,2) NOT NULL,
	`kembalian` decimal(12,2) NOT NULL,
	`metode_pembayaran` enum('Tunai','QRIS') NOT NULL DEFAULT 'Tunai',
	CONSTRAINT `transactions_no_faktur` PRIMARY KEY(`no_faktur`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id_user` int AUTO_INCREMENT NOT NULL,
	`nama` varchar(100) NOT NULL,
	`username` varchar(50) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('admin','kasir') NOT NULL DEFAULT 'kasir',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id_user` PRIMARY KEY(`id_user`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `transaction_details` ADD CONSTRAINT `transaction_details_no_faktur_transactions_no_faktur_fk` FOREIGN KEY (`no_faktur`) REFERENCES `transactions`(`no_faktur`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_details` ADD CONSTRAINT `transaction_details_id_produk_products_id_produk_fk` FOREIGN KEY (`id_produk`) REFERENCES `products`(`id_produk`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_id_user_users_id_user_fk` FOREIGN KEY (`id_user`) REFERENCES `users`(`id_user`) ON DELETE no action ON UPDATE no action;