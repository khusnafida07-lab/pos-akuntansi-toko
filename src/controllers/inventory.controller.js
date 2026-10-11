const db = require('../config/database');

class InventoryController {
  // 1. Penerimaan Barang Pembelian (Purchase Goods Receipt)
  static async receivePurchase(req, res) {
    const { supplier_id, invoice_no, items, notes, payment_method = 'CASH' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar item penerimaan barang tidak boleh kosong.' });
    }

    try {
      let createdPurchase;

      await db.transaction(async (tx) => {
        let totalAmount = 0;
        const purchaseNo = invoice_no || `PO/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${Math.floor(1000 + Math.random() * 9000)}`;

        for (const item of items) {
          const product = await tx.getOne('SELECT * FROM products WHERE id = ?', [item.product_id]);
          if (!product) throw new Error(`Produk ID ${item.product_id} tidak valid.`);

          const cost = Number(item.unit_cost || product.buy_price);
          const subtotal = cost * item.qty;
          totalAmount += subtotal;
        }

        // Catat Transaksi Tipe PURCHASE
        const txResult = await tx.run(
          `INSERT INTO transactions (
            invoice_no, type, contact_id, user_id, subtotal, total_amount, payment_method, payment_status, status, notes
          ) VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?, 'PAID', 'COMPLETED', ?)`,
          [purchaseNo, supplier_id || 3, req.user.id, totalAmount, totalAmount, payment_method, notes || 'Penerimaan barang dari supplier']
        );
        const transactionId = txResult.insertId;

        // Tambah stok dan kartu stok
        for (const item of items) {
          const product = await tx.getOne('SELECT * FROM products WHERE id = ?', [item.product_id]);
          const cost = Number(item.unit_cost || product.buy_price);
          const subtotal = cost * item.qty;

          await tx.run(
            `INSERT INTO transaction_items (transaction_id, product_id, qty, unit_price, subtotal)
             VALUES (?, ?, ?, ?, ?)`,
            [transactionId, product.id, item.qty, cost, subtotal]
          );

          const stockBefore = Number(product.current_stock);
          const stockAfter = stockBefore + Number(item.qty);

          // Update stok & perbarui buy_price bila ada perubahan harga
          await tx.run(
            'UPDATE products SET current_stock = ?, buy_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [stockAfter, cost, product.id]
          );

          await tx.run(
            `INSERT INTO stock_movements (product_id, movement_type, reference_no, qty_change, stock_before, stock_after, notes, created_by)
             VALUES (?, 'IN_PURCHASE', ?, ?, ?, ?, 'Penerimaan Pembelian Supplier', ?)`,
            [product.id, purchaseNo, item.qty, stockBefore, stockAfter, req.user.id]
          );
        }

        // Auto Journal Pembelian
        const jNo = `JV-PURCHASE-${purchaseNo.replace(/\//g, '-')}`;
        const jEntry = await tx.run(
          `INSERT INTO journal_entries (journal_no, entry_date, reference_type, reference_id, description, status, posted_by, posted_at, created_by)
           VALUES (?, CURDATE(), 'PURCHASE', ?, ?, 'POSTED', ?, NOW(), ?)`,
          [jNo, transactionId, `Penerimaan Pembelian Barang ${purchaseNo}`, req.user.id, req.user.id]
        );
        const jId = jEntry.insertId;

        const accPersediaan = (await tx.getOne("SELECT id FROM accounts WHERE account_code = '1201'")).id;
        const creditAccCode = payment_method === 'CREDIT' ? '2001' : (payment_method === 'TRANSFER' ? '1002' : '1001');
        const accCredit = (await tx.getOne('SELECT id FROM accounts WHERE account_code = ?', [creditAccCode])).id;

        await tx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)', [jId, accPersediaan, totalAmount, `Penambahan Persediaan ${purchaseNo}`]);
        await tx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)', [jId, accCredit, totalAmount, `Pengeluaran Pembayaran Pembelian ${purchaseNo}`]);

        createdPurchase = { id: transactionId, purchaseNo, totalAmount };
      });

      return res.status(201).json({
        success: true,
        message: 'Penerimaan barang dan penambahan stok berhasil dicatat!',
        purchase: createdPurchase
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // 2. Kartu Stok (Stock Movements)
  static async getStockMovements(req, res) {
    const { product_id, movement_type } = req.query;
    let sql = `
      SELECT sm.*, p.name as product_name, p.sku, p.unit, u.name as created_by_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      sql += ' AND sm.product_id = ?';
      params.push(product_id);
    }
    if (movement_type) {
      sql += ' AND sm.movement_type = ?';
      params.push(movement_type);
    }

    sql += ' ORDER BY sm.created_at DESC LIMIT 100';
    const movements = await db.query(sql, params);

    return res.json({ success: true, movements });
  }

  // 3. Stok Opname (Penghitungan Fisik vs Sistem)
  static async createStockOpname(req, res) {
    const { items, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar item opname wajib diisi.' });
    }

    try {
      let opnameId;
      const opnameNo = `OPN/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${Math.floor(100 + Math.random() * 900)}`;

      await db.transaction(async (tx) => {
        const result = await tx.run(
          `INSERT INTO stock_opnames (opname_no, opname_date, status, notes, conducted_by)
           VALUES (?, CURDATE(), 'DRAFT', ?, ?)`,
          [opnameNo, notes || 'Stok Opname Berkala Gudang', req.user.id]
        );
        opnameId = result.insertId;

        for (const it of items) {
          const product = await tx.getOne('SELECT current_stock FROM products WHERE id = ?', [it.product_id]);
          const systemStock = product ? Number(product.current_stock) : 0;
          const physicalStock = Number(it.physical_stock);
          const difference = physicalStock - systemStock;

          await tx.run(
            `INSERT INTO stock_opname_items (opname_id, product_id, system_stock, physical_stock, difference, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [opnameId, it.product_id, systemStock, physicalStock, difference, it.notes || '']
          );
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Draft Stok Opname berhasil disimpan. Menunggu otorisasi Kepala Toko.',
        opnameId,
        opnameNo
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getStockOpnames(req, res) {
    const list = await db.query(
      `SELECT so.*, u1.name as conducted_by_name, u2.name as approved_by_name
       FROM stock_opnames so
       LEFT JOIN users u1 ON so.conducted_by = u1.id
       LEFT JOIN users u2 ON so.approved_by = u2.id
       ORDER BY so.created_at DESC`
    );
    return res.json({ success: true, stockOpnames: list });
  }

  static async approveStockOpname(req, res) {
    const { id } = req.params;
    const { approved } = req.body;

    const opname = await db.getOne('SELECT * FROM stock_opnames WHERE id = ?', [id]);
    if (!opname) return res.status(404).json({ success: false, message: 'Data stok opname tidak ditemukan.' });

    if (opname.status !== 'DRAFT') {
      return res.status(400).json({ success: false, message: 'Stok opname sudah diproses sebelumnya.' });
    }

    if (!approved) {
      await db.run("UPDATE stock_opnames SET status = 'REJECTED' WHERE id = ?", [id]);
      return res.json({ success: true, message: 'Stok opname ditolak.' });
    }

    try {
      await db.transaction(async (tx) => {
        const items = await tx.query('SELECT soi.*, p.buy_price FROM stock_opname_items soi JOIN products p ON soi.product_id = p.id WHERE soi.opname_id = ?', [id]);
        let totalAdjustVal = 0;

        for (const it of items) {
          if (it.difference !== 0) {
            const prod = await tx.getOne('SELECT current_stock FROM products WHERE id = ?', [it.product_id]);
            const newStock = it.physical_stock;

            await tx.run('UPDATE products SET current_stock = ? WHERE id = ?', [newStock, it.product_id]);

            await tx.run(
              `INSERT INTO stock_movements (product_id, movement_type, reference_no, qty_change, stock_before, stock_after, notes, created_by)
               VALUES (?, 'OPNAME_ADJUSTMENT', ?, ?, ?, ?, 'Penyesuaian Fisik Opname Toko', ?)`,
              [it.product_id, opname.opname_no, it.difference, prod.current_stock, newStock, req.user.id]
            );

            totalAdjustVal += (it.difference * it.buy_price);
          }
        }

        await tx.run(
          "UPDATE stock_opnames SET status = 'APPROVED', approved_by = ? WHERE id = ?",
          [req.user.id, id]
        );
      });

      return res.json({ success: true, message: 'Stok opname telah disetujui & stok fisik telah diselaraskan dengan database!' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 4. Pengajuan Hapus Buku (Write-off) oleh Gudang
  static async requestWriteOff(req, res) {
    const { reason, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0 || !reason) {
      return res.status(400).json({ success: false, message: 'Alasan dan daftar item hapus buku wajib diisi.' });
    }

    try {
      let writeOffId;
      const writeOffNo = `WO/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${Math.floor(100 + Math.random() * 900)}`;

      await db.transaction(async (tx) => {
        let totalLoss = 0;

        for (const it of items) {
          const prod = await tx.getOne('SELECT * FROM products WHERE id = ?', [it.product_id]);
          if (!prod) throw new Error(`Produk ID ${it.product_id} tidak valid.`);
          if (Number(prod.current_stock) < Number(it.qty)) {
            throw new Error(`Stok produk '${prod.name}' tidak mencukupi untuk dihapus buku.`);
          }
          const cost = Number(it.unit_cost || prod.buy_price);
          totalLoss += (cost * it.qty);
        }

        const woResult = await tx.run(
          `INSERT INTO write_offs (write_off_no, date, reason, status, requested_by, total_loss_value)
           VALUES (?, CURDATE(), ?, 'PENDING_APPROVAL', ?, ?)`,
          [writeOffNo, reason, req.user.id, totalLoss]
        );
        writeOffId = woResult.insertId;

        for (const it of items) {
          const prod = await tx.getOne('SELECT * FROM products WHERE id = ?', [it.product_id]);
          const cost = Number(it.unit_cost || prod.buy_price);
          await tx.run(
            `INSERT INTO write_off_items (write_off_id, product_id, qty, unit_cost, total_cost)
             VALUES (?, ?, ?, ?, ?)`,
            [writeOffId, prod.id, it.qty, cost, cost * it.qty]
          );
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Pengajuan hapus buku berhasil diajukan ke Kepala Toko / Owner untuk diotorisasi.',
        writeOffId,
        writeOffNo
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  static async getWriteOffs(req, res) {
    const list = await db.query(
      `SELECT wo.*, u1.name as requested_by_name, u2.name as approved_by_name
       FROM write_offs wo
       LEFT JOIN users u1 ON wo.requested_by = u1.id
       LEFT JOIN users u2 ON wo.approved_by = u2.id
       ORDER BY wo.created_at DESC`
    );
    return res.json({ success: true, writeOffs: list });
  }

  // Otorisasi Hapus Buku oleh Kepala Toko / Owner
  static async approveWriteOff(req, res) {
    const { id } = req.params;
    const { approved, notes } = req.body;

    const wo = await db.getOne('SELECT * FROM write_offs WHERE id = ?', [id]);
    if (!wo) return res.status(404).json({ success: false, message: 'Data hapus buku tidak ditemukan.' });

    if (wo.status !== 'PENDING_APPROVAL') {
      return res.status(400).json({ success: false, message: 'Pengajuan ini sudah pernah diproses.' });
    }

    if (!approved) {
      await db.run("UPDATE write_offs SET status = 'REJECTED' WHERE id = ?", [id]);
      return res.json({ success: true, message: 'Pengajuan hapus buku ditolak.' });
    }

    try {
      await db.transaction(async (tx) => {
        const items = await tx.query('SELECT * FROM write_off_items WHERE write_off_id = ?', [id]);

        for (const it of items) {
          const prod = await tx.getOne('SELECT current_stock FROM products WHERE id = ?', [it.product_id]);
          const stockBefore = Number(prod.current_stock);
          const stockAfter = stockBefore - Number(it.qty);

          await tx.run('UPDATE products SET current_stock = ? WHERE id = ?', [stockAfter, it.product_id]);

          await tx.run(
            `INSERT INTO stock_movements (product_id, movement_type, reference_no, qty_change, stock_before, stock_after, notes, created_by)
             VALUES (?, 'WRITE_OFF', ?, ?, ?, ?, 'Hapus Buku Barang Rusak/Kadaluwarsa', ?)`,
            [it.product_id, wo.write_off_no, -it.qty, stockBefore, stockAfter, req.user.id]
          );
        }

        await tx.run(
          "UPDATE write_offs SET status = 'APPROVED', approved_by = ? WHERE id = ?",
          [req.user.id, id]
        );

        // Catat Jurnal Hapus Buku
        const jNo = `JV-WO-${wo.write_off_no.replace(/\//g, '-')}`;
        const jEntry = await tx.run(
          `INSERT INTO journal_entries (journal_no, entry_date, reference_type, reference_id, description, status, posted_by, posted_at, created_by)
           VALUES (?, CURDATE(), 'WRITE_OFF', ?, ?, 'POSTED', ?, NOW(), ?)`,
          [jNo, id, `Hapus Buku Barang Rusak/Kedaluwarsa ${wo.write_off_no}`, req.user.id, req.user.id]
        );
        const jId = jEntry.insertId;

        const accBebanWo = (await tx.getOne("SELECT id FROM accounts WHERE account_code = '6003'")).id;
        const accPersediaan = (await tx.getOne("SELECT id FROM accounts WHERE account_code = '1201'")).id;

        await tx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)', [jId, accBebanWo, wo.total_loss_value, `Beban Write-Off ${wo.write_off_no}`]);
        await tx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)', [jId, accPersediaan, wo.total_loss_value, `Pengurangan Persediaan Rusak ${wo.write_off_no}`]);
      });

      return res.json({
        success: true,
        message: 'Pengajuan hapus buku telah disetujui, stok dipotong, dan jurnal beban kerugian telah dicatat secara otomatis!'
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = InventoryController;
