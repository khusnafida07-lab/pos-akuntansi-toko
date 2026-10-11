const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/rbac.middleware');
const { ROLES } = require('../config/rbac-matrix');

// Hanya role Owner yang memiliki hak akses penuh mengelola user
router.use(authenticateToken);
router.use(requireRoles(ROLES.OWNER));

router.get('/', UserController.getAll);
router.post('/', UserController.create);
router.put('/:id', UserController.update);
router.patch('/:id/toggle-status', UserController.toggleStatus);

module.exports = router;
