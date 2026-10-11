const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const productRoutes = require('./product.routes');
const transactionRoutes = require('./transaction.routes');
const inventoryRoutes = require('./inventory.routes');
const accountingRoutes = require('./accounting.routes');
const financeRoutes = require('./finance.routes');
const approvalRoutes = require('./approval.routes');
const reportRoutes = require('./report.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/transactions', transactionRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/accounting', accountingRoutes);
router.use('/finance', financeRoutes);
router.use('/approvals', approvalRoutes);
router.use('/reports', reportRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    system: 'POS & Akuntansi Toko API',
    version: '1.0.0'
  });
});

module.exports = router;
