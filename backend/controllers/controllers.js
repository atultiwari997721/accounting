const crypto = require('crypto');
const { Readable } = require('stream');
const nodemailer = require('nodemailer');
const supabase = require('../config/supabase');

// Helper to get 32-byte encryption key from passphrase
function getEncryptionKey() {
  const passphrase = process.env.BACKUP_ENCRYPTION_KEY || 'default_backup_encryption_passphrase_32_bytes!';
  return crypto.createHash('sha256').update(passphrase).digest();
}

// Encrypt text using AES-256-CBC
function encrypt(text) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt text using AES-256-CBC
function decrypt(text) {
  const key = getEncryptionKey();
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// --- Bank Account Controllers ---

const getBankAccounts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('bank_name', { ascending: true });
    
    if (error) throw error;

    // Map database fields to Mongoose format for frontend compatibility
    const mapped = data.map(a => ({
      _id: a.id,
      bankName: a.bank_name,
      currentBalance: Number(a.current_balance)
    }));

    return res.status(200).json({ success: true, data: mapped });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createBankAccount = async (req, res) => {
  try {
    const { bankName, currentBalance } = req.body;
    if (!bankName) {
      return res.status(400).json({ success: false, error: 'Bank name is required' });
    }

    const { data, error } = await supabase
      .from('bank_accounts')
      .insert([{ bank_name: bankName.trim(), current_balance: currentBalance || 0 }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        return res.status(400).json({ success: false, error: 'Bank account already exists' });
      }
      throw error;
    }

    const mapped = {
      _id: data.id,
      bankName: data.bank_name,
      currentBalance: Number(data.current_balance)
    };

    return res.status(201).json({ success: true, data: mapped });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

const bulkUpdateAccounts = async (req, res) => {
  try {
    const { accounts } = req.body;
    if (!accounts || !Array.isArray(accounts)) {
      return res.status(400).json({ success: false, error: 'Accounts array is required' });
    }

    for (const item of accounts) {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ current_balance: Number(item.currentBalance) })
        .eq('id', item.id);
      if (error) throw error;
    }

    // Fetch updated list
    const { data, error: fetchErr } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('bank_name', { ascending: true });
    if (fetchErr) throw fetchErr;

    const mapped = data.map(a => ({
      _id: a.id,
      bankName: a.bank_name,
      currentBalance: Number(a.current_balance)
    }));

    return res.status(200).json({ success: true, message: 'All bank balances updated successfully', data: mapped });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// --- Day Summary Controllers ---

const getActiveDay = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('day_summaries')
      .select('*')
      .eq('status', 'Open')
      .maybeSingle();

    if (error) throw error;

    const mapped = data ? {
      date: data.date,
      openingCash: Number(data.opening_cash),
      closingCash: Number(data.closing_cash),
      totalProfit: Number(data.total_profit),
      status: data.status
    } : null;

    return res.status(200).json({ success: true, data: mapped });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const openDay = async (req, res) => {
  try {
    const { date, openingCash } = req.body;
    if (!date || openingCash === undefined) {
      return res.status(400).json({ success: false, error: 'Date and opening cash are required' });
    }

    // Check if there is an active day open
    const { data: active, error: activeErr } = await supabase
      .from('day_summaries')
      .select('*')
      .eq('status', 'Open')
      .maybeSingle();
    if (activeErr) throw activeErr;
    if (active) {
      return res.status(400).json({ success: false, error: `Day ${active.date} is already open. Close it first.` });
    }

    // Check if day summary already exists for this date
    const { data: existing, error: existingErr } = await supabase
      .from('day_summaries')
      .select('*')
      .eq('date', date)
      .maybeSingle();
    if (existingErr) throw existingErr;

    if (existing) {
      if (existing.status === 'Closed') {
        return res.status(400).json({ success: false, error: `Day ${date} has already been closed. Cannot re-open.` });
      }
      const mapped = {
        date: existing.date,
        openingCash: Number(existing.opening_cash),
        closingCash: Number(existing.closing_cash),
        totalProfit: Number(existing.total_profit),
        status: existing.status
      };
      return res.status(200).json({ success: true, data: mapped });
    }

    const { data, error } = await supabase
      .from('day_summaries')
      .insert([{
        date,
        opening_cash: Number(openingCash),
        closing_cash: Number(openingCash),
        total_profit: 0,
        status: 'Open'
      }])
      .select()
      .single();

    if (error) throw error;

    const mapped = {
      date: data.date,
      openingCash: Number(data.opening_cash),
      closingCash: Number(data.closing_cash),
      totalProfit: Number(data.total_profit),
      status: data.status
    };

    return res.status(201).json({ success: true, data: mapped });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

const closeDay = async (req, res) => {
  try {
    const { data: active, error: activeErr } = await supabase
      .from('day_summaries')
      .select('*')
      .eq('status', 'Open')
      .maybeSingle();
    if (activeErr) throw activeErr;
    if (!active) {
      return res.status(400).json({ success: false, error: 'No open day found to close' });
    }

    // 1. Fetch current bank account balances for EOD snapshot
    const { data: accounts, error: accsErr } = await supabase
      .from('bank_accounts')
      .select('*');
    if (accsErr) throw accsErr;

    const bankBalancesSnapshot = {};
    accounts.forEach(acc => {
      bankBalancesSnapshot[acc.bank_name] = Number(acc.current_balance);
    });

    // 2. Close day and write snapshot with fallback for missing column
    let updatePayload = { 
      status: 'Closed',
      bank_balances: bankBalancesSnapshot
    };

    let { data, error } = await supabase
      .from('day_summaries')
      .update(updatePayload)
      .eq('date', active.date)
      .select()
      .maybeSingle();

    if (error && (error.message.includes('bank_balances') || error.message.includes('column'))) {
      console.warn('bank_balances column missing in day_summaries database, falling back to simple closure');
      const fallback = await supabase
        .from('day_summaries')
        .update({ status: 'Closed' })
        .eq('date', active.date)
        .select()
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;

    const mapped = {
      date: data.date,
      openingCash: Number(data.opening_cash),
      closingCash: Number(data.closing_cash),
      totalProfit: Number(data.total_profit),
      status: data.status,
      bankBalances: data.bank_balances || {}
    };

    return res.status(200).json({ success: true, message: `Day ${active.date} closed successfully`, data: mapped });
  } catch (error) {
    console.error('Error closing daily session:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const getDayHistory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('day_summaries')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);
    
    if (error) throw error;

    const mapped = data.map(d => ({
      date: d.date,
      openingCash: Number(d.opening_cash),
      closingCash: Number(d.closing_cash),
      totalProfit: Number(d.total_profit),
      status: d.status,
      bankBalances: d.bank_balances || {}
    }));

    return res.status(200).json({ success: true, data: mapped });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const reopenDay = async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ success: false, error: 'Date is required' });

    // Verify it is today's date in local time (format YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    if (date !== today) {
      return res.status(400).json({ success: false, error: 'You can only reopen the ledger for the current business day.' });
    }

    // Check if another open day exists
    const { data: active, error: activeErr } = await supabase
      .from('day_summaries')
      .select('*')
      .eq('status', 'Open')
      .maybeSingle();
    if (activeErr) throw activeErr;
    if (active) {
      return res.status(400).json({ success: false, error: `Day ${active.date} is currently open. Close it before reopening another.` });
    }

    const { data, error } = await supabase
      .from('day_summaries')
      .update({ status: 'Open' })
      .eq('date', date)
      .select()
      .single();

    if (error) throw error;
    
    const mapped = {
      date: data.date,
      openingCash: Number(data.opening_cash),
      closingCash: Number(data.closing_cash),
      totalProfit: Number(data.total_profit),
      status: data.status,
      bankBalances: data.bank_balances
    };
    return res.status(200).json({ success: true, message: `Ledger reopened successfully`, data: mapped });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

const adjustPhysicalCash = async (req, res) => {
  try {
    const { closingCash } = req.body;
    if (closingCash === undefined) {
      return res.status(400).json({ success: false, error: 'closingCash amount is required' });
    }

    const { data: active, error: activeErr } = await supabase
      .from('day_summaries')
      .select('*')
      .eq('status', 'Open')
      .maybeSingle();
    if (activeErr) throw activeErr;
    if (!active) {
      return res.status(400).json({ success: false, error: 'No active business day is currently open.' });
    }

    const { data, error } = await supabase
      .from('day_summaries')
      .update({ closing_cash: Number(closingCash) })
      .eq('date', active.date)
      .select()
      .single();

    if (error) throw error;

    const mapped = {
      date: data.date,
      openingCash: Number(data.opening_cash),
      closingCash: Number(data.closing_cash),
      totalProfit: Number(data.total_profit),
      status: data.status
    };

    return res.status(200).json({ success: true, message: 'Cash in hand adjusted successfully', data: mapped });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// --- Transaction Controllers ---

const createTransaction = async (req, res) => {
  const { bankAccountId, customerAmount, cashOut, profit, customerName, type, commissionMode } = req.body;

  if (!bankAccountId || customerAmount === undefined || cashOut === undefined || profit === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required parameters' });
  }

  const cleanName = customerName ? customerName.trim() : null;
  const targetType = type || 'Credit';
  const targetComm = commissionMode || 'Deducted';

  try {
    // Call RPC function inside PostgreSQL for ACID atomic execution
    const { data, error } = await supabase.rpc('create_transaction_atomic', {
      p_bank_account_id: bankAccountId,
      p_customer_amount: Number(customerAmount),
      p_cash_out: Number(cashOut),
      p_profit: Number(profit),
      p_customer_name: cleanName,
      p_type: targetType,
      p_commission_mode: targetComm
    });

    if (error) {
      // Fallback sequentially if RPC doesn't exist yet
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.warn('RPC function not registered in Supabase. Executing sequential queries as fallback.');
        
        // 1. Fetch open day
        const { data: activeDay } = await supabase.from('day_summaries').select('*').eq('status', 'Open').maybeSingle();
        if (!activeDay) throw new Error('No active day is currently open. Please start a day summary first.');

        // 2. Fetch bank
        const { data: bank } = await supabase.from('bank_accounts').select('*').eq('id', bankAccountId).maybeSingle();
        if (!bank) throw new Error('Bank account not found.');

        // 3. Update bank
        await supabase.from('bank_accounts').update({ current_balance: Number(bank.current_balance) + Number(customerAmount) }).eq('id', bankAccountId);

        // 4. Update day
        await supabase.from('day_summaries').update({
          closing_cash: Number(activeDay.closing_cash) - Number(cashOut),
          total_profit: Number(activeDay.total_profit) + Number(profit)
        }).eq('date', activeDay.date);

        // 5. Insert transaction
        let insertObj = {
          bank_account_id: bankAccountId,
          type: targetType,
          customer_amount: Number(customerAmount),
          cash_out: Number(cashOut),
          profit: Number(profit),
          customer_name: cleanName,
          commission_mode: targetComm
        };

        let { data: tx, error: insErr } = await supabase.from('transactions').insert([insertObj]).select().maybeSingle();
        
        if (insErr && (insErr.message.includes('commission_mode') || insErr.message.includes('column'))) {
          console.warn('commission_mode column missing in transactions, falling back to insert without it');
          delete insertObj.commission_mode;
          const fallbackIns = await supabase.from('transactions').insert([insertObj]).select().single();
          tx = fallbackIns.data;
          insErr = fallbackIns.error;
        }

        if (insErr) throw insErr;

        return res.status(201).json({ success: true, message: 'Transaction recorded (Fallback)', data: tx });
      }
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: 'Transaction recorded successfully (atomic)',
      data
    });
  } catch (error) {
    console.error('Error in createTransaction:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, bank_accounts(id, bank_name)')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (error) throw error;

    const mapped = data.map(tx => ({
      _id: tx.id,
      timestamp: tx.timestamp,
      type: tx.type,
      customerAmount: Number(tx.customer_amount),
      cashOut: Number(tx.cash_out),
      profit: Number(tx.profit),
      customerName: tx.customer_name || '',
      commissionMode: tx.commission_mode || 'Deducted',
      bankAccountId: tx.bank_accounts ? {
        _id: tx.bank_accounts.id,
        bankName: tx.bank_accounts.bank_name
      } : null
    }));

    return res.status(200).json({ success: true, data: mapped });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const updateTransactionCustomerName = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerName } = req.body;
    
    const { data, error } = await supabase
      .from('transactions')
      .update({ customer_name: customerName ? customerName.trim() : null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, message: 'Customer name updated successfully', data });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

// --- Backup & Export Controllers ---

const exportBackup = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const { data: accounts } = await supabase.from('bank_accounts').select('*');
    const { data: daySummaries } = await supabase.from('day_summaries').select('*');

    let query = supabase.from('transactions').select('*');
    if (startDate) {
      query = query.gte('timestamp', `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      query = query.lte('timestamp', `${endDate}T23:59:59Z`);
    }
    const { data: transactions, error } = await query;
    if (error) throw error;

    const backupData = {
      accounts,
      transactions,
      daySummaries,
      exportedAt: new Date().toISOString(),
      engine: 'Supabase'
    };

    const jsonString = JSON.stringify(backupData);
    const encrypted = encrypt(jsonString);

    const stream = Readable.from(encrypted);

    res.setHeader('Content-Disposition', 'attachment; filename="kiosk_backup_encrypted.bin"');
    res.setHeader('Content-Type', 'application/octet-stream');
    stream.pipe(res);
  } catch (error) {
    console.error('Export error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const exportBackupCSV = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const { data: accounts, error: accsErr } = await supabase.from('bank_accounts').select('*');
    if (accsErr) throw accsErr;

    const { data: daySummaries, error: dayErr } = await supabase.from('day_summaries').select('*');
    if (dayErr) throw dayErr;

    let query = supabase
      .from('transactions')
      .select('*, bank_accounts(id, bank_name)')
      .order('timestamp', { ascending: false });

    if (startDate) {
      query = query.gte('timestamp', `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      query = query.lte('timestamp', `${endDate}T23:59:59Z`);
    }

    const { data: transactions, error } = await query;
    if (error) throw error;

    // Group transactions by date
    const groups = {};
    transactions.forEach(tx => {
      const dateStr = tx.timestamp.split('T')[0];
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(tx);
    });

    const sortedDates = Object.keys(groups).sort();

    let csv = 'Timestamp,Bank Account,Type,Customer Amount,Cash Out,Net Profit,Commission Mode,Customer Name,Bank Running Balance,Drawer Cash Balance\n';

    for (const dateStr of sortedDates) {
      const dayTxs = groups[dateStr];
      const daySummary = daySummaries.find(d => d.date === dateStr) || {
        date: dateStr,
        opening_cash: 0,
        closing_cash: 0,
        total_profit: 0,
        status: 'Closed',
        bank_balances: {}
      };

      const dayClosingCash = Number(daySummary.closing_cash || 0);
      const dayOpeningCash = Number(daySummary.opening_cash || 0);
      const bankClosingMap = daySummary.bank_balances || {};

      // Sort newest first to trace bank balance backwards
      const txsDesc = [...dayTxs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const runningBankMap = {};
      accounts.forEach(acc => {
        if (daySummary.status === 'Open') {
          runningBankMap[acc.id] = Number(acc.current_balance || 0);
        } else {
          runningBankMap[acc.id] = bankClosingMap[acc.bank_name] !== undefined 
            ? Number(bankClosingMap[acc.bank_name]) 
            : Number(acc.current_balance || 0);
        }
      });

      const mappedDesc = txsDesc.map(tx => {
        const bankId = tx.bank_account_id;
        const currentVal = runningBankMap[bankId] !== undefined ? runningBankMap[bankId] : 0;
        tx.runningBankBalAfter = currentVal;
        runningBankMap[bankId] = currentVal - Number(tx.customer_amount || 0);
        return tx;
      });

      // Sort oldest first to compute cash running balance forwards
      const txsAsc = [...mappedDesc].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let runningCash = dayOpeningCash;
      
      const finalTxs = txsAsc.map(tx => {
        runningCash = runningCash - Number(tx.cash_out || 0);
        tx.runningCashAfter = runningCash;
        return tx;
      });

      for (const tx of finalTxs) {
        const bankName = tx.bank_accounts ? tx.bank_accounts.bank_name : 'Deleted Bank';
        const timeStr = new Date(tx.timestamp).toLocaleString();
        const custName = tx.customer_name || '';
        const commMode = tx.commission_mode || 'Deducted';
        csv += `"${timeStr}","${bankName.replace(/"/g, '""')}","${tx.type}",${tx.customer_amount},${tx.cash_out},${tx.profit},"${commMode}","${custName.replace(/"/g, '""')}",${tx.runningBankBalAfter},${tx.runningCashAfter}\n`;
      }

      const bankSnapStr = Object.entries(bankClosingMap)
        .map(([name, bal]) => `${name}: ₹${Number(bal).toLocaleString('en-IN')}`)
        .join(' | ');

      csv += `"=== EOD SUMMARY ===","Date: ${dateStr}","Total Tx: ${finalTxs.length}","Net Profit: ₹${Number(daySummary.total_profit || 0).toLocaleString('en-IN')}","Drawer Cash: ₹${Number(dayClosingCash).toLocaleString('en-IN')}","Bank Snapshots: ${bankSnapStr || 'None'}","","","",""\n\n`;
    }

    const stream = Readable.from(csv);

    res.setHeader('Content-Disposition', 'attachment; filename="kiosk_transactions_backup.csv"');
    res.setHeader('Content-Type', 'text/csv');
    stream.pipe(res);
  } catch (error) {
    console.error('CSV Export error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const importBackup = async (req, res) => {
  try {
    const { encryptedData } = req.body;
    if (!encryptedData) {
      return res.status(400).json({ success: false, error: 'Encrypted backup data payload is required' });
    }

    const decrypted = decrypt(encryptedData);
    const data = JSON.parse(decrypted);

    if (!data.accounts || !data.transactions || !data.daySummaries) {
      return res.status(400).json({ success: false, error: 'Invalid backup structure.' });
    }

    // Wipe tables
    await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('bank_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('day_summaries').delete().neq('date', '');

    // Restore bank accounts
    if (data.accounts.length > 0) {
      const cleanAccounts = data.accounts.map(a => ({
        id: a.id || a._id,
        bank_name: a.bank_name || a.bankName,
        current_balance: Number(a.current_balance !== undefined ? a.current_balance : a.currentBalance),
        created_at: a.created_at || a.createdAt || new Date().toISOString()
      }));
      const { error } = await supabase.from('bank_accounts').insert(cleanAccounts);
      if (error) throw error;
    }

    // Restore day summaries
    if (data.daySummaries.length > 0) {
      const cleanDays = data.daySummaries.map(d => ({
        date: d.date,
        opening_cash: Number(d.opening_cash !== undefined ? d.opening_cash : d.openingCash),
        closing_cash: Number(d.closing_cash !== undefined ? d.closing_cash : d.closingCash),
        total_profit: Number(d.total_profit !== undefined ? d.total_profit : d.totalProfit),
        status: d.status,
        created_at: d.created_at || d.createdAt || new Date().toISOString()
      }));
      const { error } = await supabase.from('day_summaries').insert(cleanDays);
      if (error) throw error;
    }

    // Restore transactions
    if (data.transactions.length > 0) {
      const cleanTxs = data.transactions.map(t => ({
        id: t.id || t._id,
        timestamp: t.timestamp,
        bank_account_id: t.bank_account_id || t.bankAccountId,
        type: t.type || 'Credit',
        customer_amount: Number(t.customer_amount !== undefined ? t.customer_amount : t.customerAmount),
        cash_out: Number(t.cash_out !== undefined ? t.cash_out : t.cashOut),
        profit: Number(t.profit !== undefined ? t.profit : t.profit),
        customer_name: t.customer_name || t.customerName || null,
        created_at: t.created_at || t.createdAt || new Date().toISOString()
      }));
      const { error } = await supabase.from('transactions').insert(cleanTxs);
      if (error) throw error;
    }

    return res.status(200).json({
      success: true,
      message: `Database restored: ${data.accounts.length} bank accounts, ${data.transactions.length} transactions, and ${data.daySummaries.length} daily summaries.`
    });
  } catch (error) {
    console.error('Import error:', error);
    return res.status(400).json({ success: false, error: `Failed to restore database: ${error.message}` });
  }
};

// --- Scheduled Email Backup Delivery Handler ---

const emailDailyBackup = async (startDate, endDate) => {
  try {
    const emailRecipient = process.env.NOTIFICATION_EMAIL || 'atultiwari997721@gmail.com';
    
    // 1. Gather all collections
    const { data: accounts } = await supabase.from('bank_accounts').select('*');
    const { data: daySummaries } = await supabase.from('day_summaries').select('*');
    
    let txQuery = supabase.from('transactions').select('*, bank_accounts(id, bank_name)').order('timestamp', { ascending: false });
    if (startDate) {
      txQuery = txQuery.gte('timestamp', `${startDate}T00:00:00Z`);
    }
    if (endDate) {
      txQuery = txQuery.lte('timestamp', `${endDate}T23:59:59Z`);
    }
    const { data: transactions, error: txErr } = await txQuery;
    if (txErr) throw txErr;

    // Group transactions by date
    const groups = {};
    (transactions || []).forEach(tx => {
      const dateStr = tx.timestamp.split('T')[0];
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(tx);
    });

    const sortedDates = Object.keys(groups).sort();

    // 2. Build CSV
    let csv = 'Timestamp,Bank Account,Type,Customer Amount,Cash Out,Net Profit,Commission Mode,Customer Name,Bank Running Balance,Drawer Cash Balance\n';
    
    let totalProfitAllDays = 0;
    let withdrawCountAllDays = 0;
    let withdrawAmtAllDays = 0;
    let depositCountAllDays = 0;
    let depositAmtAllDays = 0;
    let emailReportContent = '';

    for (const dateStr of sortedDates) {
      const dayTxs = groups[dateStr];
      const daySummary = (daySummaries || []).find(d => d.date === dateStr) || {
        date: dateStr,
        opening_cash: 0,
        closing_cash: 0,
        total_profit: 0,
        status: 'Closed',
        bank_balances: {}
      };

      const dayClosingCash = Number(daySummary.closing_cash || 0);
      const dayOpeningCash = Number(daySummary.opening_cash || 0);
      const bankClosingMap = daySummary.bank_balances || {};

      // Sort newest first to trace bank balance backwards
      const txsDesc = [...dayTxs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      const runningBankMap = {};
      (accounts || []).forEach(acc => {
        if (daySummary.status === 'Open') {
          runningBankMap[acc.id] = Number(acc.current_balance || 0);
        } else {
          runningBankMap[acc.id] = bankClosingMap[acc.bank_name] !== undefined
            ? Number(bankClosingMap[acc.bank_name])
            : Number(acc.current_balance || 0);
        }
      });

      const mappedDesc = txsDesc.map(tx => {
        const bankId = tx.bank_account_id;
        const currentVal = runningBankMap[bankId] !== undefined ? runningBankMap[bankId] : 0;
        tx.runningBankBalAfter = currentVal;
        runningBankMap[bankId] = currentVal - Number(tx.customer_amount || 0);
        return tx;
      });

      // Sort oldest first to compute cash running balance forwards
      const txsAsc = [...mappedDesc].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let runningCash = dayOpeningCash;

      const finalTxs = txsAsc.map(tx => {
        runningCash = runningCash - Number(tx.cash_out || 0);
        tx.runningCashAfter = runningCash;
        return tx;
      });

      let dayWithdrawCount = 0;
      let dayWithdrawAmt = 0;
      let dayDepositCount = 0;
      let dayDepositAmt = 0;
      let dayProfit = 0;
      let dayTxDetails = '';

      for (const tx of finalTxs) {
        const bankName = tx.bank_accounts ? tx.bank_accounts.bank_name : 'Deleted Bank';
        const timeStr = new Date(tx.timestamp).toLocaleString();
        const custName = tx.customer_name || '';
        const commMode = tx.commission_mode || 'Deducted';
        csv += `"${timeStr}","${bankName.replace(/"/g, '""')}","${tx.type}",${tx.customer_amount},${tx.cash_out},${tx.profit},"${commMode}","${custName.replace(/"/g, '""')}",${tx.runningBankBalAfter},${tx.runningCashAfter}\n`;

        dayProfit += Number(tx.profit || 0);
        const isDebit = tx.type === 'Debit';
        const amt = Number(isDebit ? Math.abs(tx.customer_amount || 0) : tx.cash_out || 0);
        
        if (isDebit) {
          dayDepositCount++;
          dayDepositAmt += amt;
          depositCountAllDays++;
          depositAmtAllDays += amt;
        } else {
          dayWithdrawCount++;
          dayWithdrawAmt += amt;
          withdrawCountAllDays++;
          withdrawAmtAllDays += amt;
        }
        dayTxDetails += `  - [${tx.type === 'Debit' ? 'Deposit' : 'Withdrawal'}] Bank: ${bankName} | Amt: ₹${amt.toLocaleString('en-IN')} | Comm Mode: ${commMode} | Profit: ₹${tx.profit}\n`;
      }

      totalProfitAllDays += dayProfit;

      const bankSnapStr = Object.entries(bankClosingMap)
        .map(([name, bal]) => `${name}: ₹${Number(bal).toLocaleString('en-IN')}`)
        .join(' | ');

      csv += `"=== EOD SUMMARY ===","Date: ${dateStr}","Total Tx: ${finalTxs.length}","Net Profit: ₹${Number(daySummary.total_profit || 0).toLocaleString('en-IN')}","Drawer Cash: ₹${Number(dayClosingCash).toLocaleString('en-IN')}","Bank Snapshots: ${bankSnapStr || 'None'}","","","",""\n\n`;

      emailReportContent += `\n📅 Date: ${dateStr}
--------------------------------------------------
- Day Transactions: ${finalTxs.length}
- Day Profit: ₹${dayProfit.toLocaleString('en-IN')}
- Drawer Closing Cash: ₹${dayClosingCash.toLocaleString('en-IN')}
- Bank Account Closing: ${bankSnapStr || 'None'}
- Transaction Details:
${dayTxDetails || '  No transactions logged today.'}`;
    }

    const dateLabel = (startDate && endDate) ? `${startDate} to ${endDate}` : (startDate || new Date().toISOString().split('T')[0]);

    const emailBody = `Kiosk Ledger Backup Statement Report
Range/Date: ${dateLabel}
==================================================

📊 ALL DAYS CUMULATIVE STATISTICS:
- Total Days: ${sortedDates.length}
- Total Transactions: ${transactions.length}
- Total Withdrawals: ${withdrawCountAllDays} (₹${withdrawAmtAllDays.toLocaleString('en-IN')})
- Total Deposits: ${depositCountAllDays} (₹${depositAmtAllDays.toLocaleString('en-IN')})
- Cumulative Commission Profit: ₹${totalProfitAllDays.toLocaleString('en-IN')}

==================================================
📆 DAILY BREAKDOWNS:
${emailReportContent}

--------------------------------------------------
This is an automated Kiosk Ledger backup mail. Encrypted backup files (.bin) and statement spreadsheets (.csv) are attached.`;

    // 3. Build Encrypted BIN payload
    const backupData = {
      accounts,
      transactions,
      daySummaries,
      exportedAt: new Date().toISOString(),
      engine: 'Supabase'
    };
    const jsonString = JSON.stringify(backupData);
    const encrypted = encrypt(jsonString);

    // 4. Send Email if SMTP is configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('WARNING: SMTP credentials not fully configured in .env. Daily backup logs printed to console instead.');
      console.log(`[Scheduled Backup Summary] Target email: ${emailRecipient}. Transactions found: ${transactions.length}`);
      return { success: false, error: 'SMTP credentials not configured in environment' };
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const mailOptions = {
      from: `"Kiosk Ledger Backup" <${smtpUser}>`,
      to: emailRecipient,
      subject: `Kiosk Ledger Backup - ${dateLabel}`,
      text: emailBody,
      attachments: [
        {
          filename: `kiosk_transactions_${dateLabel}.csv`,
          content: csv
        },
        {
          filename: `kiosk_backup_${dateLabel}.bin`,
          content: encrypted
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Scheduled email backup sent successfully: ${info.messageId} to ${emailRecipient}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('Error sending scheduled email backup:', err);
    return { success: false, error: err.message };
  }
};

const emailTodayBackupEndpoint = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await emailDailyBackup(today, today);
    if (result.success) {
      return res.status(200).json({ success: true, message: `Email backup sent successfully to your configured address!` });
    } else {
      return res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const emailRangeBackupEndpoint = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Start date and End date are required' });
    }
    const result = await emailDailyBackup(startDate, endDate);
    if (result.success) {
      return res.status(200).json({ success: true, message: `Backup for range ${startDate} to ${endDate} emailed successfully!` });
    } else {
      return res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const triggerCronBackup = async (req, res) => {
  try {
    console.log('Triggering daily database backup email via Vercel Cron...');
    const today = new Date().toISOString().split('T')[0];
    const result = await emailDailyBackup(today, today);
    if (result.success) {
      return res.status(200).json({ success: true, message: 'Vercel Cron backup emailed successfully!' });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (err) {
    console.error('Vercel Cron backup error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getBankAccounts,
  createBankAccount,
  getActiveDay,
  openDay,
  closeDay,
  getDayHistory,
  createTransaction,
  getTransactions,
  exportBackup,
  exportBackupCSV,
  importBackup,
  bulkUpdateAccounts,
  adjustPhysicalCash,
  updateTransactionCustomerName,
  emailDailyBackup,
  emailTodayBackupEndpoint,
  emailRangeBackupEndpoint,
  reopenDay,
  triggerCronBackup
};
