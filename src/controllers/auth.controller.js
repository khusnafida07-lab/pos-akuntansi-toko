const db = require('../config/database');
const { verifyPassword, generateToken } = require('../utils/crypto.utils');
const { ROLE_PERMISSIONS, getMenusForRole } = require('../config/rbac-matrix');

class AuthController {
  static async login(req, res) {
    let { username, role, name, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Kata sandi wajib diisi.'
      });
    }

    // Pemetaan normalisasi role
    const roleMapping = {
      'owner': 'Owner',
      'kepalatoko': 'Kepala Toko',
      'kepala toko': 'Kepala Toko',
      'keuangan': 'Bagian Keuangan',
      'bagian keuangan': 'Bagian Keuangan',
      'akunting': 'Akunting',
      'gudang': 'Kepala Gudang',
      'kepala gudang': 'Kepala Gudang',
      'kasir': 'Kasir',
      'sales': 'Sales'
    };

    const roleToUsername = {
      'Owner': 'owner',
      'Kepala Toko': 'kepalatoko',
      'Bagian Keuangan': 'keuangan',
      'Akunting': 'akunting',
      'Kepala Gudang': 'gudang',
      'Kasir': 'kasir',
      'Sales': 'sales'
    };

    let targetRole = null;
    if (role && typeof role === 'string') {
      targetRole = roleMapping[role.toLowerCase().trim()] || role;
    }

    // Otomatis turunkan username dari role jika username belum disertakan
    if (!username && targetRole && roleToUsername[targetRole]) {
      username = roleToUsername[targetRole];
    }

    let user = null;
    if (targetRole) {
      user = await db.getOne('SELECT * FROM users WHERE role = ? LIMIT 1', [targetRole]);
    }
    if (!user && username) {
      user = await db.getOne('SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1', [username, username]);
    }
    if (!user) {
      user = await db.getOne('SELECT * FROM users WHERE role = "Owner" LIMIT 1');
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Akun atau peran yang dipilih tidak ditemukan dalam sistem.'
      });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Akun ini telah dinonaktifkan. Hubungi Administrator/Owner.'
      });
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Kata sandi tidak sesuai.'
      });
    }

    // Catat & perbarui nama identitas pengguna di database MySQL jika diinputkan
    const inputName = name && typeof name === 'string' ? name.trim() : null;
    if (inputName && inputName.length > 0) {
      await db.run('UPDATE users SET name = ? WHERE id = ?', [inputName, user.id]);
      user.name = inputName;
    }

    const payload = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = generateToken(payload);
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    const menus = getMenusForRole(user.role);

    return res.json({
      success: true,
      message: `Login berhasil. Selamat datang, ${user.name}!`,
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      permissions,
      menus
    });
  }

  static getProfile(req, res) {
    const user = req.user;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    const menus = getMenusForRole(user.role);

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role
      },
      permissions,
      menus
    });
  }

  static async getAvailableDemoUsers(req, res) {
    const users = await db.query('SELECT id, name, username, role FROM users WHERE is_active = 1 ORDER BY id');
    return res.json({
      success: true,
      demoUsers: users.map(u => ({
        ...u,
        defaultPassword: 'password123'
      }))
    });
  }
}

module.exports = AuthController;
