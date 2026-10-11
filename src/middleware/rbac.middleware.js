const { hasPermission } = require('../config/rbac-matrix');

/**
 * Middleware untuk membatasi endpoint berdasarkan role tertentu
 * Contoh: requireRoles('Owner', 'Kepala Toko')
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak: Pengguna belum terautentikasi.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses dilarang (RBAC): Role '${req.user.role}' tidak memiliki hak akses ke resource ini.`,
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Middleware untuk membatasi endpoint berdasarkan permission tertentu
 * Contoh: requirePermission(PERMISSIONS.AUTHORIZE_DISCOUNT)
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak: Pengguna belum terautentikasi.'
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        message: `Akses dilarang (RBAC): Role '${req.user.role}' tidak memiliki izin '${permission}'.`,
        requiredPermission: permission,
        userRole: req.user.role
      });
    }

    next();
  };
}

module.exports = {
  requireRoles,
  requirePermission
};
