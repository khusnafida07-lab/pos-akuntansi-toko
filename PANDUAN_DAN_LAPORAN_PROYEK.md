# 📄 DOKUMENTASI & PANDUAN PENGGUNAAN SISTEM
## SISTEM APLIKASI POS & AKUNTANSI TOKO TERINTEGRASI (RBAC - MYSQL LARAGON)

> **Mata Kuliah / Kategori Proyek:** Rekayasa Perangkat Lunak / Sistem Informasi Akuntansi  
> **Teknologi Utama:** Node.js (Express.js), MySQL 8.x / MariaDB (Laragon), Vanilla JS SPA, Tailwind CSS, Chart.js  
> **Keamanan & Otorisasi:** JSON Web Token (JWT), PBKDF2 Password Hashing & Salt, Role-Based Access Control (RBAC 7 Peran)  

---

## 📌 1. Latar Belakang & Gambaran Umum Sistem

Dalam operasional bisnis retail modern, sering terjadi ketidaksinkronan antara pencatatan transaksi di meja kasir (*front-office*), pencatatan sisa fisik barang di gudang (*logistics*), dan pembukuan jurnal akuntansi (*back-office*).

**Sistem POS & Akuntansi Toko** ini dibangun untuk menyelesaikan masalah tersebut melalui sistem terpadu (*single source of truth*) yang mengintegrasikan:
1. **Otentikasi Formal Multi-Role (RBAC):** Pembatasan hak akses berbasis 7 peran staf dengan layar masuk (*login screen*) formal.
2. **Modul Kasir (Point of Sale):** Antarmuka register kasir interaktif dengan pencarian produk, filter kategori, keranjang belanja, kalkulasi diskon, pembayaran tunai/transfer/kredit, kembalian otomatis, dan cetak struk belanja thermal.
3. **Sinkronisasi Stok Real-Time:** Setiap penjualan kasir langsung memotong stok fisik barang dan mencatat mutasi kartu stok secara otomatis.
4. **Pencatatan Jurnal Akuntansi Otomatis (*Double-Entry*):** Setiap transaksi penjualan langsung membukukan entri jurnal berimbang (*Debit Kas/Bank/Piutang = Kredit Pendapatan Penjualan* dan *Debit HPP = Kredit Persediaan*) ke Buku Besar tanpa intervensi manual.
5. **Siklus Pembatalan (Void) Terotorisasi:** Kasir hanya dapat mengajukan permohonan void, yang wajib diotorisasi oleh Kepala Toko sebelum stok dipulihkan dan jurnal pembalik (*reversal entry*) diterbitkan.
6. **Pelaporan Finansial & Dasbor Eksekutif:** Penyajian Laporan Laba Rugi, Neraca, Arus Kas, Likuiditas, Laporan Penjualan Periodik, dan grafik interaktif (Chart.js) untuk pemilik toko (**Khusna Mufida**).

---

## 🏛️ 2. Arsitektur Sistem & Alur Bisnis Terintegrasi

```text
                                  +--------------------------------------------------+
                                  |            LOGIN SCREEN FORMAL (RBAC)            |
                                  |  Input Nama, Dropdown 7 Role, & Password Hash    |
                                  +--------------------------------------------------+
                                                           |
                                                           v
       +-------------------------------------------------------------------------------------------------------+
       |                                      MENU & HAK AKSES SISTEM (RBAC)                                   |
       +-------------------------------------------------------------------------------------------------------+
         |                       |                       |                      |                     |
         v                       v                       v                      v                     v
   [ 🛒 KASIR ]           [ 📦 GUDANG ]           [ 🏬 KEPALA TOKO ]       [ 📊 AKUNTING ]       [ 👑 OWNER ]
         |                       |                       |                      |                     |
   Transaksi POS           Kelola Stok            Otorisasi Void /       Bagan Akun (COA),     Dasbor Eksekutif,
   Register Kasir,        Barang, PO, &          Diskon Khusus Kasir,    Jurnal Umum, Buku     Lap. Laba Rugi/Neraca,
   Cetak Struk            Kartu Stok             Supervisi Toko          Besar, Neraca Saldo   Manajemen Pengguna
         |                                               ^
         +-----------------------------------------------+
         | (Penjualan Sukses)
         +------------------------------------------------------------------------------------+
         |                                                                                    |
         v                                                                                    v
+-------------------------------+                                           +------------------------------------+
|     INVENTORI & GUDANG        |                                           |     JURNAL AKUNTANSI OTOMATIS      |
| 1. Potong Stok (current_stock)|                                           | 1. (D) Kas / Bank / Piutang        |
| 2. Kartu Stok (OUT_SALE)      |                                           | 2. (K) Pendapatan Penjualan        |
+-------------------------------+                                           | 3. (D) Beban Pokok Penjualan (HPP) |
                                                                            | 4. (K) Persediaan Barang Dagang    |
                                                                            +------------------------------------+
                                                                                              |
                                                                                              v
                                                                            +------------------------------------+
                                                                            |       LAPORAN KEUANGAN RESMI       |
                                                                            | 1. Neraca Saldo (Trial Balance)    |
                                                                            | 2. Laporan Laba Rugi (Income Stmt) |
                                                                            | 3. Laporan Neraca (Balance Sheet)  |
                                                                            +------------------------------------+
```

---

## 👥 3. Matriks 7 Peran Operasional (RBAC) & Akun Kredensial

Sistem memiliki data seeder bawaan (*default seeders*) untuk pengujian 7 peran operasional:

| No | Peran (Role) | Nama Pengguna Default | Username | Password Default | Tanggung Jawab & Hak Akses Utama |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **👑 Owner** | **Khusna Mufida** | `owner` | `password123` | Akses penuh: Dasbor eksekutif, Laporan Laba Rugi & Neraca, Laporan Penjualan Periodik, Manajemen Staf Pengguna. |
| **2** | **🏬 Kepala Toko** | **Mutiara Putri Sayyidina** | `kepalatoko` | `password123` | Supervisi operasional: Pusat otorisasi permohonan void kasir, otorisasi diskon besar, monitoring toko. |
| **3** | **💳 Bagian Keuangan** | **Ahmad Irsyadul Ibad** | `keuangan` | `password123` | Treasury: Pemantauan likuiditas kas & bank, piutang pelanggan (AR), utang supplier (AP), pencatatan arus kas. |
| **4** | **📊 Akunting** | **Dodi Rohaedi** | `akunting` | `password123` | Pembukuan: Bagan Akun (COA), Jurnal Umum, posting buku besar, neraca saldo berimbang, dan penutupan buku. |
| **5** | **📦 Kepala Gudang** | **Adam Maulana** | `gudang` | `password123` | Logistik: Master data produk, penerimaan pembelian barang (PO), kartu stok mutasi, dan stok opname fisik. |
| **6** | **🛒 Kasir** | **Mutiara Putri Sayyidina** | `kasir` | `password123` | Front-office: Register transaksi POS, keranjang belanja, kalkulator kembalian, cetak struk thermal, permohonan void. |
| **7** | **💼 Sales** | **Adam Maulana** | `sales` | `password123` | Penjualan: Pencatatan Sales Order (SO) pesanan pelanggan, cek ketersediaan stok produk, buku kontak pelanggan. |

---

## 🛠️ 4. Panduan Penggunaan Fitur Sistem (Step-by-Step)

### A. Alur Masuk Sistem (Login Screen)
1. Buka peramban di `http://localhost:3000`.
2. Pada **Halaman Login Formal**:
   - Ketikkan **Nama Pengguna / User** (misalnya `Khusna Mufida`).
   - Pilih **Peran / Role Sistem** dari dropdown (misalnya `Owner`).
   - Masukkan **Kata Sandi** (`password123`).
   - Klik tombol **Masuk ke Sistem**.
3. Sistem memvalidasi kredensial ke database MySQL, menyimpan token JWT di `localStorage`, dan mengarahkan ke dasbor utama dengan salam ramah personal.

### B. Alur Transaksi Kasir POS (Point of Sale)
1. Masuk sebagai **Kasir** (atau ganti role via logout).
2. Pilih menu **Register Kasir (POS)**:
   - **Filter & Cari Barang:** Klik tab kategori (*Semua*, *Kopi & Minuman*, *Makanan Ringan*, *Sembako*, *Alat Tulis*) atau ketik nama/SKU di kotak pencarian.
   - **Pilih Produk:** Klik kartu barang untuk memasukkannya ke keranjang belanja.
   - **Kelola Keranjang:** Atur kuantitas barang dengan tombol `+` dan `-` (sistem otomatis mencegah kuantitas melebihi stok fisik), atau masukkan diskon penjualan di kotak diskon.
3. **Pembayaran:**
   - Pilih metode pembayaran: **Tunai (CASH)**, **Transfer BCA**, atau **Piutang (CREDIT)**.
   - Jika Tunai, gunakan tombol nominal cepat (*Uang Pas*, *50.000*, *100.000*, dll). Sistem akan menghitung uang kembalian secara otomatis.
   - Klik tombol **Bayar & Terbitkan Struk**.
4. **Struk Belanja Thermal:**
   - Modal struk kasir muncul seketika menampilkan nomor faktur unik (`INV/YYYYMMDD/XXXX`), rincian belanja, total bayar, kembalian, dan **Audit Box Jurnal Akuntansi** (`JV-SALE-...`).
   - Klik **Cetak Dokumen** untuk mencetak struk format printer thermal 80mm.

### C. Alur Pembatalan Transaksi (Void) & Jurnal Pembalik
1. Kasir membuka menu **Riwayat Transaksi**.
2. Pada transaksi yang ingin dibatalkan, klik tombol **Ajukan Void** dan masukkan alasan pembatalan.
3. Status transaksi berubah menjadi `PENDING_APPROVAL`.
4. **Kepala Toko** masuk ke menu **Pusat Otorisasi**:
   - Meninjau alasan void dan rincian transaksi.
   - Klik **Setujui Void**.
5. Sistem secara otomatis:
   - Mengubah status transaksi menjadi `VOID`.
   - Mengembalikan kuantitas stok barang ke gudang secara otomatis.
   - Menerbitkan entri **Jurnal Pembalik (Reversal Entry)** seimbang dengan nomor `REV-INV-...`.

### D. Alur Laporan Penjualan Periodik & Ekspor Data
1. Masuk sebagai **Owner**, **Akunting**, atau **Kepala Toko**.
2. Buka menu **Laporan Penjualan**:
   - Tentukan rentang tanggal pada kolom **Dari Tanggal** dan **Sampai Tanggal**, atau klik tombol preset cepat (*Hari Ini*, *7 Hari*, *Bulan Ini*, *Semua*).
   - Terapkan filter metode bayar atau pencarian faktur jika diperlukan.
   - Pantau metrik ringkasan: Total Omzet, Total Diskon, Jumlah Transaksi, dan Rata-rata Keranjang (AOV).
   - Klik **Unduh CSV** untuk mengekspor data ke Microsoft Excel (terformat UTF-8 BOM rapi).
   - Klik **Cetak Dokumen** untuk mencetak laporan resmi format A4.

### E. Alur Laporan Keuangan (Laba Rugi & Neraca)
1. Masuk sebagai **Akunting** atau **Owner**.
2. Buka menu **Laporan Keuangan**:
   - **Laporan Laba Rugi (Income Statement):** Menampilkan perincian pos Pendapatan dikurangi pos Beban Operasional dan HPP, menghasilkan Laba/Rugi Bersih berjalan.
   - **Laporan Neraca (Balance Sheet):** Menampilkan posisi Aset (Aktiva) serta Kewajiban dan Modal (Pasiva) lengkap dengan indikator validasi keseimbangan (`✓ SEIMBANG: Aset = Pasiva`).
   - Gunakan tombol **Cetak Dokumen** atau **Unduh CSV** untuk keperluan audit dan arsip.

### F. Alur Manajemen Pengguna (RBAC 7 Role)
1. Masuk sebagai **Owner**.
2. Buka menu **Manajemen Pengguna**:
   - Tinjau daftar seluruh staf terdaftar dengan tab filter per role.
   - Klik **+ Tambah Pengguna Baru** untuk mendaftarkan akun pegawai baru lengkap dengan pilihan 7 peran operasional dan password terenkripsi.
   - Klik **Edit** pada baris pengguna untuk memperbarui nama, nomor kontak, atau mengganti role.
   - Klik **Nonaktifkan** / **Aktifkan** untuk mengubah status keaktifan akun pegawai.

---

## ⚙️ 5. Petunjuk Menjalankan Aplikasi di Lingkungan Lokal (Laragon)

### Prasyarat:
- **Node.js:** Versi 18.x atau yang lebih baru.
- **Laragon:** Aktifkan layanan MySQL / MariaDB (Port default 3306).

### Langkah Instalasi:
1. Pastikan database MySQL di Laragon sudah menyala (*Start All*).
2. Buka terminal PowerShell di folder proyek:
   ```powershell
   cd C:\Users\LENOVO\.gemini\antigravity\scratch\pos-akuntansi-toko
   ```
3. Periksa berkas konfigurasi `.env`:
   ```env
   PORT=3000
   JWT_SECRET=super_secret_pos_accounting_jwt_key_2026
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=pos_akuntansi_toko
   ```
4. Jalankan aplikasi:
   ```powershell
   node src/server.js
   ```
   *Saat pertama kali dijalankan, script inisialisasi akan otomatis membuat database `pos_akuntansi_toko`, mengeksekusi skema tabel, dan mengisi data awal (seeder).*
5. Buka browser di:
   ```text
   http://localhost:3000
   ```

---

## 🧪 6. Hasil Pengujian Otomatis Komprehensif (40 / 40 Lulus 100%)

Seluruh fungsionalitas sistem telah diuji menggunakan script uji otomatis terintegrasi:

| Berkas Pengujian | Cakupan Modul yang Diuji | Jumlah Pengujian | Hasil |
| :--- | :--- | :---: | :---: |
| [tests/rbac.test.js](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/pos-akuntansi-toko/tests/rbac.test.js) | Autentikasi JWT 7 Role, RBAC Guard Middleware, Saldo Neraca Dasar | 14 / 14 | **✅ 100% LULUS** |
| [tests/phase2.test.js](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/pos-akuntansi-toko/tests/phase2.test.js) | Register Kasir POS, Pemotongan Stok Fisik, Kartu Stok Mutasi, Auto-Jurnal Penjualan, Struk Belanja Thermal | 10 / 10 | **✅ 100% LULUS** |
| [tests/phase3.test.js](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/pos-akuntansi-toko/tests/phase3.test.js) | Laporan Penjualan Periodik, Owner Dashboard & Visualisasi Chart.js, CRUD Manajemen Pengguna 7 Role | 8 / 8 | **✅ 100% LULUS** |
| [tests/final-e2e.test.js](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/pos-akuntansi-toko/tests/final-e2e.test.js) | Pengujian Final End-to-End: Siklus Utuh Kasir POS, Inventori, Akuntansi, Permohonan & Otorisasi Void, Neraca Saldo | 8 / 8 | **✅ 100% LULUS** |
| **TOTAL PENGUJIAN** | **Integritas Menyeluruh Sistem POS & Akuntansi Toko** | **40 / 40** | **🎉 100% LULUS SEMPURNA** |

Untuk menjalankan seluruh rangkaian tes sekaligus:
```powershell
node tests/rbac.test.js; node tests/phase2.test.js; node tests/phase3.test.js; node tests/final-e2e.test.js
```

---

## 🏆 7. Kesimpulan Proyek

Sistem Aplikasi POS & Akuntansi Toko Terintegrasi telah berhasil diselesaikan hingga **Fase 4 (Finalisasi & Pengecekan Akhir)** dengan kriteria:
1. **Otentikasi & Keamanan Teruji:** RBAC 7 peran dengan enkripsi PBKDF2 dan token JWT berjalan aman dan akurat.
2. **Transaksi POS Cepat & Responsif:** Memudahkan operasional kasir dengan kontrol stok terproteksi dan perhitungan kembalian real-time.
3. **Otomasi Akuntansi Tanpa Selisih:** Menjamin pembukuan double-entry selalu seimbang (*Debit = Kredit*) dan tersinkronisasi langsung ke Neraca Saldo dan Laporan Laba Rugi.
4. **Antarmuka Bersih & Elegan:** Desain modern bebas dari elemen uji coba, responsif di berbagai ukuran layar, siap digunakan langsung untuk operasional maupun demonstrasi proyek kelompok.
