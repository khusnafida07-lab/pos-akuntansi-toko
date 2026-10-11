const express = require('express');
const router = express.Router();
const AccountingController = require('../controllers/accounting.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/rbac.middleware');
const { ROLES } = require('../config/rbac-matrix');

router.use(authenticateToken);
router.use(requireRoles(ROLES.AKUNTING, ROLES.OWNER));

// Bagan Akun
router.get('/accounts', AccountingController.getAccounts);
router.post('/accounts', AccountingController.createAccount);

// Jurnal Umum
router.get('/journals', AccountingController.getJournals);
router.post('/journals/manual', AccountingController.createManualJournal);

// Buku Besar
router.get('/general-ledger', AccountingController.getGeneralLedger);

// Neraca Saldo
router.get('/trial-balance', AccountingController.getTrialBalance);

// Laba Rugi & Neraca
router.get('/financial-statements', AccountingController.getFinancialStatements);

module.exports = router;
