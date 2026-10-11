const express = require('express');
const router = express.Router();
const ApprovalController = require('../controllers/approval.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { requireRoles } = require('../middleware/rbac.middleware');
const { ROLES } = require('../config/rbac-matrix');

router.use(authenticateToken);
router.use(requireRoles(ROLES.KEPALA_TOKO, ROLES.OWNER));

router.get('/pending', ApprovalController.getPendingApprovals);

module.exports = router;
