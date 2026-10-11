const db = require('../config/database');

class FinanceController {
  // 1. Likuiditas Saldo Kas & Bank
  static async getLiquidity(req, res) {
    const cashBankAccounts = await db.query("SELECT * FROM accounts WHERE account_code IN ('1001', '1002')");

    const liquidity = await Promise.all(cashBankAccounts.map(async (acc) => {
      const sum = await db.getOne(
        `SELECT (SUM(jel.debit) - SUM(jel.credit)) as balance
         FROM journal_entry_lines jel JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = ? AND je.status = 'POSTED'`,
        [acc.id]
      );
      return {
        id: acc.id,
        code: acc.account_code,
        name: acc.account_name,
        balance: Number(sum ? sum.balance || 0 : 0)
      };
    }));

    const totalLiquidity = liquidity.reduce((sum, a) => sum + a.balance, 0);

    return res.json({
      success: true,
      totalLiquidity,
      accounts: liquidity
    });
  }

  // 2. Piutang (AR) & Utang (AP)
  static async getArApSummary(req, res) {
    // Piutang Pelanggan (Penjualan Belum Lunas)
    const receivables = await db.query(
      `SELECT t.*, c.name as customer_name, c.phone as customer_phone
       FROM transactions t
       LEFT JOIN contacts c ON t.contact_id = c.id
       WHERE t.type = 'SALE' AND t.payment_status IN ('UNPAID', 'PARTIAL') AND t.status != 'VOID'
       ORDER BY t.date ASC`
    );

    // Utang ke Supplier (Pembelian Belum Lunas)
    const payables = await db.query(
      `SELECT t.*, c.name as supplier_name, c.phone as supplier_phone
       FROM transactions t
       LEFT JOIN contacts c ON t.contact_id = c.id
       WHERE t.type = 'PURCHASE' AND t.payment_status IN ('UNPAID', 'PARTIAL') AND t.status != 'VOID'
       ORDER BY t.date ASC`
    );

    const totalAr = receivables.reduce((sum, r) => sum + (Number(r.total_amount) - Number(r.paid_amount)), 0);
    const totalAp = payables.reduce((sum, p) => sum + (Number(p.total_amount) - Number(p.paid_amount)), 0);

    return res.json({
      success: true,
      totalReceivables: totalAr,
      totalPayables: totalAp,
      receivables,
      payables
    });
  }

  // 3. Catat Pembayaran / Pelunasan (Payment Voucher)
  static async processPayment(req, res) {
    const { transaction_id, payment_date, amount, account_id, payment_type, notes } = req.body;

    if (!transaction_id || !amount || !account_id || !payment_type) {
      return res.status(400).json({ success: false, message: 'ID Transaksi, Jumlah, Akun Kas/Bank, dan Tipe Pembayaran wajib diisi.' });
    }

    const tx = await db.getOne('SELECT * FROM transactions WHERE id = ?', [transaction_id]);
    if (!tx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    try {
      const payAmount = Number(amount);
      const newPaid = Number(tx.paid_amount) + payAmount;
      const isPaidFull = newPaid >= Number(tx.total_amount);

      const payNo = `PAY/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${Math.floor(100 + Math.random() * 900)}`;

      await db.transaction(async (trx) => {
        // Catat Payment
        await trx.run(
          `INSERT INTO payments (payment_no, transaction_id, payment_date, amount, account_id, payment_type, reference_notes, received_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [payNo, transaction_id, payment_date || new Date().toISOString().slice(0, 10), payAmount, account_id, payment_type, notes || '', req.user.id]
        );

        // Update status transaksi
        await trx.run(
          'UPDATE transactions SET paid_amount = ?, payment_status = ? WHERE id = ?',
          [newPaid, isPaidFull ? 'PAID' : 'PARTIAL', transaction_id]
        );

        // Jurnal Otomatis Pelunasan
        const jNo = `JV-PAY-${payNo.replace(/\//g, '-')}`;
        const jEntry = await trx.run(
          `INSERT INTO journal_entries (journal_no, entry_date, reference_type, reference_id, description, status, posted_by, posted_at, created_by)
           VALUES (?, CURDATE(), 'PAYMENT', ?, ?, 'POSTED', ?, NOW(), ?)`,
          [jNo, transaction_id, `Pelunasan ${payment_type === 'RECEIPT_PIUTANG' ? 'Piutang' : 'Utang'} ${tx.invoice_no}`, req.user.id, req.user.id]
        );
        const jId = jEntry.insertId;

        if (payment_type === 'RECEIPT_PIUTANG') {
          const accAr = (await trx.getOne("SELECT id FROM accounts WHERE account_code = '1101'")).id;
          await trx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)', [jId, account_id, payAmount, `Penerimaan Pelunasan Piutang ${tx.invoice_no}`]);
          await trx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)', [jId, accAr, payAmount, `Pengurangan Piutang ${tx.invoice_no}`]);
        } else {
          const accAp = (await trx.getOne("SELECT id FROM accounts WHERE account_code = '2001'")).id;
          await trx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, ?, 0, ?)', [jId, accAp, payAmount, `Pelunasan Utang Pembelian ${tx.invoice_no}`]);
          await trx.run('INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo) VALUES (?, ?, 0, ?, ?)', [jId, account_id, payAmount, `Kas Keluar Pelunasan Utang ${tx.invoice_no}`]);
        }
      });

      return res.json({ success: true, message: `Pembayaran ${payNo} sebesar Rp ${payAmount.toLocaleString('id-ID')} berhasil diproses.` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 4. Arus Kas (Cash Flow)
  static async getCashFlow(req, res) {
    const cashEntries = await db.query(
      `SELECT jel.*, je.journal_no, je.entry_date, je.description, je.reference_type, a.account_name, a.account_code
       FROM journal_entry_lines jel
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       JOIN accounts a ON jel.account_id = a.id
       WHERE a.account_code IN ('1001', '1002') AND je.status = 'POSTED'
       ORDER BY je.entry_date DESC, je.id DESC LIMIT 100`
    );

    let totalInflow = 0;
    let totalOutflow = 0;

    const streams = cashEntries.map((c) => {
      const debit = Number(c.debit);
      const credit = Number(c.credit);
      totalInflow += debit;
      totalOutflow += credit;

      return {
        date: c.entry_date,
        journal_no: c.journal_no,
        description: c.description,
        account: `${c.account_code} - ${c.account_name}`,
        inflow: debit,
        outflow: credit,
        net: debit - credit
      };
    });

    return res.json({
      success: true,
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow - totalOutflow,
      streams
    });
  }
}

module.exports = FinanceController;
