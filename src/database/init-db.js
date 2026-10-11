const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const config = require('../config/config');
const { runSeeders } = require('./seeders');

async function initializeDatabase() {
  console.log('🔄 Memulai Inisialisasi Database MySQL Laragon...');
  console.log(`📡 Menghubungkan ke MySQL host=${config.DB_HOST}:${config.DB_PORT}, user=${config.DB_USER}, db=${config.DB_NAME}...`);

  let tempConn;
  try {
    // 1. Hubungkan ke MySQL Server tanpa memilih database (untuk create database)
    tempConn = await mysql.createConnection({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      multipleStatements: true
    });

    // 2. Buat database jika belum ada
    await tempConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    console.log(`✅ Database '${config.DB_NAME}' siap/dibuat di MySQL.`);

    // 3. Gunakan database tersebut
    await tempConn.query(`USE \`${config.DB_NAME}\`;`);

    // 4. Baca file skema MySQL dan eksekusi
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await tempConn.query(schemaSql);
    console.log('✅ Skema tabel berhasil dieksekusi di MySQL.');
    await tempConn.end();

    // 5. Jalankan Seeder data awal menggunakan pool aplikasi
    await runSeeders();
    console.log('🚀 Inisialisasi MySQL selesai dan database siap digunakan!');
  } catch (err) {
    if (tempConn) await tempConn.end();
    console.error('❌ Gagal inisialisasi database MySQL:', err);
    throw err;
  }
}

if (require.main === module) {
  (async () => {
    try {
      await initializeDatabase();
      process.exit(0);
    } catch (err) {
      process.exit(1);
    }
  })();
}

module.exports = { initializeDatabase };
