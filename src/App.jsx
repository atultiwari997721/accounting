import React, { useState, useEffect, useRef } from 'react';
import { Home, PlusCircle, ClipboardList, Settings as SettingsIcon, ShieldCheck, Calculator, Zap } from 'lucide-react';
import PinLock from './components/PinLock';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import PassbookAccounts from './components/PassbookAccounts';
import Settings from './components/Settings';
import SimpleModeCalculator from './components/SimpleModeCalculator';

export default function App() {
  const [loginSecurityEnabled, setLoginSecurityEnabled] = useState(() => localStorage.getItem('kiosk_login_security_enabled') === 'true');
  const [isLocked, setIsLocked] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'add' | 'passbook' | 'settings'
  const [appMode, setAppMode] = useState(() => localStorage.getItem('kiosk_app_mode') || 'simple'); // 'simple' by default | 'detailed'
  const [activeDay, setActiveDay] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dayHistory, setDayHistory] = useState([]);
  const [accountHistory, setAccountHistory] = useState([]);
  const [systemActivityLog, setSystemActivityLog] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kiosk_system_activity_log') || '[]');
    } catch (e) {
      return [];
    }
  });

  const triggerNotification = (title, body) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body });
      } catch (e) {
        console.warn('Failed to display native push notification:', e);
      }
    }
  };

  const idleTimerRef = useRef(null);

  // 1. Idle Lock Timer (5 minutes - active only when loginSecurityEnabled is true)
  const resetIdleTimer = () => {
    if (!loginSecurityEnabled) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    idleTimerRef.current = setTimeout(() => {
      const pinSet = localStorage.getItem('kiosk_pin_hash');
      if (pinSet && loginSecurityEnabled) {
        setIsLocked(true);
        console.log('App auto-locked due to 5 minutes of inactivity.');
      }
    }, 5 * 60 * 1000); // 5 minutes
  };

  useEffect(() => {
    // Only enforce lock if login security criteria is enabled
    if (loginSecurityEnabled) {
      const pinSet = localStorage.getItem('kiosk_pin_hash');
      if (!pinSet) {
        setIsLocked(true);
      }
    } else {
      setIsLocked(false);
    }

    // Event listeners to monitor user interaction
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetIdleTimer);
    });

    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [loginSecurityEnabled]);

  // Comprehensive System Activity & Action Logger
  const logSystemActivity = (action, category, details, meta = {}) => {
    try {
      const list = JSON.parse(localStorage.getItem('kiosk_system_activity_log') || '[]');
      const now = new Date();
      const record = {
        id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: now.toISOString(),
        dateStr: now.toLocaleDateString('en-CA'),
        timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action,
        category, // 'SESSION' | 'LEDGER' | 'ACCOUNTS' | 'TRANSACTIONS' | 'SECURITY' | 'DATA'
        details,
        meta
      };
      list.unshift(record);
      const trimmed = list.slice(0, 1000);
      localStorage.setItem('kiosk_system_activity_log', JSON.stringify(trimmed));
      setSystemActivityLog(trimmed);
    } catch (e) {
      console.warn('Failed to log system activity:', e);
    }
  };

  // 2. Local Storage Sync Fallback Logic
  const logAccountChange = (entry) => {
    try {
      const list = JSON.parse(localStorage.getItem('kiosk_account_history') || '[]');
      const record = {
        id: 'ach_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString(),
        ...entry
      };
      list.unshift(record);
      const trimmed = list.slice(0, 500);
      localStorage.setItem('kiosk_account_history', JSON.stringify(trimmed));
      setAccountHistory(trimmed);
    } catch (e) {
      console.warn('Failed to log account change:', e);
    }
  };

  const loadDataLocal = () => {
    const day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const txs = JSON.parse(localStorage.getItem('kiosk_transactions') || '[]');
    const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
    const accHist = JSON.parse(localStorage.getItem('kiosk_account_history') || '[]');
    const actLog = JSON.parse(localStorage.getItem('kiosk_system_activity_log') || '[]');
    setActiveDay(day);
    setAccounts(accs);
    setTransactions(txs);
    setDayHistory(history);
    setAccountHistory(accHist);
    setSystemActivityLog(actLog);
  };

  const loadData = () => {
    loadDataLocal();
  };

  // Clear all data to start completely fresh
  const handleClearAllData = () => {
    localStorage.removeItem('kiosk_accounts');
    localStorage.removeItem('kiosk_transactions');
    localStorage.removeItem('kiosk_day_history');
    localStorage.removeItem('kiosk_active_day');
    localStorage.removeItem('kiosk_account_history');
    localStorage.removeItem('kiosk_simple_udhar');

    setAccounts([]);
    setTransactions([]);
    setDayHistory([]);
    setAccountHistory([]);
    setActiveDay(null);

    logSystemActivity(
      'All App Data Wiped',
      'DATA',
      'User wiped all accounts, transactions, day ledger history, and Udhar balances to start completely fresh.'
    );

    triggerNotification('All Data Wiped Clean', 'All accounts and records cleared. Fresh slate started!');
    return { success: true };
  };

  const handleClearActivityLog = () => {
    localStorage.removeItem('kiosk_system_activity_log');
    const now = new Date();
    const initEntry = {
      id: 'act_init_' + Date.now(),
      timestamp: now.toISOString(),
      dateStr: now.toLocaleDateString('en-CA'),
      timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: 'Activity Log Cleared',
      category: 'DATA',
      details: 'Action audit trail was cleared by user.',
      meta: {}
    };
    localStorage.setItem('kiosk_system_activity_log', JSON.stringify([initEntry]));
    setSystemActivityLog([initEntry]);
    return { success: true };
  };

  useEffect(() => {
    // One-time deletion of all default/mock saved data to start completely fresh
    const freshStartKey = 'kiosk_fresh_slate_reset_v4';
    if (!localStorage.getItem(freshStartKey)) {
      localStorage.removeItem('kiosk_accounts');
      localStorage.removeItem('kiosk_transactions');
      localStorage.removeItem('kiosk_day_history');
      localStorage.removeItem('kiosk_active_day');
      localStorage.removeItem('kiosk_account_history');
      localStorage.removeItem('kiosk_simple_udhar');
      localStorage.setItem(freshStartKey, 'true');

      const now = new Date();
      const resetEntry = {
        id: 'act_fresh_' + Date.now(),
        timestamp: now.toISOString(),
        dateStr: now.toLocaleDateString('en-CA'),
        timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        action: 'System Fresh Start',
        category: 'DATA',
        details: 'All default and existing stored data was cleared per user request. Fresh accounting slate initialized.',
        meta: {}
      };
      localStorage.setItem('kiosk_system_activity_log', JSON.stringify([resetEntry]));
    }

    loadData();

    // Record application open session action
    const currentMode = localStorage.getItem('kiosk_app_mode') || 'simple';
    logSystemActivity(
      'App Session Opened',
      'SESSION',
      `Application opened in ${currentMode === 'simple' ? 'Simple Mode' : 'Detailed Mode'} (Session Date: ${new Date().toLocaleDateString('en-IN')})`,
      { mode: currentMode }
    );
  }, []);

  // --- Offline Mode Local Storage Implementations ---

  const addAccountLocal = (bankData) => {
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const bName = (bankData.bankName || '').trim();
    if (!bName) return { success: false, error: 'Bank name is required' };

    const exists = accs.find(a => a.bankName.toLowerCase() === bName.toLowerCase());
    if (exists) return { success: false, error: 'Bank account already exists locally' };

    const initBal = Number(bankData.currentBalance) || 0;
    const newAcc = {
      _id: 'local_' + Math.random().toString(36).substr(2, 9),
      bankName: bName,
      currentBalance: initBal,
      createdAt: new Date().toISOString()
    };
    accs.push(newAcc);
    localStorage.setItem('kiosk_accounts', JSON.stringify(accs));

    logAccountChange({
      type: 'ACCOUNT_CREATED',
      bankName: bName,
      oldBalance: 0,
      newBalance: initBal,
      note: `Registered account "${bName}" with balance ₹${initBal.toLocaleString('en-IN')}`
    });

    logSystemActivity(
      'Account Added',
      'ACCOUNTS',
      `Registered bank account "${bName}" with starting balance ₹${initBal.toLocaleString('en-IN')}`
    );

    loadDataLocal();
    return { success: true };
  };

  const editAccountLocal = (accountId, updatedData) => {
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const idx = accs.findIndex(a => a._id === accountId);
    if (idx === -1) return { success: false, error: 'Bank account not found' };

    const oldAcc = accs[idx];
    const oldName = oldAcc.bankName;
    const oldBalance = Number(oldAcc.currentBalance) || 0;

    const newName = (updatedData.bankName || '').trim() || oldName;
    const newBalance = updatedData.currentBalance !== undefined ? Number(updatedData.currentBalance) : oldBalance;

    if (newName.toLowerCase() !== oldName.toLowerCase()) {
      const duplicate = accs.find(a => a._id !== accountId && a.bankName.toLowerCase() === newName.toLowerCase());
      if (duplicate) return { success: false, error: `Account "${newName}" already exists.` };
    }

    accs[idx].bankName = newName;
    accs[idx].currentBalance = newBalance;
    accs[idx].updatedAt = new Date().toISOString();

    localStorage.setItem('kiosk_accounts', JSON.stringify(accs));

    const note = oldName !== newName 
      ? `Renamed from "${oldName}" to "${newName}", balance set to ₹${newBalance.toLocaleString('en-IN')}`
      : `Updated balance of "${newName}" from ₹${oldBalance.toLocaleString('en-IN')} to ₹${newBalance.toLocaleString('en-IN')}`;

    logAccountChange({
      type: 'ACCOUNT_EDITED',
      bankName: newName,
      oldName: oldName !== newName ? oldName : undefined,
      oldBalance,
      newBalance,
      note
    });

    logSystemActivity('Account Edited', 'ACCOUNTS', note);

    loadDataLocal();
    return { success: true };
  };

  const deleteAccountLocal = (accountId) => {
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const target = accs.find(a => a._id === accountId);
    if (!target) return { success: false, error: 'Account not found' };

    const targetName = target.bankName;
    const targetBal = Number(target.currentBalance) || 0;

    const filtered = accs.filter(a => a._id !== accountId);
    localStorage.setItem('kiosk_accounts', JSON.stringify(filtered));

    logAccountChange({
      type: 'ACCOUNT_DELETED',
      bankName: targetName,
      oldBalance: targetBal,
      newBalance: 0,
      note: `Deleted account "${targetName}" (had remaining balance ₹${targetBal.toLocaleString('en-IN')})`
    });

    logSystemActivity(
      'Account Deleted',
      'ACCOUNTS',
      `Deleted account "${targetName}" (had closing balance ₹${targetBal.toLocaleString('en-IN')})`
    );

    loadDataLocal();
    return { success: true };
  };

  const submitTransactionLocal = (txData) => {
    const day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    if (!day || day.status !== 'Open') {
      return { success: false, error: 'Ledger is closed. Open the day in Settings first.' };
    }

    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const idx = accs.findIndex(a => a._id === txData.bankAccountId);
    if (idx === -1) return { success: false, error: 'Bank account not found' };

    const targetType = txData.type || 'Credit';

    if (targetType === 'Credit') {
      if (txData.cashOut > day.closingCash) {
        return { success: false, error: `Insufficient cash in hand! Available: ₹${day.closingCash}` };
      }
    } else if (targetType === 'Debit') {
      const bankBal = accs[idx].currentBalance;
      const bankDebit = Math.abs(txData.customerAmount);
      if (bankDebit > bankBal) {
        return { success: false, error: `Insufficient bank balance in ${accs[idx].bankName}! Available: ₹${bankBal}` };
      }
    }

    const bankBalBefore = accs[idx].currentBalance;
    accs[idx].currentBalance += txData.customerAmount;
    day.closingCash -= txData.cashOut;
    day.totalProfit += txData.profit;

    // If specific notes were given or received, sync with drawer denominations
    if (txData.notesBreakdown && day.cashDenominations) {
      if (txData.notesDirection === 'deducted') {
        Object.keys(txData.notesBreakdown).forEach(k => {
          day.cashDenominations[k] = Math.max(0, (Number(day.cashDenominations[k]) || 0) - (Number(txData.notesBreakdown[k]) || 0));
        });
      } else if (txData.notesDirection === 'added') {
        Object.keys(txData.notesBreakdown).forEach(k => {
          day.cashDenominations[k] = (Number(day.cashDenominations[k]) || 0) + (Number(txData.notesBreakdown[k]) || 0);
        });
      }
    }

    const txs = JSON.parse(localStorage.getItem('kiosk_transactions') || '[]');
    const newTx = {
      _id: 'local_tx_' + Math.random().toString(36).substr(2, 9),
      bankAccountId: accs[idx], // populated object
      type: targetType,
      customerAmount: txData.customerAmount,
      cashOut: txData.cashOut,
      profit: txData.profit,
      customerName: txData.customerName || '',
      commissionMode: txData.commissionMode || 'Deducted',
      noteDetails: txData.noteDetails || 'Skipped (Count at EOD)',
      notesBreakdown: txData.notesBreakdown || null,
      notesDirection: txData.notesDirection || null,
      timestamp: new Date().toISOString()
    };
    txs.unshift(newTx);

    localStorage.setItem('kiosk_accounts', JSON.stringify(accs));
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));
    localStorage.setItem('kiosk_transactions', JSON.stringify(txs));

    const txDesc = `${targetType === 'Credit' ? 'Withdrawal' : 'Deposit'}: ₹${Math.abs(txData.customerAmount).toLocaleString('en-IN')}${txData.customerName ? ` (${txData.customerName})` : ''}`;

    logAccountChange({
      type: targetType === 'Credit' ? 'TX_WITHDRAWAL' : 'TX_DEPOSIT',
      bankName: accs[idx].bankName,
      oldBalance: bankBalBefore,
      newBalance: accs[idx].currentBalance,
      note: txDesc
    });

    logSystemActivity(
      targetType === 'Credit' ? 'Withdrawal Recorded' : 'Deposit Recorded',
      'TRANSACTIONS',
      `${targetType === 'Credit' ? 'Cash Out (Withdrawal)' : 'Cash In (Deposit)'}: ₹${Math.abs(txData.customerAmount).toLocaleString('en-IN')} via ${accs[idx].bankName}${txData.customerName ? ` for ${txData.customerName}` : ''}`
    );

    loadDataLocal();
    return { success: true };
  };

  const bulkUpdateBalancesLocal = (payload) => {
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    payload.forEach(item => {
      const idx = accs.findIndex(a => a._id === item.id);
      if (idx !== -1) {
        const oldBal = Number(accs[idx].currentBalance) || 0;
        const newBal = Number(item.currentBalance) || 0;
        if (oldBal !== newBal) {
          accs[idx].currentBalance = newBal;
          logAccountChange({
            type: 'BALANCE_UPDATED',
            bankName: accs[idx].bankName,
            oldBalance: oldBal,
            newBalance: newBal,
            note: `Balance updated manually: ₹${oldBal.toLocaleString('en-IN')} ➔ ₹${newBal.toLocaleString('en-IN')}`
          });
        }
      }
    });
    localStorage.setItem('kiosk_accounts', JSON.stringify(accs));
    logSystemActivity('Balances Updated', 'ACCOUNTS', `Bulk updated balances for ${payload.length} account(s)`);
    loadDataLocal();
    return { success: true };
  };

  const buildBankBalancesSnapshot = () => {
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const bankBals = {};
    accs.forEach(a => {
      bankBals[a.bankName] = Number(a.currentBalance) || 0;
    });
    return bankBals;
  };

  const adjustPhysicalCashLocal = (closingCash, cashDenominations) => {
    let day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    const today = new Date().toLocaleDateString('en-CA');
    const defaultDenoms = { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0, c20: 0, c10: 0, c5: 0, c2: 0, c1: 0 };
    const bankBals = buildBankBalancesSnapshot();
    const nowIso = new Date().toISOString();

    if (!day) {
      const openEvent = {
        id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        type: 'OPEN',
        timestamp: nowIso,
        cash: Number(closingCash) || 0,
        cashDenominations: cashDenominations || defaultDenoms,
        bankBalances: bankBals,
        note: 'Auto Ledger Opened'
      };

      day = {
        date: today,
        openedAt: nowIso,
        openingCash: Number(closingCash) || 0,
        closingCash: Number(closingCash) || 0,
        openingDenominations: cashDenominations || defaultDenoms,
        openingBankBalances: bankBals,
        closingBankBalances: bankBals,
        bankBalances: bankBals,
        totalProfit: 0,
        status: 'Open',
        cashDenominations: cashDenominations || defaultDenoms,
        openCloseEvents: [openEvent],
        openCount: 1,
        closeCount: 0
      };
      localStorage.setItem('kiosk_active_day', JSON.stringify(day));
      loadDataLocal();
      triggerNotification('Ledger Open', `Ledger opened with ₹${(Number(closingCash) || 0).toLocaleString('en-IN')} cash.`);
      return { success: true, day };
    }
    
    day.closingCash = Number(closingCash) || 0;
    if (cashDenominations) day.cashDenominations = cashDenominations;
    if (!day.openingBankBalances) day.openingBankBalances = bankBals;
    day.closingBankBalances = bankBals;
    day.bankBalances = bankBals;
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));

    logSystemActivity(
      'Drawer Cash Adjusted',
      'LEDGER',
      `Physical drawer cash adjusted to ₹${Number(closingCash).toLocaleString('en-IN')}`
    );

    loadDataLocal();
    return { success: true, day };
  };

  // --- Core Action Handlers ---

  const handleAddAccount = async (bankData) => {
    return addAccountLocal(bankData);
  };

  const handleSubmitTransaction = async (txData) => {
    const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');
    const txLabel = txData.type === 'Debit' ? 'Deposit (Cash In)' : 'Withdrawal (Cash Out)';
    const amountVal = txData.type === 'Debit' ? Math.abs(txData.customerAmount) : txData.cashOut;

    const res = submitTransactionLocal(txData);
    if (res.success) {
      triggerNotification('Transaction Logged', `Recorded ${txLabel} of ${formatINR(amountVal)}`);
    }
    return res;
  };

  const handleBulkUpdateBalances = async (payload) => {
    return bulkUpdateBalancesLocal(payload);
  };

  const handleAdjustCash = async (closingCash, cashDenominations) => {
    return adjustPhysicalCashLocal(closingCash, cashDenominations);
  };

  const handleUpdateCustomerName = async (id, customerName) => {
    const txs = JSON.parse(localStorage.getItem('kiosk_transactions') || '[]');
    const idx = txs.findIndex(t => t._id === id);
    if (idx !== -1) {
      txs[idx].customerName = customerName;
      localStorage.setItem('kiosk_transactions', JSON.stringify(txs));
      logSystemActivity(
        'Customer Name Updated',
        'TRANSACTIONS',
        `Updated customer name to "${customerName}" for transaction ${id.substr(0, 10)}`
      );
    }
    loadDataLocal();
    return { success: true };
  };

  const handleOpenDay = async (date, openingCash, cashDenominations) => {
    const active = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    if (active && active.status === 'Open') return { success: false, error: 'Day already open' };

    const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
    const lastClosed = history.find(h => h.status === 'Closed' || h.closingCash !== undefined);

    let finalOpeningCash;
    if (openingCash !== undefined && openingCash !== null && openingCash !== '') {
      finalOpeningCash = Number(openingCash);
    } else if (lastClosed && lastClosed.closingCash !== undefined) {
      finalOpeningCash = Number(lastClosed.closingCash);
    } else {
      finalOpeningCash = 0;
    }
    if (isNaN(finalOpeningCash)) finalOpeningCash = 0;

    let defaultDenoms = cashDenominations;
    if (!defaultDenoms && lastClosed?.cashDenominations) {
      defaultDenoms = { ...lastClosed.cashDenominations };
    }
    if (!defaultDenoms) {
      defaultDenoms = { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0 };
    }

    const bankBals = buildBankBalancesSnapshot();
    if (lastClosed?.closingBankBalances) {
      Object.entries(lastClosed.closingBankBalances).forEach(([bName, bal]) => {
        if (bankBals[bName] === undefined || bankBals[bName] === 0) {
          bankBals[bName] = Number(bal) || 0;
        }
      });
    }

    const nowIso = new Date().toISOString();
    const openEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'OPEN',
      timestamp: nowIso,
      cash: finalOpeningCash,
      cashDenominations: defaultDenoms,
      bankBalances: bankBals,
      note: lastClosed ? `Ledger Opened (Default carried forward from ${lastClosed.date})` : 'Ledger Opened'
    };

    const day = {
      date,
      openedAt: nowIso,
      openingCash: finalOpeningCash,
      closingCash: finalOpeningCash,
      openingDenominations: defaultDenoms,
      openingBankBalances: bankBals,
      closingBankBalances: bankBals,
      bankBalances: bankBals,
      totalProfit: 0,
      status: 'Open',
      cashDenominations: defaultDenoms,
      openCloseEvents: [openEvent],
      openCount: 1,
      closeCount: 0
    };
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));

    logSystemActivity(
      'Day Ledger Opened',
      'LEDGER',
      `Opened business day ledger for ${date} with starting cash ₹${finalOpeningCash.toLocaleString('en-IN')}`
    );

    loadDataLocal();
    triggerNotification('Ledger Open', `Ledger opened for ${date} with ₹${finalOpeningCash.toLocaleString('en-IN')} cash.`);
    return { success: true };
  };

  const handleCloseDay = async (closingCash, cashDenominations) => {
    const day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    if (!day) return { success: false, error: 'No open ledger' };

    const finalCash = typeof closingCash === 'number' ? closingCash : (Number(day.closingCash) || 0);
    const finalDenoms = cashDenominations || day.cashDenominations;
    const closingBankBals = buildBankBalancesSnapshot();
    const nowIso = new Date().toISOString();

    day.closingCash = finalCash;
    day.cashDenominations = finalDenoms;
    day.status = 'Closed';
    day.closedAt = nowIso;
    day.closingBankBalances = closingBankBals;
    day.bankBalances = closingBankBals;

    if (!day.openingBankBalances) {
      day.openingBankBalances = closingBankBals;
    }

    if (!Array.isArray(day.openCloseEvents) || day.openCloseEvents.length === 0) {
      day.openCloseEvents = [
        {
          id: 'evt_open_init',
          type: 'OPEN',
          timestamp: day.openedAt || new Date(new Date(day.date).setHours(9, 0, 0, 0)).toISOString(),
          cash: day.openingCash,
          cashDenominations: day.openingDenominations || day.cashDenominations,
          bankBalances: day.openingBankBalances || closingBankBals,
          note: 'Initial Open'
        }
      ];
      day.openCount = 1;
    }

    const closeEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'CLOSE',
      timestamp: nowIso,
      cash: finalCash,
      cashDenominations: finalDenoms,
      bankBalances: closingBankBals,
      note: 'Ledger Closed'
    };

    day.openCloseEvents.push(closeEvent);
    day.closeCount = (Number(day.closeCount) || 0) + 1;

    const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
    const filtered = history.filter(h => h.date !== day.date);
    filtered.unshift(day);
    localStorage.setItem('kiosk_day_history', JSON.stringify(filtered));

    localStorage.setItem('kiosk_active_day', 'null');

    logSystemActivity(
      'Day Ledger Closed',
      'LEDGER',
      `Closed business day ledger for ${day.date}. Final drawer cash: ₹${finalCash.toLocaleString('en-IN')}, Day Profit: ₹${(Number(day.totalProfit) || 0).toLocaleString('en-IN')}`
    );

    loadDataLocal();
    triggerNotification('Ledger Closed', `Ledger closed for ${day.date}. EOD report recorded.`);
    return { success: true, closedDay: day };
  };

  const handleReopenDay = async (date) => {
    const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
    const idx = history.findIndex(h => h.date === date);
    if (idx === -1) return { success: false, error: 'Ledger date not found in history' };

    const day = history[idx];
    day.status = 'Open';
    
    const nowIso = new Date().toISOString();
    const bankBals = buildBankBalancesSnapshot();

    const reopenEvent = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'REOPEN',
      timestamp: nowIso,
      cash: day.closingCash,
      cashDenominations: day.cashDenominations,
      bankBalances: bankBals,
      note: 'Ledger Reopened'
    };

    if (!Array.isArray(day.openCloseEvents)) {
      day.openCloseEvents = [];
    }
    day.openCloseEvents.push(reopenEvent);
    day.openCount = (Number(day.openCount) || 1) + 1;

    history.splice(idx, 1);
    localStorage.setItem('kiosk_day_history', JSON.stringify(history));
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));

    logSystemActivity(
      'Day Ledger Reopened',
      'LEDGER',
      `Reopened ledger session for ${date}`
    );

    loadDataLocal();
    triggerNotification('Ledger Reopened', `Ledger reopened for today.`);
    return { success: true };
  };

  const handleResetPin = () => {
    localStorage.removeItem('kiosk_pin_hash');
    setLoginSecurityEnabled(true);
    localStorage.setItem('kiosk_login_security_enabled', 'true');
    setIsLocked(true);
    logSystemActivity(
      'PIN Passcode Reset',
      'SECURITY',
      'Security PIN passcode was cleared and set to reconfigure'
    );
  };

  const handleToggleLoginSecurity = (enabled) => {
    const nextVal = typeof enabled === 'boolean' ? enabled : !loginSecurityEnabled;
    localStorage.setItem('kiosk_login_security_enabled', String(nextVal));
    setLoginSecurityEnabled(nextVal);
    if (!nextVal) {
      setIsLocked(false);
    }
    logSystemActivity(
      'Security Criteria Changed',
      'SECURITY',
      `App login security criteria is now ${nextVal ? 'ENABLED (PIN required)' : 'DISABLED (Direct Open)'}`
    );
  };

  const handleEditAccount = async (id, updatedData) => {
    return editAccountLocal(id, updatedData);
  };

  const handleDeleteAccount = async (id) => {
    return deleteAccountLocal(id);
  };

  const handleToggleAppMode = (mode) => {
    setAppMode(mode);
    localStorage.setItem('kiosk_app_mode', mode);
    setActiveTab('home');
    logSystemActivity(
      'Operating Mode Changed',
      'SESSION',
      `Switched app operating mode to ${mode === 'simple' ? 'Simple Mode' : 'Detailed Mode'}`
    );
    triggerNotification('App Mode Changed', `Switched to ${mode === 'simple' ? 'Simple Mode' : 'Detailed Mode'}`);
  };

  const handleSaveDayCalculation = (finalDayRecord) => {
    const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
    const filtered = history.filter(h => h.date !== finalDayRecord.date);
    filtered.unshift(finalDayRecord);
    localStorage.setItem('kiosk_day_history', JSON.stringify(filtered));

    if (finalDayRecord.closingBankBalances) {
      const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
      Object.entries(finalDayRecord.closingBankBalances).forEach(([bName, bal]) => {
        const idx = accs.findIndex(a => a.bankName.toLowerCase() === bName.toLowerCase());
        const newBal = Number(bal) || 0;
        if (idx !== -1) {
          const oldBal = Number(accs[idx].currentBalance) || 0;
          if (oldBal !== newBal) {
            accs[idx].currentBalance = newBal;
            logAccountChange({
              type: 'SIMPLE_EOD_SYNC',
              bankName: accs[idx].bankName,
              oldBalance: oldBal,
              newBalance: newBal,
              note: `Simple Mode EOD balance for ${finalDayRecord.date}: ₹${oldBal.toLocaleString('en-IN')} ➔ ₹${newBal.toLocaleString('en-IN')}`
            });
          }
        }
      });
      localStorage.setItem('kiosk_accounts', JSON.stringify(accs));
    }

    logSystemActivity(
      'Simple Mode EOD Recorded',
      'LEDGER',
      `Saved Simple Mode calculation for ${finalDayRecord.date}. Net Profit: ₹${Number(finalDayRecord.totalProfit || 0).toLocaleString('en-IN')}, Drawer Cash: ₹${Number(finalDayRecord.closingCash || 0).toLocaleString('en-IN')}`
    );

    loadDataLocal();
    triggerNotification('Day Ledger Saved', `Recorded Simple EOD profit of ₹${Number(finalDayRecord.totalProfit || 0).toLocaleString('en-IN')}`);
  };

  const handleUpdateAccountsFromSimple = (bankName, balance) => {
    addAccountLocal({ bankName, currentBalance: balance });
  };

  // Safe area helper class for mobile screens
  const baseWrapperClass = "w-full min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased select-none pb-[calc(4rem+env(safe-area-inset-bottom))] max-w-md mx-auto border-x border-slate-200 shadow-xl relative";

  if (loginSecurityEnabled && isLocked) {
    return <PinLock onUnlock={() => { setIsLocked(false); loadData(); }} />;
  }

  return (
    <div className={baseWrapperClass}>
      
      {/* Mobile Top App Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 h-14 flex items-center justify-between px-4 shadow-xs">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${appMode === 'simple' ? 'bg-emerald-500 shadow-emerald-200' : 'bg-blue-600 shadow-blue-200'} shadow-sm`}></div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide text-blue-900 uppercase">SBI Kiosk Ledger</h1>
            <p className="text-[9px] text-slate-500 font-medium -mt-0.5">
              {appMode === 'simple' ? '⚡ Simple Profit Mode' : 'Cash & Account System'}
            </p>
          </div>
        </div>
        
        {/* Mode Switcher Pill */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleToggleAppMode(appMode === 'simple' ? 'detailed' : 'simple')}
            className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border transition-all active:scale-95 shadow-2xs ${
              appMode === 'simple'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
            }`}
            title="Click to switch between Simple Mode and Detailed Mode"
          >
            {appMode === 'simple' ? <Zap className="w-3 h-3 text-emerald-600" /> : <Calculator className="w-3 h-3 text-blue-600" />}
            <span>{appMode === 'simple' ? 'Simple Mode' : 'Detailed Mode'}</span>
          </button>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-6">
        {appMode === 'simple' ? (
          <>
            {(activeTab === 'home' || activeTab === 'add') && (
              <SimpleModeCalculator
                accounts={accounts}
                dayHistory={dayHistory}
                activeDay={activeDay}
                onSaveDayCalculation={handleSaveDayCalculation}
                onAddAccount={handleAddAccount}
                onDeleteAccount={handleDeleteAccount}
                onUpdateAccounts={handleUpdateAccountsFromSimple}
              />
            )}
            {activeTab === 'passbook' && (
              <PassbookAccounts
                accounts={accounts}
                transactions={transactions}
                dayHistory={dayHistory}
                activeDay={activeDay}
                accountHistory={accountHistory}
                onAddAccount={handleAddAccount}
                onEditAccount={handleEditAccount}
                onDeleteAccount={handleDeleteAccount}
                onBulkUpdateBalances={handleBulkUpdateBalances}
                onUpdateCustomerName={handleUpdateCustomerName}
                onSubmitTransaction={handleSubmitTransaction}
                onAdjustCash={handleAdjustCash}
                onCloseDay={handleCloseDay}
                onOpenDay={handleOpenDay}
                onReopenDay={handleReopenDay}
              />
            )}
            {activeTab === 'settings' && (
              <Settings
                activeDay={activeDay}
                dayHistory={dayHistory}
                transactions={transactions}
                accounts={accounts}
                appMode={appMode}
                onToggleAppMode={handleToggleAppMode}
                loginSecurityEnabled={loginSecurityEnabled}
                onToggleLoginSecurity={handleToggleLoginSecurity}
                systemActivityLog={systemActivityLog}
                onClearActivityLog={handleClearActivityLog}
                onClearAllData={handleClearAllData}
                logSystemActivity={logSystemActivity}
                onOpenDay={handleOpenDay}
                onCloseDay={handleCloseDay}
                onReopenDay={handleReopenDay}
                onReloadData={loadData}
                onResetPin={handleResetPin}
                onAdjustCash={handleAdjustCash}
              />
            )}
          </>
        ) : (
          <>
            {activeTab === 'home' && (
              <Dashboard
                activeDay={activeDay}
                accounts={accounts}
                transactions={transactions}
                onNavigateToAddTx={() => setActiveTab('add')}
                onAdjustCash={handleAdjustCash}
              />
            )}
            {activeTab === 'add' && (
              <TransactionForm
                activeDay={activeDay}
                accounts={accounts}
                onSubmitTransaction={handleSubmitTransaction}
                onNavigateToAccounts={() => setActiveTab('passbook')}
                onOpenDay={handleOpenDay}
              />
            )}
            {activeTab === 'passbook' && (
              <PassbookAccounts
                accounts={accounts}
                transactions={transactions}
                dayHistory={dayHistory}
                activeDay={activeDay}
                accountHistory={accountHistory}
                onAddAccount={handleAddAccount}
                onEditAccount={handleEditAccount}
                onDeleteAccount={handleDeleteAccount}
                onBulkUpdateBalances={handleBulkUpdateBalances}
                onUpdateCustomerName={handleUpdateCustomerName}
                onSubmitTransaction={handleSubmitTransaction}
                onAdjustCash={handleAdjustCash}
                onCloseDay={handleCloseDay}
                onOpenDay={handleOpenDay}
                onReopenDay={handleReopenDay}
              />
            )}
            {activeTab === 'settings' && (
              <Settings
                activeDay={activeDay}
                dayHistory={dayHistory}
                transactions={transactions}
                accounts={accounts}
                appMode={appMode}
                onToggleAppMode={handleToggleAppMode}
                loginSecurityEnabled={loginSecurityEnabled}
                onToggleLoginSecurity={handleToggleLoginSecurity}
                systemActivityLog={systemActivityLog}
                onClearActivityLog={handleClearActivityLog}
                onClearAllData={handleClearAllData}
                logSystemActivity={logSystemActivity}
                onOpenDay={handleOpenDay}
                onCloseDay={handleCloseDay}
                onReopenDay={handleReopenDay}
                onReloadData={loadData}
                onResetPin={handleResetPin}
                onAdjustCash={handleAdjustCash}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 max-w-md mx-auto z-40 flex items-center justify-around px-2 shadow-lg">
        {appMode === 'simple' ? (
          <>
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                activeTab === 'home' || activeTab === 'add' ? 'text-emerald-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Calculator className="w-5 h-5" />
              <span className="text-[10px] tracking-wide">Calculator</span>
            </button>

            <button
              onClick={() => setActiveTab('passbook')}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                activeTab === 'passbook' ? 'text-emerald-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-[10px] tracking-wide">Passbook</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                activeTab === 'settings' ? 'text-emerald-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px] tracking-wide">Settings</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                activeTab === 'home' ? 'text-blue-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] tracking-wide">Home</span>
            </button>

            <button
              onClick={() => setActiveTab('add')}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                activeTab === 'add' ? 'text-blue-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <PlusCircle className="w-5 h-5" />
              <span className="text-[10px] tracking-wide">Withdraw</span>
            </button>

            <button
              onClick={() => setActiveTab('passbook')}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                activeTab === 'passbook' ? 'text-blue-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ClipboardList className="w-5 h-5" />
              <span className="text-[10px] tracking-wide">Passbook</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
                activeTab === 'settings' ? 'text-blue-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px] tracking-wide">Settings</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
