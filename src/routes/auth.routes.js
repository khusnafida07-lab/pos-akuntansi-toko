const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/login', AuthController.login);
router.get('/profile', authenticateToken, AuthController.getProfile);
router.get('/demo-users', AuthController.getAvailableDemoUsers);

module.exports = router;
