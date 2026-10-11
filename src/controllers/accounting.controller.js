const db = require('../config/database');

class AccountingController {
  // 1. Bagan Akun (Chart of Accounts)
  static async getAccounts(req, res) {
    const { type } = req.query;
    let sql = 'SELECT * FROM accounts WHERE is_active = 1';
    const params = [];
    if (type) {
      sql += ' AND account_type = ?';
      params.push(type);
    }
    sql += ' ORDER BY account_code ASC';
    const accounts = await db.query(sql, params);
    return res.json({ success: true, accounts });
  }

  static async createAccount(req, res) {
    const { account_code, account_name, account_type, normal_balance, description } = req.body;

    if (!account_code || !account_name || !account_type || !normal_balance) {
      return res.status(400).json({ success: false, message: 'Kode, Nama, Tipe Akun, dan Saldo Normal wajib diisi.' });
    }

    try {
      await db.run(
        `INSERT INTO accounts (account_code, account_name, account_type, normal_balance, description)
         VALUES (?, ?, ?, ?, ?)`,
        [account_code, account_name, account_type, normal_balance, description || '']
      );
      return res.status(201).json({ success: true, message: 'Akun perkiraan berhasil ditambahkan.' });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  // 2. Jurnal Umum (Journal Entries)
  static async getJournals(req, res) {
    const { status, date_from, date_to } = req.query;
    let sql = `
      SELECT j.*, u.name as created_by_name, p.name as posted_by_name
      FROM journal_entries j
      LEFT JOIN users u ON j.created_by = u.id
      LEFT JOIN users p ON j.posted_by = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND j.status = ?';
      params.push(status);
    }
    if (date_from) {
      sql += ' AND j.entry_date >= ?';
      params.push(date_from);
    }
    if (date_to) {
      sql += ' AND j.entry_date <= ?';
      params.push(date_to);
    }

    sql += ' ORDER BY j.entry_date DESC, j.id DESC LIMIT 100';
    const journals = await db.query(sql, params);

    // Muat baris debit kredit untuk tiap jurnal secara async
    const result = await Promise.all(journals.map(async (j) => {
      const lines = await db.query(
        `SELECT jel.*, a.account_code, a.account_name, a.account_type
         FROM journal_entry_lines jel
         JOIN accounts a ON jel.account_id = a.id
         WHERE jel.journal_entry_id = ?`,
        [j.id]
      );
      const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
      const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);
      return { ...j, totalDebit, totalCredit, lines };
    }));

    return res.json({ success: true, journals: result });
  }

  // Buat Jurnal Manual (Harus Balance Debit === Kredit)
  static async createManualJournal(req, res) {
    const { entry_date, description, lines } = req.body;

    if (!description || !lines || lines.length < 2) {
      return res.status(400).json({ success: false, message: 'Jurnal minimal memiliki 2 baris (Debit & Kredit).' });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of lines) {
      totalDebit += Number(l.debit || 0);
      totalCredit += Number(l.credit || 0);
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Jurnal tidak seimbang (Unbalanced)! Total Debit: Rp ${totalDebit.toLocaleString()}, Total Kredit: Rp ${totalCredit.toLocaleString()}`
      });
    }

    try {
      let journalId;
      const todayStr = (entry_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
      const countRes = await db.getOne('SELECT COUNT(*) as c FROM journal_entries');
      const count = Number(countRes ? countRes.c : 0);
      const journalNo = `JV-MNL-${todayStr}-${String(count + 1).padStart(4, '0')}`;

      await db.transaction(async (tx) => {
        const jResult = await tx.run(
          `INSERT INTO journal_entries (journal_no, entry_date, reference_type, description, status, posted_by, posted_at, created_by)
           VALUES (?, ?, 'MANUAL', ?, 'POSTED', ?, NOW(), ?)`,
          [journalNo, entry_date || new Date().toISOString().slice(0, 10), description, req.user.id, req.user.id]
        );
        journalId = jResult.insertId;

        for (const l of lines) {
          await tx.run(
            `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
             VALUES (?, ?, ?, ?, ?)`,
            [journalId, l.account_id, Number(l.debit || 0), Number(l.credit || 0), l.memo || description]
          );
        }
      });

      return res.status(201).json({
        success: true,
        message: `Jurnal manual ${journalNo} berhasil diposting!`,
        journalId
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 3. Buku Besar (General Ledger)
  static async getGeneralLedger(req, res) {
    const { account_id } = req.query;

    let accountsSql = 'SELECT * FROM accounts WHERE is_active = 1';
    const params = [];
    if (account_id) {
      accountsSql += ' AND id = ?';
      params.push(account_id);
    }
    accountsSql += ' ORDER BY account_code ASC';

    const accounts = await db.query(accountsSql, params);

    const ledger = await Promise.all(accounts.map(async (acc) => {
      const entries = await db.query(
        `SELECT jel.*, je.journal_no, je.entry_date, je.description
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = ? AND je.status = 'POSTED'
         ORDER BY je.entry_date ASC, je.id ASC`,
        [acc.id]
      );

      let runningBalance = 0;
      const history = entries.map((entry) => {
        const debit = Number(entry.debit);
        const credit = Number(entry.credit);

        if (acc.normal_balance === 'DEBIT') {
          runningBalance += (debit - credit);
        } else {
          runningBalance += (credit - debit);
        }

        return {
          ...entry,
          debit,
          credit,
          balance: runningBalance
        };
      });

      return {
        account: acc,
        endingBalance: runningBalance,
        transactions: history
      };
    }));

    return res.json({ success: true, ledger });
  }

  // 4. Neraca Saldo (Trial Balance)
  static async getTrialBalance(req, res) {
    const accounts = await db.query('SELECT * FROM accounts WHERE is_active = 1 ORDER BY account_code ASC');

    let totalDebitSum = 0;
    let totalCreditSum = 0;

    const rows = await Promise.all(accounts.map(async (acc) => {
      const summary = await db.getOne(
        `SELECT SUM(jel.debit) as total_debit, SUM(jel.credit) as total_credit
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = ? AND je.status = 'POSTED'`,
        [acc.id]
      );

      const d = Number(summary ? summary.total_debit || 0 : 0);
      const c = Number(summary ? summary.total_credit || 0 : 0);
      let debitBalance = 0;
      let creditBalance = 0;

      if (acc.normal_balance === 'DEBIT') {
        const net = d - c;
        if (net >= 0) debitBalance = net;
        else creditBalance = Math.abs(net);
      } else {
        const net = c - d;
        if (net >= 0) creditBalance = net;
        else debitBalance = Math.abs(net);
      }

      totalDebitSum += debitBalance;
      totalCreditSum += creditBalance;

      return {
        id: acc.id,
        code: acc.account_code,
        name: acc.account_name,
        type: acc.account_type,
        debit: debitBalance,
        credit: creditBalance
      };
    }));

    return res.json({
      success: true,
      trialBalance: rows,
      totalDebit: totalDebitSum,
      totalCredit: totalCreditSum,
      isBalanced: Math.abs(totalDebitSum - totalCreditSum) < 0.01
    });
  }

  // 5. Laporan Keuangan (Laba Rugi & Neraca)
  static async getFinancialStatements(req, res) {
    // 5a. Laba Rugi (Income Statement): Pendapatan (REVENUE) - Beban (EXPENSE)
    const revenueAccounts = await db.query("SELECT * FROM accounts WHERE account_type = 'REVENUE'");
    let totalRevenue = 0;
    const revenues = await Promise.all(revenueAccounts.map(async (acc) => {
      const sum = await db.getOne(
        `SELECT (SUM(jel.credit) - SUM(jel.debit)) as net
         FROM journal_entry_lines jel JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = ? AND je.status = 'POSTED'`,
        [acc.id]
      );
      const val = Number(sum ? sum.net || 0 : 0);
      totalRevenue += val;
      return { code: acc.account_code, name: acc.account_name, amount: val };
    }));

    const expenseAccounts = await db.query("SELECT * FROM accounts WHERE account_type = 'EXPENSE'");
    let totalExpense = 0;
    const expenses = await Promise.all(expenseAccounts.map(async (acc) => {
      const sum = await db.getOne(
        `SELECT (SUM(jel.debit) - SUM(jel.credit)) as net
         FROM journal_entry_lines jel JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = ? AND je.status = 'POSTED'`,
        [acc.id]
      );
      const val = Number(sum ? sum.net || 0 : 0);
      totalExpense += val;
      return { code: acc.account_code, name: acc.account_name, amount: val };
    }));

    const netIncome = totalRevenue - totalExpense;

    // 5b. Neraca (Balance Sheet): Aset, Liabilitas, Ekuitas (+ Net Income berjalan)
    const assetAccounts = await db.query("SELECT * FROM accounts WHERE account_type = 'ASSET'");
    let totalAssets = 0;
    const assets = await Promise.all(assetAccounts.map(async (acc) => {
      const sum = await db.getOne(
        `SELECT (SUM(jel.debit) - SUM(jel.credit)) as net
         FROM journal_entry_lines jel JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = ? AND je.status = 'POSTED'`,
        [acc.id]
      );
      const val = Number(sum ? sum.net || 0 : 0);
      totalAssets += val;
      return { code: acc.account_code, name: acc.account_name, amount: val };
    }));

    const liabilityAccounts = await db.query("SELECT * FROM accounts WHERE account_type = 'LIABILITY'");
    let totalLiabilities = 0;
    const liabilities = await Promise.all(liabilityAccounts.map(async (acc) => {
      const sum = await db.getOne(
        `SELECT (SUM(jel.credit) - SUM(jel.debit)) as net
         FROM journal_entry_lines jel JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = ? AND je.status = 'POSTED'`,
        [acc.id]
      );
      const val = Number(sum ? sum.net || 0 : 0);
      totalLiabilities += val;
      return { code: acc.account_code, name: acc.account_name, amount: val };
    }));

    const equityAccounts = await db.query("SELECT * FROM accounts WHERE account_type = 'EQUITY'");
    let totalEquity = 0;
    const equity = await Promise.all(equityAccounts.map(async (acc) => {
      const sum = await db.getOne(
        `SELECT (SUM(jel.credit) - SUM(jel.debit)) as net
         FROM journal_entry_lines jel JOIN journal_entries je ON jel.journal_entry_id = je.id
         WHERE jel.account_id = ? AND je.status = 'POSTED'`,
        [acc.id]
      );
      const val = Number(sum ? sum.net || 0 : 0);
      totalEquity += val;
      return { code: acc.account_code, name: acc.account_name, amount: val };
    }));

    const totalEquityWithIncome = totalEquity + netIncome;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquityWithIncome;

    return res.json({
      success: true,
      incomeStatement: {
        revenues,
        totalRevenue,
        expenses,
        totalExpense,
        netIncome
      },
      balanceSheet: {
        assets,
        totalAssets,
        liabilities,
        totalLiabilities,
        equity,
        totalEquity,
        currentPeriodProfit: netIncome,
        totalLiabilitiesAndEquity,
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01
      }
    });
  }
}

module.exports = AccountingController;
