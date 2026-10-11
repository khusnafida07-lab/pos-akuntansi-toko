const db = require('../config/database');
const { hashPassword } = require('../utils/crypto.utils');
const { ROLES } = require('../config/rbac-matrix');

async function runSeeders() {
  console.log('🌱 Menjalankan Seeder Data Awal di MySQL...');

  // 1. Seed Users untuk ke-7 Role
  const usersCount = await db.getOne('SELECT COUNT(*) as count FROM users');
  if (Number(usersCount.count) === 0) {
    console.log('-> Seeding 7 User dengan Role...');
    const defaultUsers = [
      {
        name: 'Khusna Mufida',
        username: 'owner',
        email: 'owner@toko.com',
        role: ROLES.OWNER,
        password: 'password123',
        phone: '08123456701'
      },
      {
        name: 'Mutiara Putri Sayyidina',
        username: 'kepalatoko',
        email: 'kepalatoko@toko.com',
        role: ROLES.KEPALA_TOKO,
        password: 'password123',
        phone: '08123456702'
      },
      {
        name: 'Ahmad Irsyadul Ibad',
        username: 'keuangan',
        email: 'keuangan@toko.com',
        role: ROLES.BAGIAN_KEUANGAN,
        password: 'password123',
        phone: '08123456703'
      },
      {
        name: 'Dodi Rohaedi',
        username: 'akunting',
        email: 'akunting@toko.com',
        role: ROLES.AKUNTING,
        password: 'password123',
        phone: '08123456704'
      },
      {
        name: 'Adam Maulana',
        username: 'gudang',
        email: 'gudang@toko.com',
        role: ROLES.KEPALA_GUDANG,
        password: 'password123',
        phone: '08123456705'
      },
      {
        name: 'Mutiara Putri Sayyidina',
        username: 'kasir',
        email: 'kasir@toko.com',
        role: ROLES.KASIR,
        password: 'password123',
        phone: '08123456706'
      },
      {
        name: 'Adam Maulana',
        username: 'sales',
        email: 'sales@toko.com',
        role: ROLES.SALES,
        password: 'password123',
        phone: '08123456707'
      }
    ];

    for (const u of defaultUsers) {
      const { hash, salt } = hashPassword(u.password);
      await db.run(
        `INSERT INTO users (name, username, email, password_hash, salt, role, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [u.name, u.username, u.email, hash, salt, u.role, u.phone]
      );
    }
  } else {
    // Pastikan seluruh nama akun bawaan diperbarui sesuai konfigurasi terkini
    await db.run("UPDATE users SET name = 'Khusna Mufida' WHERE username = 'owner'");
    await db.run("UPDATE users SET name = 'Mutiara Putri Sayyidina' WHERE username = 'kepalatoko'");
    await db.run("UPDATE users SET name = 'Ahmad Irsyadul Ibad' WHERE username = 'keuangan'");
    await db.run("UPDATE users SET name = 'Dodi Rohaedi' WHERE username = 'akunting'");
    await db.run("UPDATE users SET name = 'Adam Maulana' WHERE username = 'gudang'");
    await db.run("UPDATE users SET name = 'Mutiara Putri Sayyidina' WHERE username = 'kasir'");
    await db.run("UPDATE users SET name = 'Adam Maulana' WHERE username = 'sales'");
  }

  // 2. Seed Bagan Akun (Chart of Accounts)
  const coaCount = await db.getOne('SELECT COUNT(*) as count FROM accounts');
  if (Number(coaCount.count) === 0) {
    console.log('-> Seeding Chart of Accounts (COA)...');
    const defaultAccounts = [
      { code: '1001', name: 'Kas Toko (Register Kasir)', type: 'ASSET', balance: 'DEBIT', desc: 'Uang kas operasional register kasir' },
      { code: '1002', name: 'Bank BCA Operasional', type: 'ASSET', balance: 'DEBIT', desc: 'Rekening penerimaan transfer & QRIS' },
      { code: '1101', name: 'Piutang Usaha (AR)', type: 'ASSET', balance: 'DEBIT', desc: 'Piutang penjualan ke pelanggan' },
      { code: '1201', name: 'Persediaan Barang Dagang', type: 'ASSET', balance: 'DEBIT', desc: 'Nilai perolehan stok fisik di gudang & rak' },
      { code: '2001', name: 'Utang Usaha (AP)', type: 'LIABILITY', balance: 'CREDIT', desc: 'Utang pembelian barang ke supplier' },
      { code: '3001', name: 'Modal Disetor Pemilik', type: 'EQUITY', balance: 'CREDIT', desc: 'Modal awal pemilik toko' },
      { code: '3002', name: 'Laba Ditahan', type: 'EQUITY', balance: 'CREDIT', desc: 'Akumulasi laba periode lalu' },
      { code: '4001', name: 'Pendapatan Penjualan Toko', type: 'REVENUE', balance: 'CREDIT', desc: 'Total omzet penjualan barang' },
      { code: '4002', name: 'Pendapatan Lain-lain', type: 'REVENUE', balance: 'CREDIT', desc: 'Pendapatan non-operasional' },
      { code: '5001', name: 'Harga Pokok Penjualan (HPP)', type: 'EXPENSE', balance: 'DEBIT', desc: 'Biaya pokok perolehan barang terjual' },
      { code: '6001', name: 'Beban Gaji & Upah Staf', type: 'EXPENSE', balance: 'DEBIT', desc: 'Penggajian staf dan karyawan' },
      { code: '6002', name: 'Beban Operasional & Listrik', type: 'EXPENSE', balance: 'DEBIT', desc: 'Biaya utilitas toko' },
      { code: '6003', name: 'Beban Hapus Buku / Barang Rusak', type: 'EXPENSE', balance: 'DEBIT', desc: 'Kerugian write-off inventori' }
    ];

    for (const a of defaultAccounts) {
      await db.run(
        `INSERT INTO accounts (account_code, account_name, account_type, normal_balance, description)
         VALUES (?, ?, ?, ?, ?)`,
        [a.code, a.name, a.type, a.balance, a.desc]
      );
    }
  }

  // 3. Seed Kategori & Kontak
  const catCount = await db.getOne('SELECT COUNT(*) as count FROM categories');
  if (Number(catCount.count) === 0) {
    console.log('-> Seeding Kategori & Kontak...');
    await db.run("INSERT INTO categories (name, description) VALUES ('Minuman', 'Aneka minuman botol, kaleng, dan serbuk')");
    await db.run("INSERT INTO categories (name, description) VALUES ('Makanan Ringan', 'Camilan dan snack')");
    await db.run("INSERT INTO categories (name, description) VALUES ('Sembako', 'Bahan pokok kebutuhan sehari-hari')");
    await db.run("INSERT INTO categories (name, description) VALUES ('Alat Tulis', 'Kebutuhan kantor dan sekolah')");

    await db.run("INSERT INTO contacts (type, name, phone, email, address) VALUES ('CUSTOMER', 'Pelanggan Umum (Walk-in)', '08000000000', 'walkin@customer.com', 'Toko Langsung')");
    await db.run("INSERT INTO contacts (type, name, phone, email, address) VALUES ('CUSTOMER', 'Toko Berkah Mitra', '08129988776', 'berkah@gmail.com', 'Pasar Baru Blok A No. 12')");
    await db.run("INSERT INTO contacts (type, name, phone, email, address) VALUES ('SUPPLIER', 'PT Pangan Sumber Makmur', '021-889977', 'order@sumbermakmur.com', 'Kawasan Industri Pulogadung')");
    await db.run("INSERT INTO contacts (type, name, phone, email, address) VALUES ('SUPPLIER', 'CV Distribusi Nusantara', '021-445566', 'sales@nusantara.com', 'Jl. Daan Mogot KM 14')");
  }

  // 4. Seed Produk & Inventori
  const prodCount = await db.getOne('SELECT COUNT(*) as count FROM products');
  if (Number(prodCount.count) === 0) {
    console.log('-> Seeding Produk & Kartu Stok Awal...');
    const sampleProducts = [
      { sku: 'MNM-001', barcode: '8992753123451', name: 'Kopi Susu Espresso 250ml', category_id: 1, unit: 'botol', buy_price: 8000, sell_price: 12000, current_stock: 48, min_stock: 10 },
      { sku: 'MNM-002', barcode: '8992753123452', name: 'Teh Hijau Jasmine 350ml', category_id: 1, unit: 'botol', buy_price: 4500, sell_price: 7000, current_stock: 60, min_stock: 12 },
      { sku: 'MKN-001', barcode: '8992753123453', name: 'Keripik Kentang Keju 75g', category_id: 2, unit: 'bungkus', buy_price: 9500, sell_price: 14000, current_stock: 35, min_stock: 8 },
      { sku: 'MKN-002', barcode: '8992753123454', name: 'Biskuit Cokelat Sandwich 120g', category_id: 2, unit: 'bungkus', buy_price: 6000, sell_price: 9500, current_stock: 40, min_stock: 10 },
      { sku: 'SBK-001', barcode: '8992753123455', name: 'Beras Premium Ramos 5kg', category_id: 3, unit: 'karung', buy_price: 68000, sell_price: 79000, current_stock: 25, min_stock: 5 },
      { sku: 'SBK-002', barcode: '8992753123456', name: 'Minyak Goreng Sawit 2L', category_id: 3, unit: 'pouch', buy_price: 32000, sell_price: 38000, current_stock: 30, min_stock: 6 },
      { sku: 'ATK-001', barcode: '8992753123457', name: 'Buku Tulis Hardcover A5', category_id: 4, unit: 'pcs', buy_price: 15000, sell_price: 22000, current_stock: 20, min_stock: 5 }
    ];

    const ownerUser = await db.getOne("SELECT id FROM users WHERE role = 'Owner'");

    for (const p of sampleProducts) {
      const res = await db.run(
        `INSERT INTO products (sku, barcode, name, category_id, unit, buy_price, sell_price, current_stock, min_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [p.sku, p.barcode, p.name, p.category_id, p.unit, p.buy_price, p.sell_price, p.current_stock, p.min_stock]
      );

      // Catat kartu stok awal
      await db.run(
        `INSERT INTO stock_movements (product_id, movement_type, reference_no, qty_change, stock_before, stock_after, notes, created_by)
         VALUES (?, 'OPNAME_ADJUSTMENT', 'INIT-STOCK', ?, 0, ?, 'Saldo persediaan awal produk sistem', ?)`,
        [res.insertId, p.current_stock, p.current_stock, ownerUser ? ownerUser.id : 1]
      );
    }
  }

  // 5. Seed Jurnal Saldo Awal (Modal Awal & Persediaan Awal)
  const journalCount = await db.getOne('SELECT COUNT(*) as count FROM journal_entries');
  if (Number(journalCount.count) === 0) {
    console.log('-> Seeding Jurnal Saldo Awal Akuntansi...');
    const akuntingUser = await db.getOne("SELECT id FROM users WHERE role = 'Akunting'");
    const userId = akuntingUser ? akuntingUser.id : 1;

    // Hitung total nilai stok awal
    const totalInventoryRes = await db.getOne('SELECT SUM(current_stock * buy_price) as total FROM products');
    const totalInventoryVal = Number(totalInventoryRes.total || 5000000);
    const kasAwal = 15000000;
    const bankAwal = 35000000;
    const modalAwal = kasAwal + bankAwal + totalInventoryVal;

    const jEntry = await db.run(
      `INSERT INTO journal_entries (journal_no, entry_date, reference_type, description, status, posted_by, posted_at, created_by)
       VALUES ('JV-2026-0001', CURDATE(), 'MANUAL', 'Saldo Awal Pembukaan Toko (Kas, Bank & Persediaan)', 'POSTED', ?, NOW(), ?)`,
      [userId, userId]
    );

    const jId = jEntry.insertId;
    const accKas = (await db.getOne("SELECT id FROM accounts WHERE account_code = '1001'")).id;
    const accBank = (await db.getOne("SELECT id FROM accounts WHERE account_code = '1002'")).id;
    const accStok = (await db.getOne("SELECT id FROM accounts WHERE account_code = '1201'")).id;
    const accModal = (await db.getOne("SELECT id FROM accounts WHERE account_code = '3001'")).id;

    // Debit: Kas 15jt, Bank 35jt, Stok
    await db.run("INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, 'Saldo Kas Awal')", [jId, accKas, kasAwal]);
    await db.run("INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, 'Saldo Bank BCA Awal')", [jId, accBank, bankAwal]);
    await db.run("INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, 'Persediaan Barang Dagang Awal')", [jId, accStok, totalInventoryVal]);
    // Credit: Modal Disetor Pemilik
    await db.run("INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, 'Setoran Modal Pemilik Awal')", [jId, accModal, modalAwal]);
  }

  console.log('✅ Seeder MySQL selesai dengan sukses.');
}

module.exports = { runSeeders };
