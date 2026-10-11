/**
 * ============================================================================
 * TEST SUITE FINALISASI & INTEGRASI END-TO-END (FASE 4)
 * SISTEM APLIKASI POS & AKUNTANSI TOKO TERINTEGRASI (RBAC - MYSQL LARAGON)
 * ============================================================================
 * 
 * Menguji secara komprehensif alur utuh sistem:
 * 1. Otentikasi formal, validasi JWT token, dan profil dinamis (Owner: Khusna Mufida)
 * 2. Transaksi kasir POS interaktif (keranjang belanja, diskon, & kalkulasi pembayaran)
 * 3. Sinkronisasi inventori: pemotongan stok fisik & pencatatan kartu stok otomatis
 * 4. Pembukuan akuntansi: auto-jurnal double-entry seimbang (Debit === Kredit)
 * 5. Siklus pembatalan: permohonan void kasir, otorisasi Kepala Toko, restorasi stok & jurnal pembalik
 * 6. Audit keuangan: Trial Balance, Laporan Laba Rugi & Neraca seimbang
 * 7. Laporan periodik & analitik dasbor eksekutif
 */

const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/server');
const db = require('../src/config/database');
const { initializeDatabase } = require('../src/database/init-db');

let serverInstance = null;
const TEST_PORT = 3000;

// Helper HTTP Request
function makeRequest({ method = 'GET', path, token, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runFinalE2ETests() {
  console.log('\n======================================================================');
  console.log('🏆 PENGUJIAN FINAL END-TO-END (FASE 4): POS, INVENTORI & AKUNTANSI');
  console.log('======================================================================\n');

  try {
    await initializeDatabase();
    await new Promise((resolve) => {
      serverInstance = app.listen(TEST_PORT, resolve);
    });
  } catch (err) {
    console.error('Gagal menginisialisasi server test:', err);
    process.exit(1);
  }

  let passedTests = 0;
  let totalTests = 0;

  async function test(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error('     Detail error:', err.message);
    }
  }

  let ownerToken = null;
  let cashierToken = null;
  let storeManagerToken = null;
  let accountantToken = null;

  let testProduct1 = null;
  let testProduct2 = null;
  let createdTransactionId = null;
  let createdInvoiceNo = null;
  let initialStockP1 = 0;
  let initialStockP2 = 0;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Otentikasi & Verifikasi Identitas RBAC
    // -------------------------------------------------------------------------
    await test('1. Otentikasi Login Formal 7 Role & Verifikasi Nama Khusna Mufida', async () => {
      // 1. Login sebagai Owner
      const ownerRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'owner', password: 'password123', selectedRole: 'Owner' }
      });
      assert.strictEqual(ownerRes.status, 200, 'Login Owner wajib berhasil (200)');
      assert.strictEqual(ownerRes.body.success, true);
      assert.ok(ownerRes.body.token, 'Token JWT wajib diterbitkan');
      ownerToken = ownerRes.body.token;

      // Verifikasi profile endpoint
      const profileRes = await makeRequest({ path: '/api/auth/profile', token: ownerToken });
      assert.strictEqual(profileRes.status, 200);
      assert.strictEqual(profileRes.body.user.role, 'Owner');
      assert.strictEqual(profileRes.body.user.name, 'Khusna Mufida', 'Nama pengguna Owner harus Khusna Mufida');

      // 2. Login sebagai Kasir
      const cashierRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'kasir', password: 'password123', selectedRole: 'Kasir' }
      });
      assert.strictEqual(cashierRes.status, 200);
      cashierToken = cashierRes.body.token;

      // 3. Login sebagai Kepala Toko
      const managerRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'kepalatoko', password: 'password123', selectedRole: 'Kepala Toko' }
      });
      assert.strictEqual(managerRes.status, 200);
      storeManagerToken = managerRes.body.token;

      // 4. Login sebagai Akunting
      const acctRes = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'akunting', password: 'password123', selectedRole: 'Akunting' }
      });
      assert.strictEqual(acctRes.status, 200);
      accountantToken = acctRes.body.token;

      // 5. Uji Proteksi: Password salah harus ditolak
      const badLogin = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { username: 'owner', password: 'wrongPassword', selectedRole: 'Owner' }
      });
      assert.strictEqual(badLogin.status, 401, 'Password salah wajib ditolak 401');
    });

    // -------------------------------------------------------------------------
    // TEST 2: Katalog Produk POS & Pemeriksaan Stok Awal
    // -------------------------------------------------------------------------
    await test('2. Katalog Produk Kasir & Pengecekan Stok Fisik Sebelum Transaksi', async () => {
      // Pastikan ada produk dengan stok memadai
      await db.run('UPDATE products SET current_stock = 30 WHERE current_stock < 10');

      const prodRes = await makeRequest({ path: '/api/products', token: cashierToken });
      assert.strictEqual(prodRes.status, 200);
      assert.ok(Array.isArray(prodRes.body.products), 'Produk harus berupa array');
      assert.ok(prodRes.body.products.length >= 2, 'Katalog harus memiliki minimal 2 produk');

      const available = prodRes.body.products.filter(p => Number(p.current_stock) >= 5);
      assert.ok(available.length >= 2, 'Katalog harus memiliki minimal 2 produk dengan stok >= 5');

      testProduct1 = available[0];
      testProduct2 = available[1];
      initialStockP1 = Number(testProduct1.current_stock);
      initialStockP2 = Number(testProduct2.current_stock);

      assert.ok(initialStockP1 >= 5, 'Stok produk 1 harus mencukupi untuk pengujian');
      assert.ok(initialStockP2 >= 5, 'Stok produk 2 harus mencukupi untuk pengujian');
    });

    // -------------------------------------------------------------------------
    // TEST 3: Transaksi Kasir POS (Checkout, Diskon & Kembalian)
    // -------------------------------------------------------------------------
    await test('3. Proses Checkout Kasir POS (Kalkulasi Diskon, Subtotal & Kembalian Tunai)', async () => {
      const qtyP1 = 2;
      const qtyP2 = 1;
      const discountAmount = 5000;
      const expectedSubtotal = (qtyP1 * Number(testProduct1.sell_price)) + (qtyP2 * Number(testProduct2.sell_price));
      const expectedTotal = expectedSubtotal - discountAmount;
      const cashPaid = expectedTotal + 20000; // Pembayaran lebih
      const expectedChange = cashPaid - expectedTotal;

      const salePayload = {
        payment_method: 'CASH',
        paid_amount: cashPaid,
        discount_amount: discountAmount,
        notes: 'Uji Transaksi E2E Fase 4',
        items: [
          { product_id: testProduct1.id, qty: qtyP1 },
          { product_id: testProduct2.id, qty: qtyP2 }
        ]
      };

      const checkoutRes = await makeRequest({
        method: 'POST',
        path: '/api/transactions/sale',
        token: cashierToken,
        body: salePayload
      });

      assert.strictEqual(checkoutRes.status, 201, 'Checkout harus sukses 201 Created');
      assert.strictEqual(checkoutRes.body.success, true);
      assert.ok(checkoutRes.body.transaction, 'Wajib mengembalikan objek transaksi');

      const tx = checkoutRes.body.transaction;
      createdTransactionId = tx.id;
      createdInvoiceNo = tx.invoice_no;
      assert.strictEqual(tx.status, 'COMPLETED');
      assert.strictEqual(Number(tx.subtotal), expectedSubtotal);
      assert.strictEqual(Number(tx.discount_amount), discountAmount);
      assert.strictEqual(Number(tx.total_amount), expectedTotal);
      assert.strictEqual(Number(tx.paid_amount), cashPaid);
      assert.strictEqual(Number(tx.change_amount), expectedChange);
    });

    // -------------------------------------------------------------------------
    // TEST 4: Verifikasi Pemotongan Stok Inventori & Kartu Stok Mutasi
    // -------------------------------------------------------------------------
    await test('4. Sinkronisasi Inventori: Pemotongan Stok Fisik & Pencatatan Kartu Stok', async () => {
      assert.ok(createdTransactionId, 'Transaksi harus ada');

      // Cek stok fisik produk 1
      const p1InDb = await db.getOne('SELECT current_stock FROM products WHERE id = ?', [testProduct1.id]);
      assert.strictEqual(Number(p1InDb.current_stock), initialStockP1 - 2, 'Stok produk 1 harus berkurang tepat 2 unit');

      // Cek stok fisik produk 2
      const p2InDb = await db.getOne('SELECT current_stock FROM products WHERE id = ?', [testProduct2.id]);
      assert.strictEqual(Number(p2InDb.current_stock), initialStockP2 - 1, 'Stok produk 2 harus berkurang tepat 1 unit');

      // Cek kartu stok (stock_movements)
      const movements = await db.query(
        'SELECT * FROM stock_movements WHERE reference_no = ? AND movement_type = "OUT_SALE"',
        [createdInvoiceNo]
      );
      assert.strictEqual(movements.length, 2, 'Wajib ada 2 pergerakan kartu stok OUT_SALE');
    });

    // -------------------------------------------------------------------------
    // TEST 5: Verifikasi Entri Jurnal Akuntansi Double-Entry Seimbang
    // -------------------------------------------------------------------------
    await test('5. Integrasi Akuntansi: Auto-Jurnal Double-Entry Seimbang (Debit === Kredit)', async () => {
      assert.ok(createdTransactionId, 'Transaksi harus ada');

      const journal = await db.getOne(
        'SELECT * FROM journal_entries WHERE reference_id = ? AND reference_type = "SALE"',
        [createdTransactionId]
      );
      assert.ok(journal, 'Entri jurnal penjualan wajib terbentuk di database');
      assert.strictEqual(journal.status, 'POSTED', 'Status jurnal harus POSTED');

      const lines = await db.query(
        'SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?',
        [journal.id]
      );
      assert.ok(lines.length >= 4, 'Minimal 4 baris akun (Kas, Pendapatan, HPP, Persediaan)');

      const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
      const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

      assert.ok(totalDebit > 0, 'Total debit harus lebih besar dari 0');
      assert.strictEqual(totalDebit, totalCredit, 'Debit dan Kredit jurnal harus seimbang mutlak!');
    });

    // -------------------------------------------------------------------------
    // TEST 6: Alur Void Transaksi & Otorisasi Supervisi Kepala Toko
    // -------------------------------------------------------------------------
    await test('6. Siklus Void: Permohonan Kasir, Otorisasi Kepala Toko, Restorasi Stok & Jurnal Pembalik', async () => {
      assert.ok(createdTransactionId, 'Transaksi harus ada');

      // 1. Kasir mengajukan void
      const voidReqRes = await makeRequest({
        method: 'POST',
        path: `/api/transactions/${createdTransactionId}/request-void`,
        token: cashierToken,
        body: { reason: 'Pelanggan salah memilih varian barang' }
      });
      assert.strictEqual(voidReqRes.status, 200);

      // Status berubah menjadi PENDING_APPROVAL
      const txRequested = await db.getOne('SELECT status FROM transactions WHERE id = ?', [createdTransactionId]);
      assert.strictEqual(txRequested.status, 'PENDING_APPROVAL');

      // 2. Kepala Toko menyetujui void (Otorisasi)
      const approveRes = await makeRequest({
        method: 'POST',
        path: `/api/transactions/${createdTransactionId}/approve-void`,
        token: storeManagerToken,
        body: { approved: true, notes: 'Disetujui pembatalan sesuai SOP' }
      });
      assert.strictEqual(approveRes.status, 200);

      // 3. Verifikasi status transaksi menjadi VOID
      const txVoided = await db.getOne('SELECT status FROM transactions WHERE id = ?', [createdTransactionId]);
      assert.strictEqual(txVoided.status, 'VOID');

      // 4. Verifikasi stok fisik DIKEMBALIKAN (restored) ke awal
      const p1Restored = await db.getOne('SELECT current_stock FROM products WHERE id = ?', [testProduct1.id]);
      assert.strictEqual(Number(p1Restored.current_stock), initialStockP1, 'Stok produk 1 harus pulih ke jumlah awal');

      const p2Restored = await db.getOne('SELECT current_stock FROM products WHERE id = ?', [testProduct2.id]);
      assert.strictEqual(Number(p2Restored.current_stock), initialStockP2, 'Stok produk 2 harus pulih ke jumlah awal');

      // 5. Verifikasi jurnal pembalik (REVERSAL) terbentuk
      const reversalJournal = await db.getOne(
        'SELECT * FROM journal_entries WHERE reference_id = ? AND journal_no LIKE "REV-%"',
        [createdTransactionId]
      );
      assert.ok(reversalJournal, 'Jurnal pembalik harus terbentuk otomatis di database');
      assert.strictEqual(reversalJournal.status, 'POSTED');

      const revLines = await db.query(
        'SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?',
        [reversalJournal.id]
      );
      const revDebit = revLines.reduce((sum, l) => sum + Number(l.debit), 0);
      const revCredit = revLines.reduce((sum, l) => sum + Number(l.credit), 0);
      assert.strictEqual(revDebit, revCredit, 'Jurnal pembalik harus seimbang mutlak!');
    });

    // -------------------------------------------------------------------------
    // TEST 7: Integritas Neraca Saldo (Trial Balance) & Laporan Keuangan
    // -------------------------------------------------------------------------
    await test('7. Integritas Neraca Saldo Toko & Keseimbangan Laporan Keuangan', async () => {
      // 1. Trial Balance (Neraca Saldo)
      const tbRes = await makeRequest({ path: '/api/accounting/trial-balance', token: accountantToken });
      assert.strictEqual(tbRes.status, 200);
      assert.strictEqual(tbRes.body.success, true);
      assert.strictEqual(
        Number(tbRes.body.totalDebit),
        Number(tbRes.body.totalCredit),
        'Trial balance toko harus seimbang mutlak (Debit === Credit)!'
      );

      // 2. Financial Statements (Laba Rugi & Neraca)
      const fsRes = await makeRequest({ path: '/api/accounting/financial-statements', token: accountantToken });
      assert.strictEqual(fsRes.status, 200);
      assert.strictEqual(fsRes.body.success, true);
      assert.ok(fsRes.body.incomeStatement, 'Wajib memuat income statement');
      assert.ok(fsRes.body.balanceSheet, 'Wajib memuat balance sheet');
      assert.strictEqual(fsRes.body.balanceSheet.isBalanced, true, 'Neraca harus seimbang (Aset = Kewajiban + Ekuitas)');
    });

    // -------------------------------------------------------------------------
    // TEST 8: Dasbor Eksekutif & Laporan Penjualan Periodik
    // -------------------------------------------------------------------------
    await test('8. Ketersediaan Laporan Penjualan Periodik & Data Analitik Dasbor Eksekutif', async () => {
      // 1. Owner Dashboard
      const dashRes = await makeRequest({ path: '/api/reports/owner-dashboard', token: ownerToken });
      assert.strictEqual(dashRes.status, 200);
      assert.ok(dashRes.body.kpis, 'Wajib ada kpis');
      assert.ok(dashRes.body.charts, 'Wajib ada charts');
      assert.strictEqual(dashRes.body.charts.trend7Days.length, 7, 'Tren harus memuat 7 hari');

      // 2. Sales Report Periodik
      const reportRes = await makeRequest({ path: '/api/reports/sales', token: ownerToken });
      assert.strictEqual(reportRes.status, 200);
      assert.ok(reportRes.body.summary, 'Wajib ada summary');
      assert.ok(Array.isArray(reportRes.body.sales), 'Wajib ada array sales');
      assert.ok(Array.isArray(reportRes.body.topProducts), 'Wajib ada topProducts');
    });

  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }

  console.log('\n======================================================================');
  console.log(`HASIL PENGUJIAN FINAL E2E (FASE 4): ${passedTests} / ${totalTests} BERHASIL LULUS 100%`);
  console.log('======================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runFinalE2ETests();
