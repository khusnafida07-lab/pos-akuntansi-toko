const express = require('express');
const router = express.Router();
const InventoryController = require('../controllers/inventory.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/rbac.middleware');
const { ROLES } = require('../config/rbac-matrix');

router.use(authenticateToken);

// 1. Penerimaan Pembelian Supplier
router.post(
  '/receive-purchase',
  requireRoles(ROLES.KEPALA_GUDANG, ROLES.OWNER),
  InventoryController.receivePurchase
);

// 2. Kartu Stok & Mutasi
router.get(
  '/stock-movements',
  requireRoles(ROLES.KEPALA_GUDANG, ROLES.KEPALA_TOKO, ROLES.OWNER, ROLES.AKUNTING),
  InventoryController.getStockMovements
);

// 3. Stok Opname
router.get(
  '/opname',
  requireRoles(ROLES.KEPALA_GUDANG, ROLES.KEPALA_TOKO, ROLES.OWNER),
  InventoryController.getStockOpnames
);
router.post(
  '/opname',
  requireRoles(ROLES.KEPALA_GUDANG, ROLES.OWNER),
  InventoryController.createStockOpname
);
router.post(
  '/opname/:id/approve',
  requireRoles(ROLES.KEPALA_TOKO, ROLES.OWNER),
  InventoryController.approveStockOpname
);

// 4. Hapus Buku (Write-off)
router.get(
  '/write-off',
  requireRoles(ROLES.KEPALA_GUDANG, ROLES.KEPALA_TOKO, ROLES.OWNER),
  InventoryController.getWriteOffs
);
router.post(
  '/write-off',
  requireRoles(ROLES.KEPALA_GUDANG, ROLES.OWNER),
  InventoryController.requestWriteOff
);
router.post(
  '/write-off/:id/approve',
  requireRoles(ROLES.KEPALA_TOKO, ROLES.OWNER),
  InventoryController.approveWriteOff
);

module.exports = router;
