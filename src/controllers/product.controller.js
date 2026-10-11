const db = require('../config/database');

class ProductController {
  static async getAll(req, res) {
    const { search, category_id, low_stock } = req.query;
    let sql = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params = [];

    if (search) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category_id) {
      sql += ' AND p.category_id = ?';
      params.push(category_id);
    }

    if (low_stock === 'true') {
      sql += ' AND p.current_stock <= p.min_stock';
    }

    sql += ' ORDER BY p.name ASC';
    const products = await db.query(sql, params);

    return res.json({
      success: true,
      count: products.length,
      products
    });
  }

  static async getById(req, res) {
    const { id } = req.params;
    const product = await db.getOne(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [id]
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    // Ambil riwayat kartu stok terakhir produk ini
    const movements = await db.query(
      `SELECT sm.*, u.name as created_by_name
       FROM stock_movements sm
       LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.product_id = ?
       ORDER BY sm.created_at DESC LIMIT 20`,
      [id]
    );

    return res.json({
      success: true,
      product,
      recentStockMovements: movements
    });
  }

  static async create(req, res) {
    const { sku, barcode, name, category_id, unit, buy_price, sell_price, min_stock, initial_stock } = req.body;

    if (!sku || !name || buy_price === undefined || sell_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'SKU, Nama Produk, Harga Beli, dan Harga Jual wajib diisi.'
      });
    }

    const existingSku = await db.getOne('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existingSku) {
      return res.status(400).json({ success: false, message: `SKU '${sku}' sudah digunakan.` });
    }

    try {
      let productId;
      await db.transaction(async (tx) => {
        const result = await tx.run(
          `INSERT INTO products (sku, barcode, name, category_id, unit, buy_price, sell_price, current_stock, min_stock)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sku,
            barcode || null,
            name,
            category_id || null,
            unit || 'pcs',
            buy_price || 0,
            sell_price || 0,
            initial_stock || 0,
            min_stock || 5
          ]
        );
        productId = result.insertId;

        if (initial_stock && initial_stock > 0) {
          await tx.run(
            `INSERT INTO stock_movements (product_id, movement_type, reference_no, qty_change, stock_before, stock_after, notes, created_by)
             VALUES (?, 'OPNAME_ADJUSTMENT', 'INIT-STOCK', ?, 0, ?, 'Saldo persediaan awal produk baru', ?)`,
            [productId, initial_stock, initial_stock, req.user.id]
          );
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Produk berhasil ditambahkan.',
        productId
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Gagal menambahkan produk: ' + err.message });
    }
  }

  static async update(req, res) {
    const { id } = req.params;
    const { name, category_id, unit, buy_price, sell_price, min_stock } = req.body;

    const existing = await db.getOne('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    await db.run(
      `UPDATE products
       SET name = ?, category_id = ?, unit = ?, buy_price = ?, sell_price = ?, min_stock = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name || existing.name,
        category_id !== undefined ? category_id : existing.category_id,
        unit || existing.unit,
        buy_price !== undefined ? buy_price : existing.buy_price,
        sell_price !== undefined ? sell_price : existing.sell_price,
        min_stock !== undefined ? min_stock : existing.min_stock,
        id
      ]
    );

    return res.json({ success: true, message: 'Data produk berhasil diperbarui.' });
  }

  static async getCategories(req, res) {
    const categories = await db.query('SELECT * FROM categories ORDER BY name ASC');
    return res.json({ success: true, categories });
  }
}

module.exports = ProductController;
