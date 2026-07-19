import React, { useState, useEffect, useRef } from 'react';
import { Home, PlusCircle, ClipboardList, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import PinLock from './components/PinLock';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import PassbookAccounts from './components/PassbookAccounts';
import Settings from './components/Settings';

// Fallback logic for sandbox / Render deploy URLs
const getBackendUrl = () => {
  const stored = localStorage.getItem('kiosk_backend_url');
  if (stored) return stored;
  
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // Return relative or blank to support same-origin proxy, or default placeholder
  return window.location.origin; 
};

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'add' | 'passbook' | 'settings'
  const [activeDay, setActiveDay] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dayHistory, setDayHistory] = useState([]);
  const [backendUrl, setBackendUrl] = useState(getBackendUrl());
  const [isOfflineMode, setIsOfflineMode] = useState(false);

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

  // 1. Idle Lock Timer (5 minutes)
  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    idleTimerRef.current = setTimeout(() => {
      const pinSet = localStorage.getItem('kiosk_pin_hash');
      if (pinSet) {
        setIsLocked(true);
        console.log('App auto-locked due to 5 minutes of inactivity.');
      }
    }, 5 * 60 * 1000); // 5 minutes
  };

  useEffect(() => {
    // Check if PIN has been set
    const pinSet = localStorage.getItem('kiosk_pin_hash');
    if (!pinSet) {
      // Force Lock modal into SETUP mode
      setIsLocked(true);
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
  }, []);

  // 2. Local Storage Sync Fallback Logic
  const loadDataLocal = () => {
    const day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const txs = JSON.parse(localStorage.getItem('kiosk_transactions') || '[]');
    const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
    setActiveDay(day);
    setAccounts(accs);
    setTransactions(txs);
    setDayHistory(history);
  };

  const checkConnection = async () => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${backendUrl}/health`, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        setIsOfflineMode(false);
        return true;
      }
    } catch (e) {
      // Offline
    }
    setIsOfflineMode(true);
    return false;
  };

  const loadData = async () => {
    const isOnline = await checkConnection();
    if (!isOnline) {
      loadDataLocal();
      return;
    }
    try {
      const dayRes = await fetch(`${backendUrl}/api/day/active`);
      const dayData = await dayRes.json();
      if (dayData.success) {
        setActiveDay(dayData.data);
      } else {
        setActiveDay(null);
      }

      const accRes = await fetch(`${backendUrl}/api/accounts`);
      const accData = await accRes.json();
      if (accData.success) {
        setAccounts(accData.data);
      }

      const txRes = await fetch(`${backendUrl}/api/transactions`);
      const txData = await txRes.json();
      if (txData.success) {
        setTransactions(txData.data);
      }

      const histRes = await fetch(`${backendUrl}/api/day/history`);
      const histData = await histRes.json();
      if (histData.success) {
        setDayHistory(histData.data);
      }
    } catch (err) {
      console.warn('API fetch failed, using local storage fallback.', err);
      setIsOfflineMode(true);
      loadDataLocal();
    }
  };

  useEffect(() => {
    loadData();
  }, [backendUrl]);

  // --- Offline Mode Local Storage Implementations ---

  const addAccountLocal = (bankData) => {
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const exists = accs.find(a => a.bankName.toLowerCase() === bankData.bankName.toLowerCase());
    if (exists) return { success: false, error: 'Bank account already exists locally' };

    const newAcc = {
      _id: 'local_' + Math.random().toString(36).substr(2, 9),
      bankName: bankData.bankName,
      currentBalance: bankData.currentBalance || 0,
      createdAt: new Date().toISOString()
    };
    accs.push(newAcc);
    localStorage.setItem('kiosk_accounts', JSON.stringify(accs));
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

    accs[idx].currentBalance += txData.customerAmount;
    day.closingCash -= txData.cashOut;
    day.totalProfit += txData.profit;

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
      timestamp: new Date().toISOString()
    };
    txs.unshift(newTx);

    localStorage.setItem('kiosk_accounts', JSON.stringify(accs));
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));
    localStorage.setItem('kiosk_transactions', JSON.stringify(txs));

    loadDataLocal();
    return { success: true };
  };

  const bulkUpdateBalancesLocal = (payload) => {
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    payload.forEach(item => {
      const idx = accs.findIndex(a => a._id === item.id);
      if (idx !== -1) {
        accs[idx].currentBalance = item.currentBalance;
      }
    });
    localStorage.setItem('kiosk_accounts', JSON.stringify(accs));
    loadDataLocal();
    return { success: true };
  };

  const adjustPhysicalCashLocal = (closingCash) => {
    const day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    if (!day) return { success: false, error: 'No open ledger day' };
    day.closingCash = closingCash;
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));
    loadDataLocal();
    return { success: true };
  };

  // --- Core Action Handlers ---

  const handleAddAccount = async (bankData) => {
    if (isOfflineMode) return addAccountLocal(bankData);
    try {
      const res = await fetch(`${backendUrl}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankData)
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      setIsOfflineMode(true);
      return addAccountLocal(bankData);
    }
  };

  const handleSubmitTransaction = async (txData) => {
    const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');
    const txLabel = txData.type === 'Debit' ? 'Deposit (Cash In)' : 'Withdrawal (Cash Out)';
    const amountVal = txData.type === 'Debit' ? Math.abs(txData.customerAmount) : txData.cashOut;

    if (isOfflineMode) {
      const res = submitTransactionLocal(txData);
      if (res.success) {
        triggerNotification('Transaction Logged', `Recorded ${txLabel} of ${formatINR(amountVal)}`);
      }
      return res;
    }
    try {
      const res = await fetch(`${backendUrl}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        triggerNotification('Transaction Logged', `Recorded ${txLabel} of ${formatINR(amountVal)}`);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      setIsOfflineMode(true);
      const res = submitTransactionLocal(txData);
      if (res.success) {
        triggerNotification('Transaction Logged', `Recorded ${txLabel} of ${formatINR(amountVal)} (offline)`);
      }
      return res;
    }
  };

  const handleBulkUpdateBalances = async (payload) => {
    if (isOfflineMode) return bulkUpdateBalancesLocal(payload);
    try {
      const res = await fetch(`${backendUrl}/api/accounts/bulk-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: payload })
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      setIsOfflineMode(true);
      return bulkUpdateBalancesLocal(payload);
    }
  };

  const handleAdjustCash = async (closingCash) => {
    if (isOfflineMode) return adjustPhysicalCashLocal(closingCash);
    try {
      const res = await fetch(`${backendUrl}/api/day/adjust-cash`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closingCash })
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      setIsOfflineMode(true);
      return adjustPhysicalCashLocal(closingCash);
    }
  };

  const handleUpdateCustomerName = async (id, customerName) => {
    if (isOfflineMode) {
      const txs = JSON.parse(localStorage.getItem('kiosk_transactions') || '[]');
      const idx = txs.findIndex(t => t._id === id);
      if (idx !== -1) {
        txs[idx].customerName = customerName;
        localStorage.setItem('kiosk_transactions', JSON.stringify(txs));
      }
      loadDataLocal();
      return { success: true };
    }
    try {
      const res = await fetch(`${backendUrl}/api/transactions/${id}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName })
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      const txs = JSON.parse(localStorage.getItem('kiosk_transactions') || '[]');
      const idx = txs.findIndex(t => t._id === id);
      if (idx !== -1) {
        txs[idx].customerName = customerName;
        localStorage.setItem('kiosk_transactions', JSON.stringify(txs));
      }
      loadDataLocal();
      return { success: true };
    }
  };

  const handleOpenDay = async (date, openingCash) => {
    if (isOfflineMode) {
      const active = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
      if (active && active.status === 'Open') return { success: false, error: 'Day already open' };
      const day = {
        date,
        openingCash,
        closingCash: openingCash,
        totalProfit: 0,
        status: 'Open'
      };
      localStorage.setItem('kiosk_active_day', JSON.stringify(day));
      loadDataLocal();
      triggerNotification('Ledger Open', `Ledger opened for ${date} with ₹${openingCash.toLocaleString('en-IN')} cash.`);
      return { success: true };
    }
    try {
      const res = await fetch(`${backendUrl}/api/day/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, openingCash })
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        triggerNotification('Ledger Open', `Ledger opened for ${date} with ₹${openingCash.toLocaleString('en-IN')} cash.`);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      setIsOfflineMode(true);
      const day = {
        date,
        openingCash,
        closingCash: openingCash,
        totalProfit: 0,
        status: 'Open'
      };
      localStorage.setItem('kiosk_active_day', JSON.stringify(day));
      loadDataLocal();
      triggerNotification('Ledger Open', `Ledger opened for ${date} with ₹${openingCash.toLocaleString('en-IN')} cash (offline).`);
      return { success: true };
    }
  };

  const handleCloseDay = async () => {
    const buildLocalBalancesSnapshot = () => {
      const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
      const bankBals = {};
      accs.forEach(a => {
        bankBals[a.bankName] = a.currentBalance;
      });
      return bankBals;
    };

    if (isOfflineMode) {
      const day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
      if (!day) return { success: false, error: 'No open ledger' };
      day.status = 'Closed';
      day.bankBalances = buildLocalBalancesSnapshot();

      const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
      const filtered = history.filter(h => h.date !== day.date);
      filtered.unshift(day);
      localStorage.setItem('kiosk_day_history', JSON.stringify(filtered));

      localStorage.setItem('kiosk_active_day', 'null');
      loadDataLocal();
      triggerNotification('Ledger Closed', `Ledger closed for ${day.date}. EOD report recorded.`);
      return { success: true };
    }
    try {
      const res = await fetch(`${backendUrl}/api/day/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        triggerNotification('Ledger Closed', `Ledger closed. EOD report recorded.`);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      setIsOfflineMode(true);
      const day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
      if (day) {
        day.status = 'Closed';
        day.bankBalances = buildLocalBalancesSnapshot();
        const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
        const filtered = history.filter(h => h.date !== day.date);
        filtered.unshift(day);
        localStorage.setItem('kiosk_day_history', JSON.stringify(filtered));
        localStorage.setItem('kiosk_active_day', 'null');
      }
      loadDataLocal();
      triggerNotification('Ledger Closed', `Ledger closed (offline). EOD report recorded.`);
      return { success: true };
    }
  };

  const handleReopenDay = async (date) => {
    const reopenDayLocal = (d) => {
      const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
      const idx = history.findIndex(h => h.date === d);
      if (idx === -1) return { success: false, error: 'Ledger date not found in history' };

      const day = history[idx];
      day.status = 'Open';

      history.splice(idx, 1);
      localStorage.setItem('kiosk_day_history', JSON.stringify(history));
      localStorage.setItem('kiosk_active_day', JSON.stringify(day));

      loadDataLocal();
      triggerNotification('Ledger Reopened', `Ledger reopened for today.`);
      return { success: true };
    };

    if (isOfflineMode) return reopenDayLocal(date);
    try {
      const res = await fetch(`${backendUrl}/api/day/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date })
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        triggerNotification('Ledger Reopened', `Ledger reopened for today.`);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      setIsOfflineMode(true);
      const res = reopenDayLocal(date);
      if (res.success) {
        triggerNotification('Ledger Reopened', `Ledger reopened (offline).`);
      }
      return res;
    }
  };

  const handleResetPin = () => {
    localStorage.removeItem('kiosk_pin_hash');
    setIsLocked(true);
  };

  // Safe area helper class for mobile screens
  const baseWrapperClass = "w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased select-none pb-[calc(4rem+env(safe-area-inset-bottom))] max-w-md mx-auto border-x border-slate-900 shadow-2xl relative";

  if (isLocked) {
    return <PinLock onUnlock={() => { setIsLocked(false); loadData(); }} />;
  }

  return (
    <div className={baseWrapperClass}>
      
      {/* Mobile Top App Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${isOfflineMode ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></div>
          <h1 className="font-extrabold text-sm tracking-wide text-slate-100 uppercase">Kiosk Ledger</h1>
        </div>
        
        {/* Connection Status Indicator */}
        <div className="flex items-center gap-1 text-[10px] bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
          <span>{isOfflineMode ? 'Local Mode' : 'Cloud Connected'}</span>
        </div>
      </header>

      {/* Main Screen Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-6">
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
            onAddAccount={handleAddAccount}
            onBulkUpdateBalances={handleBulkUpdateBalances}
            onUpdateCustomerName={handleUpdateCustomerName}
          />
        )}
        {activeTab === 'settings' && (
          <Settings
            activeDay={activeDay}
            backendUrl={backendUrl}
            isOfflineMode={isOfflineMode}
            dayHistory={dayHistory}
            transactions={transactions}
            onOpenDay={handleOpenDay}
            onCloseDay={handleCloseDay}
            onReopenDay={handleReopenDay}
            onReloadData={loadData}
            onResetPin={handleResetPin}
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 max-w-md mx-auto z-40 flex items-center justify-around px-2">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
            activeTab === 'home' ? 'text-amber-400 font-bold scale-105' : 'text-slate-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('add')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
            activeTab === 'add' ? 'text-amber-400 font-bold scale-105' : 'text-slate-500'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Withdraw</span>
        </button>

        <button
          onClick={() => setActiveTab('passbook')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
            activeTab === 'passbook' ? 'text-amber-400 font-bold scale-105' : 'text-slate-500'
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Passbook</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all ${
            activeTab === 'settings' ? 'text-amber-400 font-bold scale-105' : 'text-slate-500'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[10px] tracking-wide">Settings</span>
        </button>
      </nav>
    </div>
  );
}
