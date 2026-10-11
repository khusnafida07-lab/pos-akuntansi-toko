# Sistem Aplikasi POS & Akuntansi Toko (Multi-Role RBAC - MySQL Laragon)

> **Tugas / Proyek:** Fondasi Awal Sistem POS & Akuntansi Toko Terintegrasi  
> **Backend Database:** MySQL / MariaDB (Siap pakai dengan Laragon)  
> **Fitur Inti:** Role-Based Access Control (7 Peran), Transaksi Kasir POS, Inventori & Gudang, Akuntansi Double-Entry, dan Pelaporan Keuangan.

---

## 📌 Ringkasan Sistem & Arsitektur

Aplikasi ini dibangun sesuai rancangan sistem:
```text
Hak Akses (RBAC) ➔ Transaksi ➔ Persediaan & Akuntansi ➔ Laporan ➔ Keputusan Bisnis
```

1. **Aktor & Hak Akses (RBAC 7 Role):**
   - **👑 Owner:** Dasbor kinerja eksekutif, laporan keuangan (Neraca, Laba Rugi, Arus Kas), rekap persediaan, dan manajemen pengguna.
   - **🏬 Kepala Toko:** Supervisi toko & pusat otorisasi (diskon khusus, pembatalan/void struk, dan persetujuan hapus buku inventori).
   - **💳 Bagian Keuangan:** Likuiditas kas & bank, piutang pelanggan (AR), utang supplier (AP), dan arus kas.
   - **📊 Akunting:** Bagan akun (COA), jurnal umum double-entry, buku besar (general ledger), neraca saldo, dan laporan laba rugi & neraca.
   - **📦 Kepala Gudang:** Master data produk, penerimaan barang pembelian supplier, kartu stok, stok opname (fisik vs sistem), dan permohonan hapus buku (write-off).
   - **🛒 Kasir:** Front-office register kasir POS, kalkulator kembalian, cetak struk, dan permohonan void transaksi.
   - **💼 Sales:** Pencatatan order pelanggan (Sales Order), cek ketersediaan stok produk langsung, dan buku kontak.

2. **Integrasi Transaksi, Inventori & Akuntansi Otomatis:**
   - Ketika **Kasir memproses penjualan**, sistem secara otomatis:
     1. Memotong stok fisik produk (`products.current_stock`).
     2. Mencatat kartu stok masuk/keluar (`stock_movements`).
     3. Menghasilkan **Jurnal Umum Double-Entry Seimbang**:
        - `Debit`: Kas Toko / Bank / Piutang Usaha
        - `Kredit`: Pendapatan Penjualan
        - `Debit`: Harga Pokok Penjualan (HPP)
        - `Kredit`: Persediaan Barang Dagang
   - Ketika **Kepala Toko menyetujui VOID**:
     1. Status transaksi diubah menjadi `VOID`.
     2. Stok produk dikembalikan secara otomatis.
     3. Sistem menghasilkan **Jurnal Pembalik (Reversal Entry)** secara otomatis.

---

## ⚙️ Konfigurasi MySQL Laragon (`.env`)

Aplikasi menggunakan konfigurasi bawaan Laragon:
```env
PORT=3000
JWT_SECRET=super_secret_pos_accounting_jwt_key_2026

# KONEKSI LARAGON DEFAULT
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=pos_akuntansi_toko
```

Script inisialisasi database (`src/database/init-db.js`) akan:
1. Otomatis membuat database `pos_akuntansi_toko` di MySQL Laragon jika belum ada.
2. Mengeksekusi seluruh tabel DDL dari `src/database/schema.sql`.
3. Menjalankan `seeders.js` untuk membuat 7 akun default, Bagan Akun (COA), kategori, sampel produk, dan jurnal saldo awal.

---

## 📁 Struktur Folder Proyek

```text
pos-akuntansi-toko/
├── .env                           # Konfigurasi koneksi MySQL Laragon
├── .env.example                   # Contoh konfigurasi environment
├── package.json                   # Dependensi (mysql2, express, cors, jwt) & scripts
├── README.md                      # Dokumentasi sistem
├── src/
│   ├── config/
│   │   ├── config.js              # Parsing konfigurasi MySQL & server
│   │   ├── database.js            # MySQL connection pool (mysql2/promise) & transaction wrapper
│   │   └── rbac-matrix.js         # Definisi 7 Roles, Permissions & Navigasi Menu
│   ├── database/
│   │   ├── schema.sql             # Skema DDL MySQL (InnoDB, FK, Index)
│   │   ├── seeders.js             # Seeder data awal kompatibel MySQL (CURDATE/NOW)
│   │   └── init-db.js             # Script inisialisasi otomatis database MySQL Laragon
│   ├── middleware/
│   │   ├── auth.middleware.js     # Validasi JWT Bearer token
│   │   ├── rbac.middleware.js     # Guard pembatas hak akses (requireRoles & requirePermission)
│   │   └── error.middleware.js    # Penangan error terpusat
│   ├── utils/
│   │   └── crypto.utils.js        # PBKDF2 hash password & JWT sign/verify
│   ├── controllers/
│   │   ├── auth.controller.js     # Login, profile, role switcher
│   │   ├── user.controller.js     # Manajemen pengguna (Owner)
│   │   ├── product.controller.js  # Katalog produk & kategori
│   │   ├── transaction.controller.js # POS Kasir, receipt, void request & void approval
│   │   ├── inventory.controller.js   # Penerimaan PO, kartu stok, opname, write-off
│   │   ├── accounting.controller.js  # COA, jurnal umum, buku besar, neraca saldo, lap. keuangan
│   │   ├── finance.controller.js     # Likuiditas kas/bank, AR/AP, voucher pelunasan, arus kas
│   │   ├── approval.controller.js    # Pusat otorisasi Kepala Toko
│   │   └── report.controller.js      # Laporan penjualan, rekap persediaan, owner dashboard
│   ├── routes/
│   │   ├── index.js               # Root API router (/api/...)
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── product.routes.js
│   │   ├── transaction.routes.js
│   │   ├── inventory.routes.js
│   │   ├── accounting.routes.js
│   │   ├── finance.routes.js
│   │   ├── approval.routes.js
│   │   └── report.routes.js
│   └── server.js                  # Entry point Express, static frontend & API mount
├── public/                        # Antarmuka Web Dashboard & POS Terintegrasi
│   ├── index.html                 # Halaman Login Formal (Authentication Screen) & SPA Dashboard Terintegrasi
│   ├── css/
│   │   └── app.css                # Styling modern, custom badge role & receipt paper
│   └── js/
│       └── app.js                 # Engine client: Autentikasi JWT, sapaan dinamis, POS kasir, navigasi RBAC dinamis & logout
└── tests/
    └── rbac.test.js               # Pengujian otomatis RBAC 7 role, transaksi & integritas MySQL
```

---

## 🔑 Akun Bawaan untuk Pengujian (Seeded Accounts)

Semua akun menggunakan kata sandi default: **`password123`**

| Role Otoritas | Nama Lengkap | Username | Email | Fitur Utama yang Diakses |
|---|---|---|---|---|
| **Owner** | **Khusna Mufida** | `owner` | `owner@toko.com` | Dasbor Eksekutif Pemilik Toko, Laporan Keuangan, Rekap Stok, Manajemen Pengguna |
| **Kepala Toko** | Mutiara Putri Sayyidina | `kepalatoko` | `kepalatoko@toko.com` | Pusat Otorisasi (Diskon, Void, Hapus Buku), Monitoring Toko & Kasir |
| **Bagian Keuangan** | Ahmad Irsyadul Ibad | `keuangan` | `keuangan@toko.com` | Likuiditas Kas/Bank, Piutang (AR) & Utang (AP), Pengeluaran & Arus Kas |
| **Akunting** | Dodi Rohaedi | `akunting` | `akunting@toko.com` | Bagan Akun (COA), Jurnal Umum, Buku Besar, Neraca Saldo, Neraca & Laba Rugi |
| **Kepala Gudang** | Adam Maulana | `gudang` | `gudang@toko.com` | Master Produk, Penerimaan PO Supplier, Kartu Stok, Stok Opname, Hapus Buku |
| **Kasir** | Mutiara Putri Sayyidina | `kasir` | `kasir@toko.com` | Register POS Kasir, Pembayaran Tunai/Transfer, Struk Belanja, Ajukan Void |
| **Sales** | Adam Maulana | `sales` | `sales@toko.com` | Pencatatan Order Pelanggan, Katalog Produk & Cek Ketersediaan Stok |

> **Fitur Autentikasi Formal:**
> - Antarmuka menggunakan **Halaman Login Formal (Authentication Screen)**:
>   - **Input Teks Nama Pengguna / User:** Pengguna dapat mengetikkan namanya sendiri (misal: *Khusna Mufida*, *Mutiara*, dll).
>   - **Dropdown Role 7 Peran Sistem:** Memilih peran (Owner, Kepala Toko, Bagian Keuangan, Akunting, Kepala Gudang, Kasir, Sales).
>   - **Input Kata Sandi (Password):** Divalidasi dan dicocokkan dengan hash PBKDF2 di database MySQL.
> - Backend secara dinamis memvalidasi dan **mencatat identitas nama** ke database MySQL serta menerbitkan token **JWT (JSON Web Token)**.
> - Dasbor utama langsung menyapa nama lengkap dan menampilkan badge role sesuai yang diinputkan saat login.
> - Tersedia tombol **Logout** di header dashboard untuk mengakhiri sesi.

---

## 🚀 Cara Menjalankan Aplikasi dengan Laragon

### 1. Buka Laragon
Pastikan layanan **MySQL** di Laragon dalam status **Started** (hijau).

### 2. Jalankan Inisialisasi Database (Opsional - Otomatis saat Start)
```bash
cd C:\Users\LENOVO\.gemini\antigravity\scratch\pos-akuntansi-toko
npm run seed
```

### 3. Jalankan Server Aplikasi
```bash
npm start
```

Akses melalui browser:
👉 **`http://localhost:3000`**

### 4. Menjalankan Pengujian Otomatis (Test Suite)
Untuk memverifikasi keandalan sistem, tersedia dua suite pengujian otomatis:

1. **Uji RBAC & Alur Hak Akses Multi-Role (Fase 1):**
```bash
npm test
```
*Hasil:* **14 Lulus, 0 Gagal (100% Passed)**.

2. **Uji Komprehensif Fase 2 (POS Kasir, Pengurangan Stok & Auto-Jurnal):**
```bash
npm run test:phase2
```
*Hasil:* **10 Lulus, 0 Gagal (100% Passed)**.

3. **Jalankan Seluruh Pengujian Sekaligus:**
```bash
npm run test:all
```
*Hasil:* **24 Lulus, 0 Gagal (100% Lulus Sempurna)**.

---

## 🌟 Dokumentasi Fitur Fase 2 (Selesai Dikembangkan)

### 🛒 1. Modul Kasir (POS Register Interaktif)
- **Katalog Produk Dinamis & Filter Kategori:**
  - Dilengkapi tab filter kategori satu-klik: *Semua Kategori*, *☕ Minuman*, *🍪 Makanan Ringan*, *🌾 Sembako*, *✏️ Alat Tulis*.
  - Dilengkapi filter cepat ketersediaan stok: *Semua*, *Tersedia*, dan *Stok Menipis*.
  - Input pencarian cerdas yang langsung memfilter berdasarkan nama produk, SKU, maupun barcode.
  - Kartu produk visual menampilkan SKU, badge kategori, indikator stok warna (Hijau: Aman, Oranye: Menipis, Merah: Habis), harga jual tebal, serta proteksi tombol disable bila stok 0.
- **Keranjang Belanja (Cart) Interaktif:**
  - Menampilkan daftar produk yang dipilih, harga satuan, dan SKU.
  - Kontrol kuantitas instan (+ dan -) yang secara otomatis memvalidasi ketersediaan stok maksimal fisik di gudang.
  - Tombol hapus satuan item (ikon sampah) dan tombol *Kosongkan Keranjang*.
  - Perhitungan subtotal otomatis secara real-time.
  - Fitur diskon penjualan (Rp) dengan shortcut chip cepat (*Rp 0*, *5 rb*, *10 rb*, *20 rb*).
- **Pembayaran Cepat & Kembalian Real-Time:**
  - Pilihan 3 metode pembayaran: **Tunai (CASH)**, **Transfer Bank / QRIS (TRANSFER)**, dan **Piutang Toko (CREDIT)**.
  - **Quick Cash Chips (Tombol Nominal Uang Cepat):** Tombol shortcut sekali klik (*Uang Pas*, *10.000*, *20.000*, *50.000*, *100.000*, *200.000*, *500.000*) untuk mempercepat operasional kasir.
  - Kalkulasi kembalian otomatis real-time (tampil hijau jika uang pas/lebih, tampil merah jika uang kurang).
  - Proteksi anti-double-submit dengan indikator tombol loading spinner.
- **Struk Belanja Kasir Thermal (Receipt Modal):**
  - Desain struk belanja kasir modern siap cetak (mendukung printer thermal 80mm via `@media print`).
  - Menampilkan nama toko, alamat, nomor faktur unik (`INV/YYYYMMDD/XXXX`), nama kasir dinamis, nama pelanggan, tanggal/waktu transaksi, rincian barang, total bayar, metode bayar, dan kembalian.
  - Dilengkapi **Box Audit Auto-Jurnal Akuntansi** yang menampilkan nomor jurnal (`JV-SALE-...`), status posting `POSTED`, serta rincian posting debit-kredit.

### 📦 2. Modul Inventori & Gudang
- **Sinkronisasi Pemotongan Stok Otomatis:** Setiap transaksi kasir yang berhasil diproses langsung memotong stok fisik produk (`products.current_stock`) di database MySQL.
- **Pencatatan Kartu Stok Mutasi:** Setiap penjualan secara otomatis mencatat riwayat pergerakan stok di tabel `stock_movements` dengan tipe `OUT_SALE`, referensi nomor faktur, kuantitas berkurang, saldo awal, dan saldo akhir.
- **Proteksi Stok Habis:** Sistem menolak transaksi dan melakukan rollback database transaksi jika kasir meminta barang melebihi stok yang tersedia.
- **Live State Refresh:** Setelah transaksi selesai, katalog produk kasir dan modul gudang langsung memperbarui sisa stok secara real-time tanpa perlu refresh browser.

### 📑 3. Integrasi Jurnal Akuntansi Otomatis
- **Pencatatan Double-Entry Otomatis:** Setiap penjualan kasir langsung membukukan entri jurnal seimbang ke tabel `journal_entries` dan `journal_entry_lines`:
  1. **Sisi Penerimaan Kas / Piutang:**
     - *Debit:* Kas Toko (`1001`) jika Tunai, Bank BCA (`1002`) jika Transfer, Piutang Usaha (`1101`) jika Kredit.
     - *Kredit:* Pendapatan Penjualan Toko (`4001`).
  2. **Sisi Beban Pokok & Persediaan:**
     - *Debit:* Beban Pokok Penjualan / HPP (`5001`).
     - *Kredit:* Persediaan Barang Dagang (`1201`).
- **Jaminan Keseimbangan Neraca Saldo:** Neraca Saldo (Trial Balance) terjamin seimbang (`Total Debit === Total Credit`) dan langsung tersinkronisasi ke modul Buku Besar, Neraca Saldo, dan Laporan Laba Rugi.

---

## 🚀 Dokumentasi Fitur Fase 3 (Selesai Dikembangkan & Terverifikasi)

### 📈 1. Dasbor Eksekutif Pemilik Toko & Visualisasi Grafik Interaktif
- **Executive Greeting Banner Dinamis:** Menyapa pemilik toko dengan nama lengkap dinamis (`Khusna Mufida` secara default saat login sebagai Owner), status otoritas RBAC akses penuh, dan indikator status online MySQL Laragon.
- **5 Kartu KPI Eksekutif:**
  - *Penjualan Hari Ini (Today's Sales):* Total rupiah dan counter jumlah struk kasir yang terbit hari ini.
  - *Omzet Bulan Ini (Month to Date):* Akumulasi nominal omzet penjualan dan total transaksi pada bulan berjalan.
  - *Valuasi Stok Gudang:* Total nilai aset persediaan barang dagangan dihitung dari `stok x HPP` beserta jumlah varian produk aktif.
  - *Likuiditas Kas & Bank:* Saldo uang tunai di kasir dan rekening bank siap pakai.
  - *Estimasi Laba Bersih Berjalan (Net Profit):* Hasil akumulasi pendapatan penjualan dikurangi seluruh HPP dan beban operasional jurnal akuntansi.
- **3 Visualisasi Grafik Interaktif (Chart.js):**
  - **Grafik Tren Penjualan 7 Hari Terakhir (Dual-Axis Line Chart):** Menampilkan pergerakan omzet rupiah (area filled gradient) dan fluktuasi jumlah transaksi struk kasir per hari.
  - **Grafik Komposisi Metode Pembayaran (Doughnut Chart):** Menampilkan persentase dan nominal pembagian transaksi antara Tunai, Transfer BCA, dan QRIS.
  - **Grafik Top 5 Produk Terlaris (Horizontal Bar Chart):** Menampilkan 5 produk paling laris berdasarkan kuantitas unit terjual dan kontribusi omzetnya.
- **Tabel 5 Transaksi Kasir Terkini:** Menampilkan daftar struk belanja terbaru yang diproses di kasir POS dengan status selesai / void dan tombol pintasan ke riwayat transaksi lengkap.

### 📊 2. Halaman Laporan Penjualan Periodik & Rekap Transaksi
- **Filter Rentang Tanggal Fleksibel:** Pengguna dapat menentukan rentang tanggal khusus (`Dari Tanggal` & `Sampai Tanggal`).
- **Tombol Preset Tanggal Cepat:** Shortcut sekali klik untuk memfilter transaksi: *Hari Ini*, *7 Hari Terakhir*, *Bulan Ini*, dan *Semua Periode*.
- **Filter Metode Pembayaran & Pencarian:** Filter berdasarkan metode bayar (Semua, Tunai, Transfer BCA, QRIS) dan input pencarian teks faktur, nama kasir, atau pelanggan.
- **Kartu Metrik Rekapitulasi:** Total omzet penjualan, total diskon yang diberikan kasir, jumlah transaksi selesai, dan rata-rata nilai transaksi per struk (Average Order Value / AOV).
- **Analisis Breakdown & Top Produk:** Rincian omzet per metode bayar serta daftar 5 produk terlaris di periode yang dipilih.
- **Tabel Rincian Transaksi Lengkap:** Daftar detail seluruh transaksi penjualan beserta tombol *Lihat Struk Thermal*.
- **Fitur Cetak & Unduh Laporan Resmi:**
  - **Tombol Cetak Dokumen (`window.print()`):** Dilengkapi CSS `@media print` khusus dokumen formal (A4 landscape/portrait, tanpa memicu layout struk thermal kasir).
  - **Tombol Unduh CSV / Excel:** File CSV otomatis ter-generate dengan UTF-8 BOM (`\uFEFF`) sehingga langsung terbuka rapi dan terpisah kolom di Microsoft Excel tanpa masalah encoding.

### 👥 3. Halaman Manajemen Pengguna (RBAC 7 Role Operasional)
- **Monitoring Seluruh Akun Staf Toko:** Memantau daftar seluruh akun terdaftar pada 7 peran operasional (Owner, Kepala Toko, Bagian Keuangan, Akunting, Kepala Gudang, Kasir, Sales).
- **Tab Filter 7 Peran Operasional:** Navigasi tab interaktif dilengkapi counter jumlah pegawai aktif pada masing-masing peran.
- **Filter Status & Pencarian Akun:** Filter cepat akun *Aktif* / *Non-Aktif* serta kotak pencarian berdasarkan nama, username, atau email pegawai.
- **Modal Tambah Staf Baru (Create User):**
  - Form input nama lengkap, username unik, email, pilihan dropdown 7 peran operasional, nomor telepon/WhatsApp, dan kata sandi.
  - Validasi keamanan: password dienkripsi dengan PBKDF2 hash dan salt acak, serta validasi pencegahan username/email ganda.
- **Modal Edit Staf Pengguna (Update User):**
  - Mengubah nama, peran/role operasional, dan nomor kontak staf.
  - Penggantian kata sandi fleksibel (opsional, hanya diubah jika diisi).
- **Aksi Ubah Status (Toggle Active/Inactive):**
  - Tombol instan untuk menonaktifkan akun staf yang sedang cuti/nonaktif atau mengaktifkannya kembali.
  - Proteksi keamanan: sistem mencegah Owner menonaktifkan akunnya sendiri secara tidak sengaja.

### 📑 4. Penyempurnaan Laporan Keuangan (Laba Rugi & Neraca)
- **Tombol Cetak Dokumen Keuangan:** Mencetak laporan Laba Rugi dan Neraca penutupan pembukuan ke printer/PDF.
- **Tombol Unduh CSV Keuangan:** Mengekspor seluruh pos akun Laba Rugi dan Neraca ke file CSV Excel secara instan.

---

## 🧪 Hasil Pengujian Komprehensif (32 / 32 Lulus 100%)

Seluruh fungsionalitas sistem telah diuji secara otomatis dan terverifikasi lulus 100%:

| Test Suite | Fokus Pengujian | Jumlah Pengujian | Status |
| :--- | :--- | :---: | :---: |
| `tests/rbac.test.js` | Autentikasi JWT, Proteksi Guard 7 Role RBAC, Auto-Jurnal Dasar, Neraca Saldo | 14 / 14 | **LULUS 100%** |
| `tests/phase2.test.js` | Register POS Kasir, Pemotongan Stok Fisik, Kartu Stok Mutasi, Jurnal Double-Entry, Struk Belanja Thermal | 10 / 10 | **LULUS 100%** |
| `tests/phase3.test.js` | Laporan Penjualan Periodik, Owner Dashboard & Charts, CRUD User Manajemen 7 Role, Metrik Riwayat | 8 / 8 | **LULUS 100%** |
| **TOTAL KESELURUHAN** | **Integritas Penuh Sistem POS & Akuntansi Toko** | **32 / 32** | **🎉 LULUS 100%** |


