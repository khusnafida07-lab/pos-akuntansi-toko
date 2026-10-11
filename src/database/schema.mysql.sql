-- ========================================================
-- SISTEM POS & AKUNTANSI TOKO - DATABASE SCHEMA (MYSQL)
-- ========================================================

CREATE DATABASE IF NOT EXISTS pos_accounting_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pos_accounting_db;

-- 1. TABEL PENGGUNA (USERS & RBAC)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  role ENUM(
    'Owner',
    'Kepala Toko',
    'Bagian Keuangan',
    'Akunting',
    'Kepala Gudang',
    'Kasir',
    'Sales'
  ) NOT NULL,
  phone VARCHAR(20) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- 2. TABEL BAGAN AKUN (CHART OF ACCOUNTS)
CREATE TABLE IF NOT EXISTS accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_code VARCHAR(20) NOT NULL UNIQUE,
  account_name VARCHAR(100) NOT NULL,
  account_type ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
  normal_balance ENUM('DEBIT', 'CREDIT') NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_accounts_type (account_type)
) ENGINE=InnoDB;

-- 3. TABEL KATEGORI PRODUK
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. TABEL PRODUK & INVENTORI
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  barcode VARCHAR(50) NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category_id INT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  buy_price DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  sell_price DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  current_stock INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 5,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_products_sku (sku),
  INDEX idx_products_barcode (barcode)
) ENGINE=InnoDB;

-- 5. TABEL KONTAK (PELANGGAN & SUPPLIER)
CREATE TABLE IF NOT EXISTS contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('CUSTOMER', 'SUPPLIER') NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(25) NULL,
  email VARCHAR(100) NULL,
  address TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. TABEL TRANSAKSI
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN') NOT NULL,
  date DATETIME DEFAULT CURRENT_TIMESTAMP,
  contact_id INT NULL,
  user_id INT NOT NULL,
  subtotal DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  discount_approved_by INT NULL,
  tax_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('CASH', 'TRANSFER', 'CREDIT') NOT NULL,
  payment_status ENUM('PAID', 'PARTIAL', 'UNPAID') NOT NULL,
  paid_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  change_amount DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  status ENUM('COMPLETED', 'VOID', 'PENDING_APPROVAL') NOT NULL,
  void_reason TEXT NULL,
  void_approved_by INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (discount_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (void_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_transactions_type (type),
  INDEX idx_transactions_date (date)
) ENGINE=InnoDB;

-- 7. TABEL ITEM TRANSAKSI
CREATE TABLE IF NOT EXISTS transaction_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL,
  unit_price DECIMAL(14, 2) NOT NULL,
  discount_item DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  subtotal DECIMAL(14, 2) NOT NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- 8. TABEL KARTU STOK / MUTASI STOK
CREATE TABLE IF NOT EXISTS stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  movement_type ENUM(
    'IN_PURCHASE',
    'OUT_SALE',
    'IN_RETURN',
    'OUT_RETURN',
    'OPNAME_ADJUSTMENT',
    'WRITE_OFF'
  ) NOT NULL,
  reference_no VARCHAR(50) NULL,
  qty_change INT NOT NULL,
  stock_before INT NOT NULL,
  stock_after INT NOT NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_stock_movements_prod (product_id)
) ENGINE=InnoDB;

-- 9. TABEL STOK OPNAME
CREATE TABLE IF NOT EXISTS stock_opnames (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opname_no VARCHAR(50) NOT NULL UNIQUE,
  opname_date DATE NOT NULL,
  status ENUM('DRAFT', 'APPROVED', 'REJECTED') NOT NULL,
  notes TEXT NULL,
  conducted_by INT NOT NULL,
  approved_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conducted_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_opname_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  opname_id INT NOT NULL,
  product_id INT NOT NULL,
  system_stock INT NOT NULL,
  physical_stock INT NOT NULL,
  difference INT NOT NULL,
  notes TEXT NULL,
  FOREIGN KEY (opname_id) REFERENCES stock_opnames(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- 10. TABEL HAPUS BUKU / WRITE-OFF
CREATE TABLE IF NOT EXISTS write_offs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  write_off_no VARCHAR(50) NOT NULL UNIQUE,
  date DATE NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED') NOT NULL,
  requested_by INT NOT NULL,
  approved_by INT NULL,
  total_loss_value DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS write_off_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  write_off_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL,
  unit_cost DECIMAL(14, 2) NOT NULL,
  total_cost DECIMAL(14, 2) NOT NULL,
  FOREIGN KEY (write_off_id) REFERENCES write_offs(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- 11. TABEL PEMBAYARAN & LIKUIDITAS
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_no VARCHAR(50) NOT NULL UNIQUE,
  transaction_id INT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  account_id INT NOT NULL,
  payment_type ENUM('RECEIPT_PIUTANG', 'PAYMENT_UTANG', 'DIRECT_PAYMENT') NOT NULL,
  reference_notes TEXT NULL,
  received_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (received_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- 12. TABEL JURNAL UMUM
CREATE TABLE IF NOT EXISTS journal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  journal_no VARCHAR(50) NOT NULL UNIQUE,
  entry_date DATE NOT NULL,
  reference_type ENUM(
    'SALE',
    'PURCHASE',
    'SALE_RETURN',
    'PURCHASE_RETURN',
    'WRITE_OFF',
    'OPNAME_ADJUSTMENT',
    'PAYMENT',
    'MANUAL'
  ) NULL,
  reference_id INT NULL,
  description TEXT NOT NULL,
  status ENUM('DRAFT', 'POSTED') NOT NULL,
  posted_by INT NULL,
  posted_at DATETIME NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_journal_entries_date (entry_date)
) ENGINE=InnoDB;

-- 13. TABEL BARIS JURNAL
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id INT NOT NULL,
  account_id INT NOT NULL,
  debit DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  credit DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
  memo TEXT NULL,
  FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  INDEX idx_journal_lines_account (account_id)
) ENGINE=InnoDB;
