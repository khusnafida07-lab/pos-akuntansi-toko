/**
 * Automated Test Suite untuk Fase 2: POS Kasir, Stok Inventori & Jurnal Akuntansi
 */
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/server');
const db = require('../src/config/database');
const { initializeDatabase } = require('../src/database/init-db');

let serverInstance = null;

// Helper untuk HTTP request lokal
function makeRequest({ method = 'GET', path, token, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
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

async function runPhase2Tests() {
  console.log('\n=======================================================');
  console.log('🧪 PENGUJIAN KOMPREHENSIF FASE 2: POS, STOK & AKUNTANSI');
  console.log('=======================================================\n');

  try {
    await initializeDatabase();
    await new Promise((resolve) => {
      serverInstance = app.listen(3000, resolve);
    });
  } catch (err) {
    console.error('Gagal memulai server test:', err);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [LULUS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [GAGAL] ${name}`);
      console.error('   ', err.message);
      failed++;
    }
  }

  // 1. Login Kasir
  let kasirToken;
  await test('Login Kasir untuk Operasional POS', async () => {
    const res = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { name: 'Mutiara Kasir', role: 'Kasir', password: 'password123' }
    });
    assert.strictEqual(res.status, 200);
    assert(res.body.token, 'Token harus ada');
    assert.strictEqual(res.body.user.name, 'Mutiara Kasir');
    kasirToken = res.body.token;
  });

  // 2. Kategori Produk
  await test('Endpoint Kategori Produk (/api/products/categories)', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/products/categories',
      token: kasirToken
    });
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body.categories), 'Harus mengembalikan array kategori');
    assert(res.body.categories.length >= 4, 'Minimal 4 kategori standar toko');
    const catNames = res.body.categories.map(c => c.name);
    assert(catNames.includes('Minuman'));
    assert(catNames.includes('Makanan Ringan'));
    assert(catNames.includes('Sembako'));
    assert(catNames.includes('Alat Tulis'));
  });

  // 3. Ambil Daftar Produk & Stok Awal
  let testProduct;
  let initialStock;
  await test('Katalog Produk POS Aktif (/api/products)', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/products',
      token: kasirToken
    });
    assert.strictEqual(res.status, 200);
    assert(res.body.products.length > 0, 'Produk harus tersedia');
    testProduct = res.body.products.find(p => Number(p.current_stock) >= 5) || res.body.products[0];
    initialStock = Number(testProduct.current_stock);
    assert(initialStock >= 2, 'Stok awal harus >= 2 untuk diuji');
  });

  // 4. Proses Transaksi Kasir POS (CASH)
  let createdTxId;
  const qtyToBuy = 2;
  const unitPrice = Number(testProduct.sell_price);
  const subtotal = unitPrice * qtyToBuy;
  const discount = 2000;
  const totalAmount = subtotal - discount;
  const paidCash = totalAmount + 10000; // Kembalian 10.000

  await test('Proses Transaksi Kasir POS (Pemotongan Stok & Auto-Jurnal)', async () => {
    const saleRes = await makeRequest({
      method: 'POST',
      path: '/api/transactions/sale',
      token: kasirToken,
      body: {
        items: [{ product_id: testProduct.id, qty: qtyToBuy, unit_price: unitPrice }],
        payment_method: 'CASH',
        paid_amount: paidCash,
        discount_amount: discount
      }
    });

    assert.strictEqual(saleRes.status, 201, 'HTTP 201 Created');
    assert.strictEqual(saleRes.body.success, true);
    assert(saleRes.body.transaction, 'Objek transaksi harus dikembalikan');
    assert.strictEqual(Number(saleRes.body.transaction.total_amount), totalAmount);
    assert.strictEqual(Number(saleRes.body.transaction.paid_amount), paidCash);
    assert.strictEqual(Number(saleRes.body.transaction.change_amount), 10000);
    assert(saleRes.body.transaction.journal_no, 'Nomor jurnal harus tercatat');
    createdTxId = saleRes.body.transaction.id;
  });

  // 5. Verifikasi Pengurangan Stok Fisik di Database MySQL
  await test('Verifikasi Pengurangan Stok di Database (products.current_stock)', async () => {
    const pRes = await makeRequest({
      method: 'GET',
      path: `/api/products/${testProduct.id}`,
      token: kasirToken
    });
    assert.strictEqual(pRes.status, 200);
    const updatedStock = Number(pRes.body.product.current_stock);
    assert.strictEqual(
      updatedStock,
      initialStock - qtyToBuy,
      `Stok harus berkurang tepat ${qtyToBuy} (Awal: ${initialStock}, Sekarang: ${updatedStock})`
    );
  });

  // 6. Verifikasi Pencatatan Kartu Stok Mutasi (stock_movements OUT_SALE)
  await test('Verifikasi Kartu Stok Riwayat Mutasi (stock_movements OUT_SALE)', async () => {
    const movements = await db.query(
      `SELECT * FROM stock_movements WHERE product_id = ? AND movement_type = 'OUT_SALE' ORDER BY id DESC LIMIT 1`,
      [testProduct.id]
    );
    assert(movements.length > 0, 'Mutasi stock OUT_SALE harus tercatat');
    const lastMovement = movements[0];
    assert.strictEqual(Number(lastMovement.qty_change), -qtyToBuy);
    assert.strictEqual(Number(lastMovement.stock_before), initialStock);
    assert.strictEqual(Number(lastMovement.stock_after), initialStock - qtyToBuy);
  });

  // 7. Verifikasi Integrasi Auto-Jurnal Akuntansi (Double-Entry Seimbang)
  await test('Verifikasi Auto-Jurnal Akuntansi Penjualan Kasir (Debit = Kredit)', async () => {
    const journal = await db.getOne(
      `SELECT * FROM journal_entries WHERE reference_type = 'SALE' AND reference_id = ?`,
      [createdTxId]
    );
    assert(journal, 'Entri jurnal penjualan harus ada');
    assert.strictEqual(journal.status, 'POSTED');

    const lines = await db.query(
      `SELECT jel.*, a.account_code, a.account_name 
       FROM journal_entry_lines jel
       JOIN accounts a ON jel.account_id = a.id
       WHERE jel.journal_entry_id = ?`,
      [journal.id]
    );
    assert(lines.length >= 2, 'Jurnal minimal memiliki 2 baris (Debit & Kredit)');

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);
    assert.strictEqual(totalDebit, totalCredit, 'Debit dan Kredit jurnal harus seimbang persis');

    // Cek akun Kas Toko (1001) didebit dan Pendapatan Penjualan Toko (4001) dikredit
    const debitKas = lines.find(l => l.account_code === '1001');
    const creditPenjualan = lines.find(l => l.account_code === '4001');
    assert(debitKas, 'Kas Toko (1001) harus didebit');
    assert(creditPenjualan, 'Pendapatan Penjualan Toko (4001) harus dikredit');
    assert.strictEqual(Number(debitKas.debit), totalAmount);
    assert.strictEqual(Number(creditPenjualan.credit), totalAmount);
  });

  // 8. Verifikasi Detail Struk Belanja & Audit Jurnal (/api/transactions/:id/receipt)
  await test('Verifikasi Detail Struk Kasir & Audit Jurnal (/receipt)', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: `/api/transactions/${createdTxId}/receipt`,
      token: kasirToken
    });
    assert.strictEqual(res.status, 200);
    assert(res.body.transaction, 'Transaksi struk harus ada');
    assert(res.body.items && res.body.items.length > 0, 'Item struk harus ada');
    assert.strictEqual(res.body.transaction.cashier_name, 'Mutiara Kasir');
    assert(res.body.journal, 'Data audit jurnal akuntansi harus disertakan pada struk');
    assert(res.body.journal.lines && res.body.journal.lines.length > 0);
  });

  // 9. Proteksi Stok Habis / Melebihi Ketersediaan
  await test('Proteksi Stok: Tolak Transaksi Jika Qty Melebihi Stok Fisik', async () => {
    const currentStockRes = await makeRequest({
      method: 'GET',
      path: `/api/products/${testProduct.id}`,
      token: kasirToken
    });
    const curStock = Number(currentStockRes.body.product.current_stock);

    const overSaleRes = await makeRequest({
      method: 'POST',
      path: '/api/transactions/sale',
      token: kasirToken,
      body: {
        items: [{ product_id: testProduct.id, qty: curStock + 999 }],
        payment_method: 'CASH',
        paid_amount: 10000000,
        discount_amount: 0
      }
    });

    assert.strictEqual(overSaleRes.status, 400, 'Harus ditolak dengan HTTP 400 Bad Request');
    assert.strictEqual(overSaleRes.body.success, false);
    assert(overSaleRes.body.message.includes('tidak mencukupi'));
  });

  // 10. Keseimbangan Neraca Saldo Akuntansi Keseluruhan (Trial Balance)
  await test('Keseimbangan Neraca Saldo Toko (Trial Balance 100% Balanced)', async () => {
    // Login sebagai Akunting
    const loginAkunting = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { name: 'Akunting Utama', role: 'Akunting', password: 'password123' }
    });
    const akuntingToken = loginAkunting.body.token;

    const tbRes = await makeRequest({
      method: 'GET',
      path: '/api/accounting/trial-balance',
      token: akuntingToken
    });
    assert.strictEqual(tbRes.status, 200);
    assert.strictEqual(tbRes.body.isBalanced, true, 'Neraca saldo harus seimbang (Balanced)');
    assert.strictEqual(
      Number(tbRes.body.totalDebit),
      Number(tbRes.body.totalCredit),
      'Total Debit harus sama persis dengan Total Kredit'
    );
  });

  console.log('\n-------------------------------------------------------');
  console.log(`📊 RINGKASAN PENGUJIAN FASE 2: ${passed} Lulus, ${failed} Gagal`);
  console.log('-------------------------------------------------------\n');

  if (serverInstance) serverInstance.close();
  try {
    await db.getRawPool().end();
  } catch (e) {}

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 SELURUH PENGUJIAN FASE 2 BERHASIL DENGAN SEMPURNA!\n');
    process.exit(0);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
