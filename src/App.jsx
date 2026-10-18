import React, { useState, useEffect, useRef } from 'react';
import { Home, PlusCircle, ClipboardList, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import PinLock from './components/PinLock';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import PassbookAccounts from './components/PassbookAccounts';
import Settings from './components/Settings';

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'add' | 'passbook' | 'settings'
  const [activeDay, setActiveDay] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [dayHistory, setDayHistory] = useState([]);

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

  const loadData = () => {
    loadDataLocal();
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const adjustPhysicalCashLocal = (closingCash, cashDenominations) => {
    let day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    const today = new Date().toISOString().split('T')[0];
    const defaultDenoms = { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0, c20: 0, c10: 0, c5: 0, c2: 0, c1: 0 };
    
    if (!day) {
      day = {
        date: today,
        openingCash: Number(closingCash) || 0,
        closingCash: Number(closingCash) || 0,
        totalProfit: 0,
        status: 'Open',
        cashDenominations: cashDenominations || defaultDenoms
      };
      localStorage.setItem('kiosk_active_day', JSON.stringify(day));
      loadDataLocal();
      triggerNotification('Ledger Open', `Ledger opened with ₹${(Number(closingCash) || 0).toLocaleString('en-IN')} cash.`);
      return { success: true, day };
    }
    
    day.closingCash = Number(closingCash) || 0;
    if (cashDenominations) day.cashDenominations = cashDenominations;
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));
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
    }
    loadDataLocal();
    return { success: true };
  };

  const handleOpenDay = async (date, openingCash, cashDenominations) => {
    const defaultDenoms = cashDenominations || { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0 };
    const active = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    if (active && active.status === 'Open') return { success: false, error: 'Day already open' };
    const day = {
      date,
      openingCash,
      closingCash: openingCash,
      totalProfit: 0,
      status: 'Open',
      cashDenominations: defaultDenoms
    };
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));
    loadDataLocal();
    triggerNotification('Ledger Open', `Ledger opened for ${date} with ₹${openingCash.toLocaleString('en-IN')} cash.`);
    return { success: true };
  };

  const handleCloseDay = async (closingCash, cashDenominations) => {
    const buildLocalBalancesSnapshot = () => {
      const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
      const bankBals = {};
      accs.forEach(a => {
        bankBals[a.bankName] = a.currentBalance;
      });
      return bankBals;
    };

    const day = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
    if (!day) return { success: false, error: 'No open ledger' };
    if (typeof closingCash === 'number') {
      day.closingCash = closingCash;
    }
    if (cashDenominations) {
      day.cashDenominations = cashDenominations;
    }
    day.status = 'Closed';
    day.closedAt = new Date().toISOString();
    day.bankBalances = buildLocalBalancesSnapshot();

    const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
    const filtered = history.filter(h => h.date !== day.date);
    filtered.unshift(day);
    localStorage.setItem('kiosk_day_history', JSON.stringify(filtered));

    localStorage.setItem('kiosk_active_day', 'null');
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

    history.splice(idx, 1);
    localStorage.setItem('kiosk_day_history', JSON.stringify(history));
    localStorage.setItem('kiosk_active_day', JSON.stringify(day));

    loadDataLocal();
    triggerNotification('Ledger Reopened', `Ledger reopened for today.`);
    return { success: true };
  };

  const handleResetPin = () => {
    localStorage.removeItem('kiosk_pin_hash');
    setIsLocked(true);
  };

  // Safe area helper class for mobile screens
  const baseWrapperClass = "w-full min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased select-none pb-[calc(4rem+env(safe-area-inset-bottom))] max-w-md mx-auto border-x border-slate-200 shadow-xl relative";

  if (isLocked) {
    return <PinLock onUnlock={() => { setIsLocked(false); loadData(); }} />;
  }

  return (
    <div className={baseWrapperClass}>
      
      {/* Mobile Top App Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 h-14 flex items-center justify-between px-4 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm"></div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide text-blue-900 uppercase">SBI Kiosk Ledger</h1>
            <p className="text-[9px] text-slate-500 font-medium -mt-0.5">Cash & Account System</p>
          </div>
        </div>
        
        {/* Connection Status Indicator */}
        <div className="flex items-center gap-1 text-[10px] bg-blue-50 border border-blue-200 text-blue-700 font-semibold px-2.5 py-0.5 rounded-full shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Local Safe</span>
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
            activeDay={activeDay}
            onAddAccount={handleAddAccount}
            onBulkUpdateBalances={handleBulkUpdateBalances}
            onUpdateCustomerName={handleUpdateCustomerName}
            onSubmitTransaction={handleSubmitTransaction}
            onAdjustCash={handleAdjustCash}
            onCloseDay={handleCloseDay}
            onOpenDay={handleOpenDay}
          />
        )}
        {activeTab === 'settings' && (
          <Settings
            activeDay={activeDay}
            dayHistory={dayHistory}
            transactions={transactions}
            accounts={accounts}
            onOpenDay={handleOpenDay}
            onCloseDay={handleCloseDay}
            onReopenDay={handleReopenDay}
            onReloadData={loadData}
            onResetPin={handleResetPin}
            onAdjustCash={handleAdjustCash}
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 max-w-md mx-auto z-40 flex items-center justify-around px-2 shadow-lg">
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
      </nav>
    </div>
  );
}
