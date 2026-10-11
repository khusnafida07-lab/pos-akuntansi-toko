const express = require('express');
const router = express.Router();
const FinanceController = require('../controllers/finance.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/rbac.middleware');
const { ROLES } = require('../config/rbac-matrix');

router.use(authenticateToken);
router.use(requireRoles(ROLES.BAGIAN_KEUANGAN, ROLES.AKUNTING, ROLES.OWNER));

// Likuiditas Kas & Bank
router.get('/liquidity', FinanceController.getLiquidity);

// Piutang (AR) & Utang (AP)
router.get('/ar-ap', FinanceController.getArApSummary);

// Pencatatan Pembayaran Pelunasan
router.post('/payments', FinanceController.processPayment);

// Laporan Arus Kas
router.get('/cash-flow', FinanceController.getCashFlow);

module.exports = router;
