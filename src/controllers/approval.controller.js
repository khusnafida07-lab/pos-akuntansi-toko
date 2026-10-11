const db = require('../config/database');

class ApprovalController {
  static async getPendingApprovals(req, res) {
    // 1. Pending Void & Diskon Transaksi
    const pendingTransactions = await db.query(
      `SELECT t.*, u.name as cashier_name
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.status = 'PENDING_APPROVAL'
       ORDER BY t.date DESC`
    );

    // 2. Pending Hapus Buku (Write-off)
    const pendingWriteOffs = await db.query(
      `SELECT wo.*, u.name as requested_by_name
       FROM write_offs wo
       JOIN users u ON wo.requested_by = u.id
       WHERE wo.status = 'PENDING_APPROVAL'
       ORDER BY wo.created_at DESC`
    );

    // 3. Pending Stok Opname
    const pendingOpnames = await db.query(
      `SELECT so.*, u.name as conducted_by_name
       FROM stock_opnames so
       JOIN users u ON so.conducted_by = u.id
       WHERE so.status = 'DRAFT'
       ORDER BY so.created_at DESC`
    );

    const totalPending = pendingTransactions.length + pendingWriteOffs.length + pendingOpnames.length;

    return res.json({
      success: true,
      totalPending,
      pendingTransactions,
      pendingWriteOffs,
      pendingOpnames
    });
  }
}

module.exports = ApprovalController;
