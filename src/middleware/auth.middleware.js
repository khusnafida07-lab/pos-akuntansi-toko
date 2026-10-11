const { verifyToken } = require('../utils/crypto.utils');
const db = require('../config/database');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Token autentikasi tidak ditemukan.'
    });
  }

  try {
    const decoded = verifyToken(token);
    // Verifikasi user masih aktif di database MySQL
    const user = await db.getOne('SELECT id, name, username, email, role, is_active FROM users WHERE id = ?', [decoded.id]);

    if (!user || user.is_active !== 1) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak: Akun tidak ditemukan atau telah dinonaktifkan.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Token autentikasi kedaluwarsa atau tidak valid.',
      error: err.message
    });
  }
}

module.exports = { authenticateToken };
