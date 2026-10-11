const path = require('node:path');
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_pos_accounting_jwt_key_2026',
  JWT_EXPIRES_IN: '24h',

  // Konfigurasi Database MySQL / MariaDB (Default Laragon)
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  DB_NAME: process.env.DB_NAME || 'pos_akuntansi_toko',

  STORE_NAME: 'TOKO MAJU JAYA BERSAMA',
  STORE_ADDRESS: 'Jl. Pemuda No. 88, Jakarta Pusat',
  STORE_PHONE: '021-5551234'
};
