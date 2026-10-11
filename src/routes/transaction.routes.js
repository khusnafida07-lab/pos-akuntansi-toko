const express = require('express');
const router = express.Router();
const TransactionController = require('../controllers/transaction.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/rbac.middleware');
const { ROLES } = require('../config/rbac-matrix');

router.use(authenticateToken);

// Kontak (Customer / Supplier)
router.get('/contacts', TransactionController.getContacts);

// Daftar Transaksi & Detail
router.get('/', TransactionController.getAll);
router.get('/:id/receipt', TransactionController.getReceipt);

// Kasir, Sales, Kepala Toko, Owner dapat membuat transaksi penjualan
router.post(
  '/sale',
  requireRoles(ROLES.KASIR, ROLES.SALES, ROLES.KEPALA_TOKO, ROLES.OWNER),
  TransactionController.createSale
);

// Kasir mengajukan permohonan void
router.post(
  '/:id/request-void',
  requireRoles(ROLES.KASIR, ROLES.KEPALA_TOKO, ROLES.OWNER),
  TransactionController.requestVoid
);

// Otorisasi Void hanya oleh Kepala Toko & Owner
router.post(
  '/:id/approve-void',
  requireRoles(ROLES.KEPALA_TOKO, ROLES.OWNER),
  TransactionController.approveVoid
);

module.exports = router;
