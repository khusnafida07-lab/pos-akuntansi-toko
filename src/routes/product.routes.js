const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/product.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/rbac.middleware');
const { ROLES } = require('../config/rbac-matrix');

router.use(authenticateToken);

// Semua role yang terautentikasi dapat melihat katalog produk
router.get('/', ProductController.getAll);
router.get('/categories', ProductController.getCategories);
router.get('/:id', ProductController.getById);

// Hanya Kepala Gudang dan Owner yang dapat menambah/mengedit produk
router.post('/', requireRoles(ROLES.KEPALA_GUDANG, ROLES.OWNER), ProductController.create);
router.put('/:id', requireRoles(ROLES.KEPALA_GUDANG, ROLES.OWNER), ProductController.update);

module.exports = router;
