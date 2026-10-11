const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/report.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/rbac.middleware');
const { ROLES } = require('../config/rbac-matrix');

router.use(authenticateToken);

// Laporan Penjualan (Owner, Kepala Toko, Bagian Keuangan, Akunting)
router.get(
  '/sales',
  requireRoles(ROLES.OWNER, ROLES.KEPALA_TOKO, ROLES.BAGIAN_KEUANGAN, ROLES.AKUNTING),
  ReportController.getSalesReport
);

// Rekap Persediaan (Owner, Kepala Toko, Kepala Gudang, Akunting)
router.get(
  '/inventory',
  requireRoles(ROLES.OWNER, ROLES.KEPALA_TOKO, ROLES.KEPALA_GUDANG, ROLES.AKUNTING),
  ReportController.getInventoryReport
);

// Dasbor Eksekutif Owner
router.get(
  '/owner-dashboard',
  requireRoles(ROLES.OWNER),
  ReportController.getOwnerDashboard
);

module.exports = router;
