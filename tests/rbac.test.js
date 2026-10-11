/**
 * Automated Test Suite untuk RBAC dan Alur Sistem POS & Akuntansi (MySQL Version)
 */
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/server');
const config = require('../src/config/config');
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

async function runTests() {
  console.log('\n=======================================================');
  console.log('🧪 MEMULAI PENGUJIAN OTOMATIS RBAC & INTEGRASI MYSQL');
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
      console.error(`❌ [GAGAL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Tes Autentikasi untuk Ke-7 Role
  const tokens = {};
  const rolesToTest = [
    { username: 'owner', role: 'Owner' },
    { username: 'kepalatoko', role: 'Kepala Toko' },
    { username: 'keuangan', role: 'Bagian Keuangan' },
    { username: 'akunting', role: 'Akunting' },
    { username: 'gudang', role: 'Kepala Gudang' },
    { username: 'kasir', role: 'Kasir' },
    { username: 'sales', role: 'Sales' }
  ];

  for (const item of rolesToTest) {
    await test(`Login Berhasil untuk Role: ${item.role} (${item.username})`, async () => {
      const res = await makeRequest({
        method: 'POST',
        path: '/api/auth/login',
        body: { username: item.username, password: 'password123' }
      });
      assert.strictEqual(res.status, 200, 'Status login harus 200');
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.user.role, item.role);
      if (item.username === 'owner') {
        assert.strictEqual(res.body.user.name, 'Khusna Mufida', 'Nama lengkap akun Owner harus Khusna Mufida');
      }
      assert(res.body.token, 'Token JWT harus tersedia');
      tokens[item.username] = res.body.token;
    });
  }

  // 2. Tes Proteksi Otorisasi RBAC (Forbidden 403 vs Allowed 200)
  await test('RBAC Guard: Kasir DILARANG mengakses Manajemen Pengguna (/api/users)', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/users',
      token: tokens.kasir
    });
    assert.strictEqual(res.status, 403, 'Kasir harus ditolak dengan HTTP 403 Forbidden');
    assert.strictEqual(res.body.success, false);
  });

  await test('RBAC Guard: Kasir DILARANG mengakses Laporan Keuangan Akunting', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/accounting/financial-statements',
      token: tokens.kasir
    });
    assert.strictEqual(res.status, 403, 'Kasir harus ditolak dengan HTTP 403 Forbidden');
  });

  await test('RBAC Guard: Owner DIIZINKAN mengakses Manajemen Pengguna (/api/users)', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/users',
      token: tokens.owner
    });
    assert.strictEqual(res.status, 200, 'Owner harus diizinkan dengan HTTP 200 OK');
    assert.strictEqual(res.body.success, true);
  });

  await test('RBAC Guard: Akunting DIIZINKAN mengakses Neraca & Laba Rugi', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/accounting/financial-statements',
      token: tokens.akunting
    });
    assert.strictEqual(res.status, 200, 'Akunting harus diizinkan dengan HTTP 200 OK');
    assert(res.body.balanceSheet, 'Neraca harus ada');
  });

  await test('RBAC Guard: Kepala Gudang DIIZINKAN mengakses Kartu Stok', async () => {
    const res = await makeRequest({
      method: 'GET',
      path: '/api/inventory/stock-movements',
      token: tokens.gudang
    });
    assert.strictEqual(res.status, 200, 'Kepala Gudang harus diizinkan dengan HTTP 200 OK');
  });

  // 3. Tes Alur Transaksi Kasir & Sinkronisasi Akuntansi
  await test('Transaksi POS Kasir: Transaksi Berhasil & Memotong Stok serta Auto-Jurnal', async () => {
    const productsRes = await makeRequest({
      method: 'GET',
      path: '/api/products',
      token: tokens.kasir
    });
    assert(productsRes.body.products.length > 0, 'Produk harus tersedia');
    const firstProduct = productsRes.body.products.find(p => Number(p.current_stock) >= 2) || productsRes.body.products[0];
    const initialStock = Number(firstProduct.current_stock);

    const billTotal = Number(firstProduct.sell_price) * 2;
    const saleRes = await makeRequest({
      method: 'POST',
      path: '/api/transactions/sale',
      token: tokens.kasir,
      body: {
        items: [{ product_id: firstProduct.id, qty: 2 }],
        payment_method: 'CASH',
        paid_amount: billTotal + 10000,
        discount_amount: 0
      }
    });

    assert.strictEqual(saleRes.status, 201, 'Status penjualan harus 201 Created');
    assert.strictEqual(saleRes.body.success, true);

    // Verifikasi stok produk berkurang tepat 2
    const checkProductRes = await makeRequest({
      method: 'GET',
      path: `/api/products/${firstProduct.id}`,
      token: tokens.kasir
    });
    assert.strictEqual(Number(checkProductRes.body.product.current_stock), initialStock - 2, 'Stok harus berkurang 2');
  });

  // 4. Tes Keseimbangan Neraca Saldo (Trial Balance) Akuntansi
  await test('Integritas Akuntansi: Neraca Saldo Harus Seimbang (Debit === Kredit)', async () => {
    const tbRes = await makeRequest({
      method: 'GET',
      path: '/api/accounting/trial-balance',
      token: tokens.akunting
    });
    assert.strictEqual(tbRes.status, 200);
    assert.strictEqual(tbRes.body.isBalanced, true, 'Total Debit dan Kredit Neraca Saldo Akuntansi harus sama!');
  });

  console.log('\n-------------------------------------------------------');
  console.log(`📊 RINGKASAN PENGUJIAN: ${passed} Lulus, ${failed} Gagal`);
  console.log('-------------------------------------------------------\n');

  if (failed === 0) {
    console.log('🎉 SEMUA PENGUJIAN RBAC & INTEGRASI MYSQL BERHASIL 100%!');
  }

  if (serverInstance) serverInstance.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
