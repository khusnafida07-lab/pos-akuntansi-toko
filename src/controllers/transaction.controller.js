const db = require('../config/database');
const { ROLES } = require('../config/rbac-matrix');

class TransactionController {
  // Buat transaksi POS / Penjualan Kasir
  static async createSale(req, res) {
    const {
      contact_id,
      items,
      payment_method, // 'CASH', 'TRANSFER', 'CREDIT'
      paid_amount,
      discount_amount = 0,
      notes
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar item belanja tidak boleh kosong.' });
    }

    try {
      let createdTransaction;

      await db.transaction(async (tx) => {
        // 1. Validasi stok dan hitung total serta HPP
        let subtotal = 0;
        let totalCogs = 0;
        const processedItems = [];

        for (const item of items) {
          const product = await tx.getOne('SELECT * FROM products WHERE id = ?', [item.product_id]);
          if (!product) {
            throw new Error(`Produk dengan ID ${item.product_id} tidak ditemukan.`);
          }

          if (Number(product.current_stock) < Number(item.qty)) {
            throw new Error(`Stok produk '${product.name}' tidak mencukupi (Tersedia: ${product.current_stock}, Diminta: ${item.qty}).`);
          }

          const price = item.unit_price !== undefined ? Number(item.unit_price) : Number(product.sell_price);
          const itemDiscount = Number(item.discount_item || 0);
          const itemSubtotal = (price * item.qty) - itemDiscount;

          subtotal += itemSubtotal;
          totalCogs += (Number(product.buy_price) * item.qty);

          processedItems.push({
            product,
            qty: item.qty,
            unit_price: price,
            discount_item: itemDiscount,
            subtotal: itemSubtotal
          });
        }

        const totalAmount = subtotal - Number(discount_amount);
        const paid = Number(paid_amount || 0);
        let change = 0;
        let paymentStatus = 'PAID';

        if (payment_method === 'CASH') {
          if (paid < totalAmount) {
            throw new Error(`Jumlah pembayaran tunai (Rp ${paid.toLocaleString('id-ID')}) kurang dari total tagihan (Rp ${totalAmount.toLocaleString('id-ID')}).`);
          }
          change = paid - totalAmount;
        } else if (payment_method === 'CREDIT') {
          paymentStatus = 'UNPAID';
        }

        // Generate Nomor Invoice
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const countRes = await tx.getOne("SELECT COUNT(*) as count FROM transactions WHERE type = 'SALE' AND DATE(date) = CURDATE()");
        const countToday = Number(countRes ? countRes.count : 0);
        const invoiceNo = `INV/${todayStr}/${String(countToday + 1).padStart(4, '0')}`;

        // Otorisasi diskon besar
        let status = 'COMPLETED';
        let discountApprovedBy = null;
        if (discount_amount > 50000 && req.user.role === ROLES.KASIR) {
          status = 'PENDING_APPROVAL';
        }

        // Insert Transaksi
        const txResult = await tx.run(
          `INSERT INTO transactions (
            invoice_no, type, contact_id, user_id, subtotal, discount_amount, discount_approved_by,
            tax_amount, total_amount, payment_method, payment_status, paid_amount, change_amount,
            status, notes
          ) VALUES (?, 'SALE', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceNo,
            contact_id || 1, // Default walk-in customer
            req.user.id,
            subtotal,
            discount_amount,
            discountApprovedBy,
            totalAmount,
            payment_method,
            paymentStatus,
            paid,
            change,
            status,
            notes || 'Transaksi Penjualan POS Kasir'
          ]
        );

        const transactionId = txResult.insertId;

        // Insert Item Transaksi & Potong Stok
        for (const it of processedItems) {
          await tx.run(
            `INSERT INTO transaction_items (transaction_id, product_id, qty, unit_price, discount_item, subtotal)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [transactionId, it.product.id, it.qty, it.unit_price, it.discount_item, it.subtotal]
          );

          if (status === 'COMPLETED') {
            const stockBefore = Number(it.product.current_stock);
            const stockAfter = stockBefore - Number(it.qty);

            await tx.run('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [stockAfter, it.product.id]);

            await tx.run(
              `INSERT INTO stock_movements (product_id, movement_type, reference_no, qty_change, stock_before, stock_after, notes, created_by)
               VALUES (?, 'OUT_SALE', ?, ?, ?, ?, 'Penjualan Kasir POS', ?)`,
              [it.product.id, invoiceNo, -it.qty, stockBefore, stockAfter, req.user.id]
            );
          }
        }

        // Catat Otomatisasi Jurnal Akuntansi Double-Entry jika status COMPLETED
        let journalNo = null;
        if (status === 'COMPLETED') {
          journalNo = `JV-SALE-${invoiceNo.replace(/\//g, '-')}`;
          const jEntry = await tx.run(
            `INSERT INTO journal_entries (journal_no, entry_date, reference_type, reference_id, description, status, posted_by, posted_at, created_by)
             VALUES (?, CURDATE(), 'SALE', ?, ?, 'POSTED', ?, NOW(), ?)`,
            [journalNo, transactionId, `Pencatatan Penjualan Faktur ${invoiceNo}`, req.user.id, req.user.id]
          );
          const jId = jEntry.insertId;

          // Tentukan Akun Penerimaan Kas/Bank/Piutang
          let debitAccCode = '1001'; // Kas Toko
          if (payment_method === 'TRANSFER') debitAccCode = '1002'; // Bank BCA
          if (payment_method === 'CREDIT') debitAccCode = '1101'; // Piutang Usaha

          const accDebit = (await tx.getOne('SELECT id FROM accounts WHERE account_code = ?', [debitAccCode])).id;
          const accPenjualan = (await tx.getOne("SELECT id FROM accounts WHERE account_code = '4001'")).id;
          const accHpp = (await tx.getOne("SELECT id FROM accounts WHERE account_code = '5001'")).id;
          const accPersediaan = (await tx.getOne("SELECT id FROM accounts WHERE account_code = '1201'")).id;

          // 1. Debit Kas/Bank/Piutang & Kredit Pendapatan Penjualan
          await tx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)', [jId, accDebit, totalAmount, `Penerimaan Pembayaran ${invoiceNo}`]);
          await tx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)', [jId, accPenjualan, totalAmount, `Pendapatan Penjualan ${invoiceNo}`]);

          // 2. Debit HPP & Kredit Persediaan Barang Dagang
          if (totalCogs > 0) {
            await tx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)', [jId, accHpp, totalCogs, `Beban Pokok Penjualan ${invoiceNo}`]);
            await tx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)', [jId, accPersediaan, totalCogs, `Pengurangan Persediaan ${invoiceNo}`]);
          }
        }

        createdTransaction = {
          id: transactionId,
          invoice_no: invoiceNo,
          subtotal,
          discount_amount: Number(discount_amount || 0),
          total_amount: totalAmount,
          paid_amount: paid,
          change_amount: change,
          payment_method,
          status,
          journal_no: journalNo
        };
      });

      return res.status(201).json({
        success: true,
        message: createdTransaction.status === 'COMPLETED' ? 'Transaksi penjualan berhasil diproses!' : 'Transaksi memerlukan persetujuan diskon Kepala Toko.',
        transaction: createdTransaction
      });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // Ambil daftar transaksi (dengan filter dan RBAC)
  static async getAll(req, res) {
    const { type = 'SALE', status, date_from, date_to, payment_method, search } = req.query;
    let sql = `
      SELECT t.*, u.name as cashier_name, c.name as customer_name
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      sql += ' AND t.type = ?';
      params.push(type);
    }

    if (status && status !== 'ALL') {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    if (payment_method && payment_method !== 'ALL') {
      sql += ' AND t.payment_method = ?';
      params.push(payment_method);
    }

    if (search) {
      sql += ' AND (t.invoice_no LIKE ? OR u.name LIKE ? OR c.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Jika Kasir, hanya bisa melihat transaksi shift-nya sendiri
    if (req.user.role === ROLES.KASIR) {
      sql += ' AND t.user_id = ?';
      params.push(req.user.id);
    }

    if (date_from) {
      sql += ' AND DATE(t.date) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND DATE(t.date) <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY t.created_at DESC LIMIT 300';
    const transactions = await db.query(sql, params);

    const totalAmount = transactions
      .filter(t => t.status === 'COMPLETED')
      .reduce((sum, t) => sum + Number(t.total_amount || 0), 0);
    const completedCount = transactions.filter(t => t.status === 'COMPLETED').length;
    const voidCount = transactions.filter(t => t.status === 'VOID').length;
    const pendingCount = transactions.filter(t => t.status === 'PENDING_APPROVAL').length;

    return res.json({
      success: true,
      summary: {
        totalTransactions: transactions.length,
        totalAmount,
        completedCount,
        voidCount,
        pendingCount
      },
      transactions
    });
  }

  // Detail struk transaksi
  static async getReceipt(req, res) {
    const { id } = req.params;
    const transaction = await db.getOne(
      `SELECT t.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN contacts c ON t.contact_id = c.id
       WHERE t.id = ?`,
      [id]
    );

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const items = await db.query(
      `SELECT ti.*, p.name as product_name, p.sku, p.unit
       FROM transaction_items ti
       JOIN products p ON ti.product_id = p.id
       WHERE ti.transaction_id = ?`,
      [id]
    );

    // Ambil info jurnal akuntansi terkait
    const journal = await db.getOne(
      `SELECT * FROM journal_entries WHERE reference_type = 'SALE' AND reference_id = ?`,
      [id]
    );

    let journalLines = [];
    if (journal) {
      journalLines = await db.query(
        `SELECT jel.*, a.account_code, a.account_name
         FROM journal_entry_lines jel
         JOIN accounts a ON jel.account_id = a.id
         WHERE jel.journal_entry_id = ?
         ORDER BY jel.debit DESC, jel.credit DESC`,
        [journal.id]
      );
    }

    return res.json({
      success: true,
      transaction,
      items,
      journal: journal ? { ...journal, lines: journalLines } : null
    });
  }

  // Permohonan Void oleh Kasir
  static async requestVoid(req, res) {
    const { id } = req.params;
    const void_reason = req.body.void_reason || req.body.reason;

    if (!void_reason) {
      return res.status(400).json({ success: false, message: 'Alasan pembatalan (void) wajib diisi.' });
    }

    const tx = await db.getOne('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!tx) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    if (tx.status === 'VOID') {
      return res.status(400).json({ success: false, message: 'Transaksi sudah dibatalkan sebelumnya.' });
    }

    await db.run(
      `UPDATE transactions
       SET status = 'PENDING_APPROVAL', void_reason = ?
       WHERE id = ?`,
      [void_reason, id]
    );

    return res.json({
      success: true,
      message: 'Permohonan pembatalan (void) transaksi berhasil diajukan ke Kepala Toko.'
    });
  }

  // Otorisasi Void oleh Kepala Toko / Owner
  static async approveVoid(req, res) {
    const { id } = req.params;
    const { approved, notes } = req.body;

    const transaction = await db.getOne('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    if (transaction.status === 'VOID') {
      return res.status(400).json({ success: false, message: 'Transaksi sudah berstatus VOID.' });
    }

    if (!approved) {
      await db.run("UPDATE transactions SET status = 'COMPLETED', void_reason = ? WHERE id = ?", [`Ditolak oleh ${req.user.name}: ${notes || ''}`, id]);
      return res.json({ success: true, message: 'Permohonan void ditolak oleh Kepala Toko.' });
    }

    try {
      await db.transaction(async (tx) => {
        // 1. Ambil item untuk kembalikan stok
        const items = await tx.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [id]);
        for (const it of items) {
          const prod = await tx.getOne('SELECT current_stock FROM products WHERE id = ?', [it.product_id]);
          const stockBefore = Number(prod.current_stock);
          const stockAfter = stockBefore + Number(it.qty);

          await tx.run('UPDATE products SET current_stock = ? WHERE id = ?', [stockAfter, it.product_id]);

          await tx.run(
            `INSERT INTO stock_movements (product_id, movement_type, reference_no, qty_change, stock_before, stock_after, notes, created_by)
             VALUES (?, 'IN_RETURN', ?, ?, ?, ?, 'Pengembalian Stok Akibat Pembatalan (VOID) Transaksi', ?)`,
            [it.product_id, transaction.invoice_no, it.qty, stockBefore, stockAfter, req.user.id]
          );
        }

        // 2. Update status transaksi jadi VOID
        await tx.run(
          `UPDATE transactions
           SET status = 'VOID', void_approved_by = ?
           WHERE id = ?`,
          [req.user.id, id]
        );

        // 3. Jurnal Pembalik Akuntansi (Reversal Entry)
        const origJournal = await tx.getOne("SELECT id FROM journal_entries WHERE reference_type = 'SALE' AND reference_id = ?", [id]);
        if (origJournal) {
          const jNo = `REV-${transaction.invoice_no.replace(/\//g, '-')}`;
          const revEntry = await tx.run(
            `INSERT INTO journal_entries (journal_no, entry_date, reference_type, reference_id, description, status, posted_by, posted_at, created_by)
             VALUES (?, CURDATE(), 'MANUAL', ?, ?, 'POSTED', ?, NOW(), ?)`,
            [jNo, id, `Jurnal Pembalik Pembatalan (VOID) Transaksi ${transaction.invoice_no}`, req.user.id, req.user.id]
          );
          const revId = revEntry.insertId;

          // Balikkan baris debit & kredit
          const origLines = await tx.query('SELECT * FROM journal_entry_lines WHERE journal_entry_id = ?', [origJournal.id]);
          for (const line of origLines) {
            await tx.run(
              `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
               VALUES (?, ?, ?, ?, ?)`,
              [revId, line.account_id, line.credit, line.debit, `Pembalik: ${line.memo}`]
            );
          }
        }
      });

      return res.json({
        success: true,
        message: `Transaksi ${transaction.invoice_no} berhasil di-VOID oleh Kepala Toko. Stok dan jurnal telah dikembalikan secara otomatis!`
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // Kontak (Customer / Supplier)
  static async getContacts(req, res) {
    const { type } = req.query;
    let sql = 'SELECT * FROM contacts';
    const params = [];
    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }
    sql += ' ORDER BY name ASC';
    const contacts = await db.query(sql, params);
    return res.json({ success: true, contacts });
  }
}

module.exports = TransactionController;
