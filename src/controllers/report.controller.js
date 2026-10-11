const db = require('../config/database');

class ReportController {
  // Laporan Penjualan Periodik & Rangkuman Transaksional
  static async getSalesReport(req, res) {
    const { date_from, date_to, payment_method, search } = req.query;

    let sql = `
      SELECT t.id, t.invoice_no, t.date, t.subtotal, t.discount_amount, t.total_amount, 
             t.payment_method, t.payment_status, t.status,
             u.name as cashier_name, c.name as customer_name
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE t.type = 'SALE' AND t.status = 'COMPLETED'
    `;
    const params = [];

    if (date_from) {
      sql += ' AND DATE(t.date) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND DATE(t.date) <= ?';
      params.push(date_to);
    }
    if (payment_method && payment_method !== 'ALL') {
      sql += ' AND t.payment_method = ?';
      params.push(payment_method);
    }
    if (search) {
      sql += ' AND (t.invoice_no LIKE ? OR u.name LIKE ? OR c.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY t.date DESC LIMIT 500';
    const sales = await db.query(sql, params);

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalDiscounts = sales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0);
    const totalTransactions = sales.length;
    const averageTransaction = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    // Breakdown per Metode Pembayaran
    const paymentMap = {};
    sales.forEach(s => {
      paymentMap[s.payment_method] = (paymentMap[s.payment_method] || 0) + Number(s.total_amount);
    });
    const paymentBreakdown = Object.entries(paymentMap).map(([method, total]) => ({
      method,
      total,
      count: sales.filter(s => s.payment_method === method).length
    }));

    // Produk Terlaris dalam Periode Tersebut
    let topSql = `
      SELECT p.name, p.sku, c.name as category_name, 
             SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_sales
      FROM transaction_items ti
      JOIN transactions t ON ti.transaction_id = t.id
      JOIN products p ON ti.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE t.type = 'SALE' AND t.status = 'COMPLETED'
    `;
    const topParams = [];
    if (date_from) {
      topSql += ' AND DATE(t.date) >= ?';
      topParams.push(date_from);
    }
    if (date_to) {
      topSql += ' AND DATE(t.date) <= ?';
      topParams.push(date_to);
    }
    topSql += ' GROUP BY p.id, p.name, p.sku, c.name ORDER BY total_qty DESC LIMIT 5';

    const topProducts = await db.query(topSql, topParams);

    return res.json({
      success: true,
      period: {
        date_from: date_from || 'Semua',
        date_to: date_to || 'Semua',
        payment_method: payment_method || 'ALL'
      },
      summary: {
        totalRevenue,
        totalDiscounts,
        totalTransactions,
        averageTransaction
      },
      paymentBreakdown,
      sales,
      topProducts
    });
  }

  // Rekap Persediaan & Nilai Aset Gudang
  static async getInventoryReport(req, res) {
    const summary = await db.getOne(
      `SELECT
        COUNT(*) as total_items,
        SUM(current_stock) as total_units,
        SUM(current_stock * buy_price) as total_valuation,
        SUM(CASE WHEN current_stock <= min_stock THEN 1 ELSE 0 END) as low_stock_count
       FROM products
       WHERE is_active = 1`
    );

    const lowStockItems = await db.query(
      `SELECT p.*, c.name as category_name 
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.current_stock <= p.min_stock AND p.is_active = 1 
       ORDER BY p.current_stock ASC`
    );

    return res.json({
      success: true,
      summary: {
        totalItems: summary ? Number(summary.total_items || 0) : 0,
        totalUnits: summary ? Number(summary.total_units || 0) : 0,
        totalValuation: summary ? Number(summary.total_valuation || 0) : 0,
        lowStockCount: summary ? Number(summary.low_stock_count || 0) : 0
      },
      lowStockItems
    });
  }

  // Dasbor Eksekutif Owner & Monitoring Grafik
  static async getOwnerDashboard(req, res) {
    const todaySales = await db.getOne(
      `SELECT COUNT(*) as count, SUM(total_amount) as total
       FROM transactions
       WHERE type = 'SALE' AND status = 'COMPLETED' AND DATE(date) = CURDATE()`
    );

    const monthSales = await db.getOne(
      `SELECT COUNT(*) as count, SUM(total_amount) as total
       FROM transactions
       WHERE type = 'SALE' AND status = 'COMPLETED' AND DATE_FORMAT(date, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`
    );

    const invSummary = await db.getOne(
      `SELECT SUM(current_stock * buy_price) as total_valuation, COUNT(*) as product_count FROM products WHERE is_active = 1`
    );

    const cashBank = await db.getOne(
      `SELECT (SUM(jel.debit) - SUM(jel.credit)) as balance
       FROM journal_entry_lines jel
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       JOIN accounts a ON jel.account_id = a.id
       WHERE a.account_code IN ('1001', '1002') AND je.status = 'POSTED'`
    );

    // Laba Kotor / Bersih berjalan
    const revTotal = await db.getOne(
      `SELECT SUM(jel.credit - jel.debit) as total
       FROM journal_entry_lines jel
       JOIN accounts a ON jel.account_id = a.id
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       WHERE a.account_type = 'REVENUE' AND je.status = 'POSTED'`
    );
    const expTotal = await db.getOne(
      `SELECT SUM(jel.debit - jel.credit) as total
       FROM journal_entry_lines jel
       JOIN accounts a ON jel.account_id = a.id
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       WHERE a.account_type = 'EXPENSE' AND je.status = 'POSTED'`
    );
    const totalRev = Number(revTotal && revTotal.total ? revTotal.total : 0);
    const totalExp = Number(expTotal && expTotal.total ? expTotal.total : 0);
    const netProfit = totalRev - totalExp;

    // Tren Penjualan 7 Hari Terakhir
    const last7Days = await db.query(
      `SELECT DATE_FORMAT(d.dt, '%Y-%m-%d') as sale_date,
              DATE_FORMAT(d.dt, '%d %b') as label,
              COALESCE(SUM(t.total_amount), 0) as total,
              COUNT(t.id) as count
       FROM (
         SELECT CURDATE() - INTERVAL (a.a + (10 * b.a)) DAY as dt
         FROM (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) AS a
         CROSS JOIN (SELECT 0 AS a) AS b
       ) d
       LEFT JOIN transactions t ON DATE(t.date) = d.dt AND t.type = 'SALE' AND t.status = 'COMPLETED'
       GROUP BY d.dt, label
       ORDER BY d.dt ASC`
    );

    // Komposisi Pembayaran
    const paymentBreakdown = await db.query(
      `SELECT payment_method, COUNT(*) as count, SUM(total_amount) as total
       FROM transactions
       WHERE type = 'SALE' AND status = 'COMPLETED'
       GROUP BY payment_method`
    );

    // Top 5 Produk Terlaris
    const topProducts = await db.query(
      `SELECT p.name, p.sku, SUM(ti.qty) as total_qty, SUM(ti.subtotal) as total_sales
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id
       JOIN products p ON ti.product_id = p.id
       WHERE t.type = 'SALE' AND t.status = 'COMPLETED'
       GROUP BY p.id, p.name, p.sku
       ORDER BY total_qty DESC
       LIMIT 5`
    );

    // 5 Transaksi Kasir Terkini
    const recentTransactions = await db.query(
      `SELECT t.id, t.invoice_no, t.date, t.total_amount, t.payment_method, t.status,
              u.name as cashier_name
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.type = 'SALE'
       ORDER BY t.created_at DESC
       LIMIT 5`
    );

    return res.json({
      success: true,
      kpis: {
        todaySalesTotal: todaySales && todaySales.total ? Number(todaySales.total) : 0,
        todaySalesCount: todaySales && todaySales.count ? Number(todaySales.count) : 0,
        monthSalesTotal: monthSales && monthSales.total ? Number(monthSales.total) : 0,
        monthSalesCount: monthSales && monthSales.count ? Number(monthSales.count) : 0,
        inventoryValuation: invSummary && invSummary.total_valuation ? Number(invSummary.total_valuation) : 0,
        totalProducts: invSummary && invSummary.product_count ? Number(invSummary.product_count) : 0,
        cashLiquidity: cashBank && cashBank.balance ? Number(cashBank.balance) : 0,
        netProfit
      },
      charts: {
        trend7Days: last7Days,
        paymentComposition: paymentBreakdown,
        topSellingProducts: topProducts
      },
      recentTransactions
    });
  }
}

module.exports = ReportController;
