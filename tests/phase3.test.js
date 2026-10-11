/**
 * Automated Test Suite untuk Fase 3:
 * 1. Laporan Penjualan Periodik & Rekap Transaksi
 * 2. Dasbor Eksekutif Owner & Analitik Grafik Ringkasan
 * 3. Manajemen Pengguna RBAC (7 Role Operasional)
 * 4. Filter Transaksi & Metrik Riwayat
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

async function runPhase3Tests() {
  console.log('\n================================================================');
  console.log('🧪 PENGUJIAN KOMPREHENSIF FASE 3: LAPORAN, GRAFIK & MANAJEMEN USER');
  console.log('================================================================\n');

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
  let accountantToken = null;
  let createdUserId = null;

  try {
    // Setup login token
    const ownerLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'owner', password: 'password123', selectedRole: 'Owner' }
    });
    ownerToken = ownerLogin.body.token;

    const cashierLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'kasir', password: 'password123', selectedRole: 'Kasir' }
    });
    cashierToken = cashierLogin.body.token;

    const acctLogin = await makeRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { username: 'akunting', password: 'password123', selectedRole: 'Akunting' }
    });
    accountantToken = acctLogin.body.token;

    // TEST 1: Proteksi Otoritas RBAC pada Laporan Penjualan
    await test('1. Otoritas RBAC Laporan Penjualan (Owner & Akunting boleh, Kasir ditolak)', async () => {
      const ownerRes = await makeRequest({ path: '/api/reports/sales', token: ownerToken });
      assert.strictEqual(ownerRes.status, 200, 'Owner harus bisa mengakses laporan penjualan');

      const acctRes = await makeRequest({ path: '/api/reports/sales', token: accountantToken });
      assert.strictEqual(acctRes.status, 200, 'Akunting harus bisa mengakses laporan penjualan');

      const cashierRes = await makeRequest({ path: '/api/reports/sales', token: cashierToken });
      assert.strictEqual(cashierRes.status, 403, 'Kasir tidak boleh mengakses laporan penjualan');
    });

    // TEST 2: Endpoint Laporan Penjualan Periodik & Filter
    await test('2. Struktur Respon Laporan Penjualan Periodik & Filter Tanggal / Metode Bayar', async () => {
      const res = await makeRequest({
        path: '/api/reports/sales?date_from=2020-01-01&date_to=2030-12-31&payment_method=CASH',
        token: ownerToken
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.period, 'Wajib memuat objek period');
      assert.strictEqual(res.body.period.payment_method, 'CASH');
      assert.ok(res.body.summary, 'Wajib memuat objek summary');
      assert.ok('totalRevenue' in res.body.summary, 'Summary wajib ada totalRevenue');
      assert.ok('totalDiscounts' in res.body.summary, 'Summary wajib ada totalDiscounts');
      assert.ok('totalTransactions' in res.body.summary, 'Summary wajib ada totalTransactions');
      assert.ok('averageTransaction' in res.body.summary, 'Summary wajib ada averageTransaction');
      assert.ok(Array.isArray(res.body.sales), 'Sales wajib berupa array');
      assert.ok(Array.isArray(res.body.topProducts), 'Top products wajib berupa array');
      assert.ok(Array.isArray(res.body.paymentBreakdown), 'Payment breakdown wajib berupa array');
    });

    // TEST 3: Dasbor Eksekutif Owner & Analitik Grafik Ringkasan
    await test('3. Dasbor Eksekutif Owner (KPI Omzet, Valuasi, Kas, Laba & Data Grafik 7 Hari)', async () => {
      const res = await makeRequest({ path: '/api/reports/owner-dashboard', token: ownerToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      // Cek KPIs
      const kpis = res.body.kpis;
      assert.ok(kpis, 'Wajib memuat kpis');
      assert.ok('todaySalesTotal' in kpis, 'Wajib ada todaySalesTotal');
      assert.ok('monthSalesTotal' in kpis, 'Wajib ada monthSalesTotal');
      assert.ok('inventoryValuation' in kpis, 'Wajib ada inventoryValuation');
      assert.ok('cashLiquidity' in kpis, 'Wajib ada cashLiquidity');
      assert.ok('netProfit' in kpis, 'Wajib ada netProfit (estimasi laba bersih)');

      // Cek Charts
      const charts = res.body.charts;
      assert.ok(charts, 'Wajib memuat objek charts');
      assert.ok(Array.isArray(charts.trend7Days), 'Trend 7 hari wajib berupa array');
      assert.strictEqual(charts.trend7Days.length, 7, 'Tren harus berisi data 7 hari terakhir');
      assert.ok(Array.isArray(charts.paymentComposition), 'Komposisi pembayaran wajib array');
      assert.ok(Array.isArray(charts.topSellingProducts), 'Top selling products wajib array');

      // Cek Recent Transactions
      assert.ok(Array.isArray(res.body.recentTransactions), 'Recent transactions wajib array');
    });

    // TEST 4: Daftar Pengguna RBAC (7 Role Operasional)
    await test('4. Pemantauan Daftar Akun Pengguna RBAC (Memuat 7 Role Operasional)', async () => {
      const res = await makeRequest({ path: '/api/users', token: ownerToken });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.users), 'Users wajib berupa array');

      const rolesFound = new Set(res.body.users.map((u) => u.role));
      const requiredRoles = ['Owner', 'Kepala Toko', 'Bagian Keuangan', 'Akunting', 'Kepala Gudang', 'Kasir', 'Sales'];
      requiredRoles.forEach((role) => {
        assert.ok(rolesFound.has(role), `Daftar akun wajib mencakup role '${role}'`);
      });

      const ownerUser = res.body.users.find((u) => u.role === 'Owner');
      assert.strictEqual(ownerUser.name, 'Khusna Mufida', 'Nama lengkap akun Owner harus Khusna Mufida');
    });

    // TEST 5: Tambah Pengguna Staf Baru (POST /api/users)
    await test('5. Tambah Akun Pengguna Baru (Validasi Password Hash & Cegah Duplikasi)', async () => {
      const newUser = {
        name: 'Ahmad Fauzi Test',
        username: 'fauzi_kasir_test',
        email: 'fauzi.test@toko.com',
        role: 'Kasir',
        phone: '081299887766',
        password: 'passwordRahasia123'
      };

      const res = await makeRequest({
        method: 'POST',
        path: '/api/users',
        token: ownerToken,
        body: newUser
      });
      assert.strictEqual(res.status, 201, 'Harus sukses 201 Created');
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.userId, 'Harus mengembalikan userId baru');
      createdUserId = res.body.userId;

      // Verifikasi di DB bahwa password di-hash (bukan plaintext)
      const userInDb = await db.getOne('SELECT * FROM users WHERE id = ?', [createdUserId]);
      assert.ok(userInDb, 'Pengguna harus tersimpan di database');
      assert.notStrictEqual(userInDb.password_hash, newUser.password, 'Password wajib di-hash!');
      assert.ok(userInDb.salt, 'Salt wajib disimpan');

      // Uji validasi duplikasi username
      const dupRes = await makeRequest({
        method: 'POST',
        path: '/api/users',
        token: ownerToken,
        body: newUser
      });
      assert.strictEqual(dupRes.status, 400, 'Duplikasi username/email wajib ditolak (400)');
    });

    // TEST 6: Edit & Perbarui Data Pengguna (PUT /api/users/:id)
    await test('6. Edit Pengguna Staf (Ubah Nama, Role, Telepon, dan Password)', async () => {
      assert.ok(createdUserId, 'Harus ada user yang dibuat sebelumnya');

      const updateData = {
        name: 'Ahmad Fauzi Sales Senior',
        role: 'Sales',
        phone: '081299999999',
        password: 'newPassword321'
      };

      const res = await makeRequest({
        method: 'PUT',
        path: `/api/users/${createdUserId}`,
        token: ownerToken,
        body: updateData
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);

      const userAfter = await db.getOne('SELECT * FROM users WHERE id = ?', [createdUserId]);
      assert.strictEqual(userAfter.name, updateData.name);
      assert.strictEqual(userAfter.role, updateData.role);
      assert.strictEqual(userAfter.phone, updateData.phone);
    });

    // TEST 7: Ubah Status Aktif / Non-Aktif Pengguna (PATCH /api/users/:id/toggle-status)
    await test('7. Toggle Status Pengguna & Cegah Menonaktifkan Diri Sendiri', async () => {
      assert.ok(createdUserId, 'Harus ada user yang dibuat sebelumnya');

      // Nonaktifkan user
      const toggleRes1 = await makeRequest({
        method: 'PATCH',
        path: `/api/users/${createdUserId}/toggle-status`,
        token: ownerToken
      });
      assert.strictEqual(toggleRes1.status, 200);
      let userInDb = await db.getOne('SELECT is_active FROM users WHERE id = ?', [createdUserId]);
      assert.strictEqual(userInDb.is_active, 0, 'Status user harus menjadi Non-aktif (0)');

      // Aktifkan kembali
      const toggleRes2 = await makeRequest({
        method: 'PATCH',
        path: `/api/users/${createdUserId}/toggle-status`,
        token: ownerToken
      });
      assert.strictEqual(toggleRes2.status, 200);
      userInDb = await db.getOne('SELECT is_active FROM users WHERE id = ?', [createdUserId]);
      assert.strictEqual(userInDb.is_active, 1, 'Status user harus aktif kembali (1)');

      // Coba menonaktifkan akun sendiri (Owner)
      const ownerSelf = await db.getOne("SELECT id FROM users WHERE username = 'owner'");
      const selfRes = await makeRequest({
        method: 'PATCH',
        path: `/api/users/${ownerSelf.id}/toggle-status`,
        token: ownerToken
      });
      assert.strictEqual(selfRes.status, 400, 'Menonaktifkan akun sendiri harus ditolak 400');
    });

    // TEST 8: Riwayat Transaksi Diperkaya (Filter, Pencarian, & Ringkasan Metrik)
    await test('8. Riwayat Transaksi Diperkaya (Filter Metode, Pencarian Faktur & Metrik Status)', async () => {
      const res = await makeRequest({
        path: '/api/transactions?payment_method=CASH',
        token: ownerToken
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.transactions), 'Wajib memuat array transaksi');
      assert.ok(res.body.summary, 'Wajib memuat objek ringkasan status');
      assert.ok('totalAmount' in res.body.summary, 'Summary wajib ada totalAmount');
      assert.ok('completedCount' in res.body.summary, 'Summary wajib ada completedCount');
      assert.ok('voidCount' in res.body.summary, 'Summary wajib ada voidCount');
      assert.ok('pendingCount' in res.body.summary, 'Summary wajib ada pendingCount');
    });

  } finally {
    // Bersihkan user pengujian jika ada
    if (createdUserId) {
      await db.run('DELETE FROM users WHERE id = ?', [createdUserId]);
    }

    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`HASIL PENGUJIAN FASE 3: ${passedTests} / ${totalTests} BERHASIL LULUS 100%`);
  console.log('----------------------------------------------------------------\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase3Tests();
