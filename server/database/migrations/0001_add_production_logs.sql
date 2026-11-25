CREATE TABLE `production_logs` (
	`id_produksi` bigint AUTO_INCREMENT NOT NULL,
	`id_produk` int NOT NULL,
	`id_user` int NOT NULL,
	`tanggal_produksi` datetime NOT NULL,
	`qty_produksi` int NOT NULL,
	`stok_sebelum` int NOT NULL,
	`stok_sesudah` int NOT NULL,
	`tipe_input` enum('tambah','set_harian') NOT NULL DEFAULT 'tambah',
	`catatan` varchar(255),
	CONSTRAINT `production_logs_id_produksi` PRIMARY KEY(`id_produksi`)
);
--> statement-breakpoint
ALTER TABLE `production_logs` ADD CONSTRAINT `production_logs_id_produk_products_id_produk_fk` FOREIGN KEY (`id_produk`) REFERENCES `products`(`id_produk`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_logs` ADD CONSTRAINT `production_logs_id_user_users_id_user_fk` FOREIGN KEY (`id_user`) REFERENCES `users`(`id_user`) ON DELETE no action ON UPDATE no action;