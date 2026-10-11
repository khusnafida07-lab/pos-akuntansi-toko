const db = require('../config/database');
const { hashPassword } = require('../utils/crypto.utils');
const { ROLES } = require('../config/rbac-matrix');

class UserController {
  static async getAll(req, res) {
    const users = await db.query(
      `SELECT id, name, username, email, role, phone, is_active, created_at, updated_at
       FROM users ORDER BY id ASC`
    );
    return res.json({ success: true, users, availableRoles: Object.values(ROLES) });
  }

  static async create(req, res) {
    const { name, username, email, password, role, phone } = req.body;

    if (!name || !username || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Nama, username, email, password, dan role wajib diisi.' });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ success: false, message: `Role '${role}' tidak valid.` });
    }

    const existing = await db.getOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username atau email sudah terdaftar.' });
    }

    const { hash, salt } = hashPassword(password);
    const result = await db.run(
      `INSERT INTO users (name, username, email, password_hash, salt, role, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, username, email, hash, salt, role, phone || null]
    );

    return res.status(201).json({
      success: true,
      message: `User '${name}' dengan role '${role}' berhasil dibuat.`,
      userId: result.insertId
    });
  }

  static async toggleStatus(req, res) {
    const { id } = req.params;
    const user = await db.getOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });

    if (user.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menonaktifkan akun Anda sendiri.' });
    }

    const newStatus = user.is_active === 1 ? 0 : 1;
    await db.run('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, id]);

    return res.json({
      success: true,
      message: `Status pengguna berhasil diubah menjadi ${newStatus === 1 ? 'Aktif' : 'Non-aktif'}.`
    });
  }

  static async update(req, res) {
    const { id } = req.params;
    const { name, role, phone, password } = req.body;

    const user = await db.getOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });

    if (role && !Object.values(ROLES).includes(role)) {
      return res.status(400).json({ success: false, message: `Role '${role}' tidak valid.` });
    }

    let updateSql = 'UPDATE users SET name = ?, role = ?, phone = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [name || user.name, role || user.role, phone !== undefined ? phone : user.phone];

    if (password) {
      const { hash, salt } = hashPassword(password);
      updateSql += ', password_hash = ?, salt = ?';
      params.push(hash, salt);
    }

    updateSql += ' WHERE id = ?';
    params.push(id);

    await db.run(updateSql, params);

    return res.json({
      success: true,
      message: `Data pengguna '${name || user.name}' berhasil diperbarui.`
    });
  }
}

module.exports = UserController;
