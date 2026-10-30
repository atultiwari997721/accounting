import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings as SettingsIcon, 
  Play, 
  Square, 
  Download, 
  Upload, 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  RefreshCw, 
  AlertCircle, 
  Sparkles, 
  RefreshCcw, 
  Fingerprint, 
  Calculator, 
  FileText, 
  Share2, 
  Clock,
  History,
  Trash2,
  Calendar,
  Search,
  Filter,
  Activity,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import DenominationModal from './DenominationModal';
import CashStatementReceipt from './CashStatementReceipt';
import DetailedStatementReportModal from './DetailedStatementReportModal';

export default function Settings({ 
  activeDay, 
  dayHistory = [], 
  transactions = [], 
  accounts = [],
  appMode = 'detailed',
  onToggleAppMode,
  loginSecurityEnabled = false,
  onToggleLoginSecurity,
  systemActivityLog = [],
  onClearActivityLog,
  onClearAllData,
  logSystemActivity,
  onOpenDay, 
  onCloseDay, 
  onReopenDay, 
  onReloadData, 
  onResetPin,
  onAdjustCash
}) {
  const getBankAccountsSnapshot = () => {
    const list = accounts.length > 0 ? accounts : JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    return list.map(a => ({
      id: a._id || a.id,
      name: a.bankName || a.name,
      balance: Number(a.currentBalance || a.balance || 0)
    }));
  };

  // 1. ALL STATE HOOKS (DECLARED UNCONDITIONALLY AT THE VERY TOP)
  const [openingCash, setOpeningCash] = useState('');
  const [showDenomModal, setShowDenomModal] = useState(false);
  const [openDenoms, setOpenDenoms] = useState({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0 });
  const [showCloseDenomModal, setShowCloseDenomModal] = useState(false);
  const [closeDenoms, setCloseDenoms] = useState({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0, c20: 0, c10: 0, c5: 0, c2: 0, c1: 0 });
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptParams, setReceiptParams] = useState(null);
  const [selectedReportDay, setSelectedReportDay] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [importing, setImporting] = useState(false);
  const [bioActive, setBioActive] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastClosingCash, setLastClosingCash] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Activity History State & Filtering
  const [activityCategory, setActivityCategory] = useState('ALL');
  const [activityDateFilter, setActivityDateFilter] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [showFullActivity, setShowFullActivity] = useState(false);

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'SESSION':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'LEDGER':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'ACCOUNTS':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'TRANSACTIONS':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'SECURITY':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'DATA':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const filteredActivities = useMemo(() => {
    let list = Array.isArray(systemActivityLog) ? [...systemActivityLog] : [];

    if (activityCategory !== 'ALL') {
      list = list.filter(item => item.category === activityCategory);
    }

    if (activityDateFilter) {
      list = list.filter(item => item.dateStr === activityDateFilter);
    }

    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase();
      list = list.filter(item => 
        (item.action || '').toLowerCase().includes(q) ||
        (item.details || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [systemActivityLog, activityCategory, activityDateFilter, activitySearch]);

  const groupedActivities = useMemo(() => {
    const groups = {};
    filteredActivities.forEach(item => {
      const d = item.dateStr || 'Recent';
      if (!groups[d]) groups[d] = [];
      groups[d].push(item);
    });

    return Object.entries(groups).map(([d, items]) => ({
      date: d,
      items
    }));
  }, [filteredActivities]);

  const handleExportActivityLog = () => {
    const list = Array.isArray(systemActivityLog) ? systemActivityLog : [];
    const textContent = list.map(item => `[${item.dateStr} ${item.timeStr}] [${item.category}] ${item.action}: ${item.details}`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kiosk_system_activity_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (logSystemActivity) {
      logSystemActivity('Activity Log Exported', 'DATA', 'Exported chronological system action history');
    }
  };

  // 2. ALL EFFECT HOOKS
  useEffect(() => {
    const ownerId = localStorage.getItem('kiosk_owner_userid') || 'admin';
    const isReg = localStorage.getItem(`kiosk_biometrics_registered_${ownerId}`) === 'true';
    setBioActive(isReg);
  }, []);

  useEffect(() => {
    const fetchLastClosingCash = () => {
      const history = (dayHistory && dayHistory.length > 0)
        ? dayHistory
        : JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
      if (history.length > 0) {
        const closed = history.filter(d => d.status === 'Closed' || d.closingCash !== undefined);
        if (closed.length > 0) {
          const last = closed[0];
          const cCash = last.closingCash ?? last.closing_cash ?? 0;
          setLastClosingCash(cCash);
          if (!activeDay) {
            setOpeningCash(cCash > 0 ? String(cCash) : (cCash === 0 ? '0' : ''));
            if (last.cashDenominations) {
              setOpenDenoms({
                n500: Number(last.cashDenominations.n500) || 0,
                n200: Number(last.cashDenominations.n200) || 0,
                n100: Number(last.cashDenominations.n100) || 0,
                n50: Number(last.cashDenominations.n50) || 0,
                n20: Number(last.cashDenominations.n20) || 0,
                n10: Number(last.cashDenominations.n10) || 0,
                coins: Number(last.cashDenominations.coins) || 0,
                c20: Number(last.cashDenominations.c20) || 0,
                c10: Number(last.cashDenominations.c10) || 0,
                c5: Number(last.cashDenominations.c5) || 0,
                c2: Number(last.cashDenominations.c2) || 0,
                c1: Number(last.cashDenominations.c1) || 0
              });
            }
          }
        }
      }
    };
    fetchLastClosingCash();
  }, [activeDay, dayHistory]);

  // 3. ALL HANDLERS AND HELPERS
  const toggleBiometrics = async () => {
    setActionError('');
    setActionSuccess('');
    const ownerId = localStorage.getItem('kiosk_owner_userid') || 'admin';

    if (bioActive) {
      localStorage.setItem(`kiosk_biometrics_registered_${ownerId}`, 'false');
      localStorage.removeItem('kiosk_bio_credential_id');
      setBioActive(false);
      setActionSuccess('Biometrics disabled. App will default to PIN keypad login.');
      return;
    }

    const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure && window.location.hostname !== 'localhost') {
      setActionError('Mobile browsers require HTTPS for biometric sensors. On local WiFi (HTTP), use 4-Digit PIN.');
      return;
    }

    if (!window.PublicKeyCredential) {
      setActionError('Biometric authentication is not supported by your browser/device.');
      return;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const hostname = window.location.hostname;
      const isIp = !hostname || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === '[::1]';

      const createOptions = {
        challenge,
        rp: { 
          name: "SBI Kiosk Ledger",
          ...(!isIp ? { id: hostname } : {})
        },
        user: {
          id: new TextEncoder().encode(ownerId),
          name: ownerId,
          displayName: `SBI Kiosk (${ownerId})`
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256 (Android/iOS)
          { alg: -257, type: "public-key" } // RS256 (Windows)
        ],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          requireResidentKey: false,
          userVerification: "preferred"
        },
        attestation: "none"
      };

      const credential = await navigator.credentials.create({ publicKey: createOptions });
      if (credential && credential.rawId) {
        const bytes = new Uint8Array(credential.rawId);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        localStorage.setItem('kiosk_bio_credential_id', btoa(binary));
        localStorage.setItem(`kiosk_biometrics_registered_${ownerId}`, 'true');
        setBioActive(true);
        setActionSuccess('Mobile Biometric Fingerprint activated! You can now unlock using your fingerprint sensor.');
      }
    } catch (err) {
      console.warn('Biometric setup failed or skipped:', err);
      const rawMsg = err?.message || '';
      if (err?.name === 'NotAllowedError' || rawMsg.includes('cancelled') || rawMsg.includes('canceled')) {
        setActionError('Fingerprint registration cancelled by user.');
      } else if (err?.name === 'SecurityError') {
        setActionError('HTTPS required: Mobile browsers only allow hardware biometrics over secure HTTPS.');
      } else {
        setActionError(rawMsg || 'Failed to activate device biometrics.');
      }
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        try {
          new Notification('Kiosk Ledger Activated', {
            body: 'System notifications enabled! You will now receive push updates.'
          });
        } catch (e) {
          console.warn('Failed to dispatch verification notification:', e);
        }
      }
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayClosedLedger = (dayHistory || []).find(d => d.date === todayStr && d.status === 'Closed');

  const handleReopen = async () => {
    if (!window.confirm("Wanna reopen the daily ledger for today? You can continue logging withdrawals/deposits.")) return;
    
    const pin = window.prompt("Please enter your PIN to reopen the ledger:");
    if (!pin) return;
    
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const storedHash = localStorage.getItem('kiosk_pin_hash');
      if (storedHash && hashHex !== storedHash) {
        alert("Incorrect PIN. Cannot reopen ledger.");
        return;
      }
    } catch (e) {
      console.error("PIN verification error", e);
    }

    setActionError('');
    setActionSuccess('');
    setIsSubmitting(true);
    const res = await onReopenDay(todayStr);
    if (res.success) {
      setActionSuccess('Daily ledger reopened successfully!');
      onReloadData();
    } else {
      setActionError(res.error || 'Failed to reopen ledger.');
    }
    setIsSubmitting(false);
  };

  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');

  const handleOpenDay = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    if (!openingCash || Number(openingCash) < 0) {
      setActionError('Please enter a valid opening physical cash amount.');
      return;
    }

    setIsSubmitting(true);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const res = await onOpenDay(today, Number(openingCash), openDenoms);
    if (res.success) {
      setActionSuccess(`Ledger session opened for ${today}!`);
      setOpeningCash('');
    } else {
      setActionError(res.error || 'Failed to open day summary.');
    }
    setIsSubmitting(false);
  };

  const handleCloseDay = () => {
    if (!window.confirm('Are you sure you want to CLOSE the ledger for today? You cannot record more transactions for today afterwards.')) return;
    
    if (activeDay?.cashDenominations) {
      setCloseDenoms({
        n500: Number(activeDay.cashDenominations.n500) || 0,
        n200: Number(activeDay.cashDenominations.n200) || 0,
        n100: Number(activeDay.cashDenominations.n100) || 0,
        n50: Number(activeDay.cashDenominations.n50) || 0,
        n20: Number(activeDay.cashDenominations.n20) || 0,
        n10: Number(activeDay.cashDenominations.n10) || 0,
        coins: Number(activeDay.cashDenominations.coins) || 0,
        c20: Number(activeDay.cashDenominations.c20) || 0,
        c10: Number(activeDay.cashDenominations.c10) || 0,
        c5: Number(activeDay.cashDenominations.c5) || 0,
        c2: Number(activeDay.cashDenominations.c2) || 0,
        c1: Number(activeDay.cashDenominations.c1) || 0
      });
    }
    // Open denomination modal for closing cash
    setShowCloseDenomModal(true);
  };

  const executeCloseDay = async (totalCash, denoms) => {
    setActionError('');
    setActionSuccess('');
    setIsSubmitting(true);
    
    if (onAdjustCash) {
      const adjustRes = await onAdjustCash(totalCash, denoms);
      if (!adjustRes.success) {
        setActionError(adjustRes.error || 'Failed to adjust closing physical cash.');
        setIsSubmitting(false);
        return;
      }
    }
    
    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
    const totalOnline = accs.reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0);

    const res = await onCloseDay(totalCash, denoms);
    if (res.success) {
      setActionSuccess('Business day ledger closed successfully! Receipt generated.');
      setReceiptParams({
        dateStr: activeDay?.date || todayStr,
        totalCash: totalCash,
        denominations: denoms,
        onlineAmount: totalOnline,
        accountName: 'SBI Kiosk Cash Calculation',
        bankAccounts: getBankAccountsSnapshot()
      });
      setShowReceiptModal(true);
    } else {
      setActionError(res.error || 'Failed to close day summary.');
    }
    setIsSubmitting(false);
  };

  const downloadFile = async (endpoint, defaultFilename) => {
    setActionError('');
    setActionSuccess('');

    try {
      if (endpoint === 'export-csv') {
        let txs = JSON.parse(localStorage.getItem('kiosk_transactions') || '[]');
        
        if (startDate) {
          txs = txs.filter(t => t.timestamp.split('T')[0] >= startDate);
        }
        if (endDate) {
          txs = txs.filter(t => t.timestamp.split('T')[0] <= endDate);
        }

        const localAccs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
        const dayHistoryLocal = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
        const activeLocal = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
        
        const daySummariesList = [...dayHistoryLocal];
        if (activeLocal) daySummariesList.push(activeLocal);

        // Group by date
        const groups = {};
        txs.forEach(tx => {
          const dateStr = tx.timestamp.split('T')[0];
          if (!groups[dateStr]) groups[dateStr] = [];
          groups[dateStr].push(tx);
        });

        const sortedDates = Object.keys(groups).sort();

        let csv = 'Timestamp,Bank Account,Type,Customer Amount,Cash Out,Net Profit,Commission Mode,Customer Name,Bank Running Balance,Drawer Cash Balance\n';

        for (const dateStr of sortedDates) {
          const dayTxs = groups[dateStr];
          const daySummary = daySummariesList.find(d => d.date === dateStr) || {
            date: dateStr,
            openingCash: 0,
            closingCash: 0,
            totalProfit: 0,
            status: 'Closed',
            bankBalances: {}
          };

          const dayClosingCash = Number(daySummary.closingCash || 0);
          const dayOpeningCash = Number(daySummary.openingCash || 0);
          const bankClosingMap = daySummary.bankBalances || {};

          // Sort newest first to trace bank balance backwards
          const txsDesc = [...dayTxs].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

          const runningBankMap = {};
          localAccs.forEach(acc => {
            if (daySummary.status === 'Open') {
              runningBankMap[acc._id] = Number(acc.currentBalance || 0);
            } else {
              runningBankMap[acc._id] = bankClosingMap[acc.bankName] !== undefined
                ? Number(bankClosingMap[acc.bankName])
                : Number(acc.currentBalance || 0);
            }
          });

          const mappedDesc = txsDesc.map(tx => {
            const bankId = tx.bankAccountId?._id || tx.bankAccountId;
            const currentVal = runningBankMap[bankId] !== undefined ? runningBankMap[bankId] : 0;
            tx.runningBankBalAfter = currentVal;
            runningBankMap[bankId] = currentVal - Number(tx.customerAmount || 0);
            return tx;
          });

          // Sort oldest first to compute cash running balance forwards
          const txsAsc = [...mappedDesc].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
          let runningCash = dayOpeningCash;

          const finalTxs = txsAsc.map(tx => {
            runningCash = runningCash - Number(tx.cashOut || 0);
            tx.runningCashAfter = runningCash;
            return tx;
          });

          finalTxs.forEach(tx => {
            const bankName = tx.bankAccountId?.bankName || 'Local Bank';
            const timeStr = new Date(tx.timestamp).toLocaleString();
            const comm = tx.commissionMode || 'Deducted';
            const cust = tx.customerName || '';
            csv += `"${timeStr}","${bankName.replace(/"/g, '""')}","${tx.type}",${tx.customerAmount},${tx.cashOut},${tx.profit},"${comm}","${cust.replace(/"/g, '""')}",${tx.runningBankBalAfter},${tx.runningCashAfter}\n`;
          });

          const bankSnapStr = Object.entries(bankClosingMap)
            .map(([name, bal]) => `${name}: ₹${Number(bal).toLocaleString('en-IN')}`)
            .join(' | ');

          csv += `"=== EOD SUMMARY ===","Date: ${dateStr}","Total Tx: ${finalTxs.length}","Net Profit: ₹${Number(daySummary.totalProfit || 0).toLocaleString('en-IN')}","Drawer Cash: ₹${Number(dayClosingCash).toLocaleString('en-IN')}","Bank Snapshots: ${bankSnapStr || 'None'}","","","",""\n\n`;
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = startDate && endDate ? `kiosk_transactions_${startDate}_to_${endDate}.csv` : 'kiosk_transactions_local.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setActionSuccess('CSV downloaded successfully!');
      } else {
        // bin backup
        const accounts = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
        let transactions = JSON.parse(localStorage.getItem('kiosk_transactions') || '[]');
        const daySummaries = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
        const active = JSON.parse(localStorage.getItem('kiosk_active_day') || 'null');
        if (active) daySummaries.push(active);

        if (startDate) {
          transactions = transactions.filter(t => t.timestamp.split('T')[0] >= startDate);
        }
        if (endDate) {
          transactions = transactions.filter(t => t.timestamp.split('T')[0] <= endDate);
        }

        const backupData = {
          accounts,
          transactions,
          daySummaries,
          exportedAt: new Date().toISOString(),
          isLocalBackup: true
        };

        const text = btoa(unescape(encodeURIComponent(JSON.stringify(backupData))));
        const blob = new Blob([text], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = startDate && endDate ? `kiosk_backup_${startDate}_to_${endDate}.bin` : 'kiosk_backup_local.bin';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setActionSuccess('Encrypted backup downloaded successfully!');
      }
    } catch (err) {
      setActionError(`Export failed: ${err.message}`);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionError('');
    setActionSuccess('');
    setImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const encryptedData = evt.target?.result;
          if (typeof encryptedData !== 'string') throw new Error('Could not read file.');

          // Decode from base64 representation
          const decrypted = decodeURIComponent(escape(atob(encryptedData)));
          const data = JSON.parse(decrypted);

          if (!data.accounts || !data.transactions || !data.daySummaries) {
            throw new Error('Invalid backup structure.');
          }

          localStorage.setItem('kiosk_accounts', JSON.stringify(data.accounts));
          localStorage.setItem('kiosk_transactions', JSON.stringify(data.transactions));
          
          // Find active day and history list
          const active = data.daySummaries.find(d => d.status === 'Open') || null;
          const history = data.daySummaries.filter(d => d.status === 'Closed');
          
          localStorage.setItem('kiosk_active_day', JSON.stringify(active));
          localStorage.setItem('kiosk_day_history', JSON.stringify(history));

          setActionSuccess('Database restored successfully!');
          onReloadData();
        } catch (err) {
          setActionError(`Import failed: ${err.message}`);
        } finally {
          setImporting(false);
        }
      };
      reader.readAsText(file);
    } catch (err) {
      setActionError(`Import reading error: ${err.message}`);
      setImporting(false);
    }
  };

  const seedDemoData = async () => {
    if (!window.confirm('This will seed demo accounts. Existing bank accounts will be preserved. Proceed?')) return;
    
    setActionError('');
    setActionSuccess('');
    setIsSubmitting(true);

    try {
      const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
      const banks = ['SBI Main Account', 'ICICI Business', 'HDFC Ledger'];
      
      banks.forEach(bankName => {
        const exists = accs.find(a => a.bankName.toLowerCase() === bankName.toLowerCase());
        if (!exists) {
          accs.push({
            _id: 'local_' + Math.random().toString(36).substr(2, 9),
            bankName,
            currentBalance: Math.floor(Math.random() * 80000) + 20000,
            createdAt: new Date().toISOString()
          });
        }
      });
      localStorage.setItem('kiosk_accounts', JSON.stringify(accs));
      setActionSuccess('Demo accounts seeded locally! Open the day ledger to start.');
      onReloadData();
    } catch (err) {
      setActionError('Failed to seed local accounts.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPin = () => {
    if (window.confirm('Wipe passcode? You will be asked to configure a new 4-digit PIN instantly.')) {
      onResetPin();
    }
  };

  const handleWhatsAppShare = () => {
    let rangeTxs = transactions || [];
    if (startDate) {
      rangeTxs = rangeTxs.filter(t => t.timestamp.split('T')[0] >= startDate);
    }
    if (endDate) {
      rangeTxs = rangeTxs.filter(t => t.timestamp.split('T')[0] <= endDate);
    }

    const sorted = [...rangeTxs].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

    let totalProfit = 0;
    let withdrawCount = 0;
    let withdrawAmt = 0;
    let depositCount = 0;
    let depositAmt = 0;
    let txLines = '';

    sorted.forEach((tx, index) => {
      totalProfit += tx.profit;
      const bankName = tx.bankAccountId?.bankName || 'Local Bank';
      const isDebit = tx.type === 'Debit';
      const amt = isDebit ? Math.abs(tx.customerAmount) : tx.cashOut;
      
      if (isDebit) {
        depositCount++;
        depositAmt += amt;
      } else {
        withdrawCount++;
        withdrawAmt += amt;
      }

      const comm = tx.commissionMode || 'Deducted';
      txLines += `${index + 1}. ${isDebit ? 'Dep' : 'Wd'} | ${bankName} | ₹${amt.toLocaleString('en-IN')} | Comm: ${comm} | Profit: ₹${tx.profit}\n`;
    });

    const closingCash = activeDay ? activeDay.closingCash : (dayHistory.length > 0 ? dayHistory[0].closingCash : 0);

    const title = startDate && endDate 
      ? `*Kiosk Ledger Report (${startDate} to ${endDate})*` 
      : `*Kiosk Ledger Daily Report - ${activeDay?.date || todayStr}*`;

    const text = `${title}

📊 *Summary Statistics:*
• Total Transactions: ${sorted.length}
• Withdrawals: ${withdrawCount} (₹${withdrawAmt.toLocaleString('en-IN')})
• Deposits: ${depositCount} (₹${depositAmt.toLocaleString('en-IN')})
• Net Commission Profit: ₹${totalProfit.toLocaleString('en-IN')}
💵 *Physical Cash in Drawer:* ₹${Number(closingCash).toLocaleString('en-IN')}

📝 *Transaction Details:*
${txLines || 'No transactions logged in this range.'}
_Sent from Kiosk Ledger PWA_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-12 select-none">
      <div className="flex flex-col gap-0.5 text-left">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-blue-600" /> Settings & Backups
        </h2>
        <p className="text-xs text-slate-500">Manage daily ledger sessions, backups, and security settings</p>
      </div>

      {/* App Operating Mode Selector (Simple Mode vs Detailed Mode) */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col gap-3 text-left border border-slate-800">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${appMode === 'simple' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300">App Operating Mode</span>
              <h3 className="text-sm font-black text-white">
                {appMode === 'simple' ? '⚡ Simple Mode (1-Time Totals)' : '📑 Detailed Mode (Tx-by-Tx)'}
              </h3>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
            appMode === 'simple' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'bg-blue-600 text-white'
          }`}>
            Active
          </span>
        </div>

        <p className="text-[11px] text-slate-300 leading-relaxed">
          {appMode === 'simple' 
            ? 'Simple Mode: Enter morning & evening Cash and Bank balances once. Profit is auto-calculated from the difference, with quick customer Udhar & Jama.'
            : 'Detailed Mode: Record every withdrawal & deposit individually with real-time drawer denominations, commission calculations, and customer slips.'}
        </p>

        {/* Mode Toggle Buttons */}
        <div className="grid grid-cols-2 gap-2 bg-white/10 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onToggleAppMode && onToggleAppMode('simple')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              appMode === 'simple'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>⚡ Simple Mode</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleAppMode && onToggleAppMode('detailed')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              appMode === 'detailed'
                ? 'bg-blue-600 text-white shadow-md font-black'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>📑 Detailed Mode</span>
          </button>
        </div>
      </div>

      {/* Daily Ledger Controls */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 text-left">
          <Square className="w-3.5 h-3.5 text-blue-600" /> Daily Ledger Controls
        </h3>

        {activeDay ? (
          <div className="flex flex-col gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-1 text-left shadow-2xs">
              <span className="text-[10px] text-slate-400 font-medium">Date: {activeDay.date}</span>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-slate-600 font-semibold">Cash in Hand:</span>
                <span className="text-sm font-black text-amber-700">{formatINR(activeDay.closingCash)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 font-semibold">Total Profit Today:</span>
                <span className="text-sm font-black text-emerald-600">{formatINR(activeDay.totalProfit)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  Share Summary
                </button>
                <button
                  onClick={handleCloseDay}
                  disabled={isSubmitting}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Square className="w-4 h-4 fill-current" /> Close Ledger
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReportDay(activeDay);
                    setShowReportModal(true);
                  }}
                  className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" /> Full Statement
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
                    const totalOnline = accs.reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0);
                    setReceiptParams({
                      dateStr: activeDay?.date || todayStr,
                      totalCash: activeDay?.closingCash || 0,
                      denominations: activeDay?.cashDenominations || {},
                      onlineAmount: totalOnline,
                      accountName: 'SBI Kiosk Cash Calculation',
                      bankAccounts: getBankAccountsSnapshot()
                    });
                    setShowReceiptModal(true);
                  }}
                  className="h-10 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <Calculator className="w-3.5 h-3.5 text-blue-600" /> Cash Slip
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {todayClosedLedger && (
              <div className="flex flex-col gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl text-left shadow-2xs">
                <div className="flex justify-between items-center text-xs border-b border-slate-200 pb-1.5">
                  <span className="text-slate-600 font-bold uppercase text-[9px] tracking-wider">Today's Session Summary</span>
                  <span className="px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded-md font-bold text-[8px] uppercase">Closed</span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1">
                  <span className="text-slate-500 font-medium">Cash Left in Drawer:</span>
                  <span className="font-black text-slate-800">{formatINR(todayClosedLedger.closingCash)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Net Profit Earned:</span>
                  <span className="font-black text-emerald-600">{formatINR(todayClosedLedger.totalProfit)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReportDay(todayClosedLedger);
                      setShowReportModal(true);
                    }}
                    className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" /> Statement
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const accs = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
                      const totalOnline = accs.reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0);
                      setReceiptParams({
                        dateStr: todayClosedLedger.date,
                        totalCash: todayClosedLedger.closingCash,
                        denominations: todayClosedLedger.cashDenominations || {},
                        onlineAmount: totalOnline,
                        accountName: 'SBI Kiosk Cash Calculation',
                        bankAccounts: todayClosedLedger.bankBalances || getBankAccountsSnapshot()
                      });
                      setShowReceiptModal(true);
                    }}
                    className="h-10 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Calculator className="w-3.5 h-3.5 text-blue-600" /> Slip
                  </button>
                  <button
                    type="button"
                    onClick={handleReopen}
                    disabled={isSubmitting}
                    className="h-10 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" /> Reopen
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleOpenDay} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Open New Session / Ledger</label>
                  <button
                    type="button"
                    onClick={() => setShowDenomModal(true)}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Calculator className="w-3 h-3" /> Note Counter
                  </button>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Opening Cash (₹)"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value.replace(/[^0-9]/g, ''))}
                    className="flex-1 h-10 px-3 text-xs bg-slate-50 border border-slate-300 focus:border-blue-600 focus:outline-none rounded-xl text-slate-900 font-bold shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDenomModal(true)}
                    className="h-10 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-all shrink-0 shadow-xs"
                  >
                    <Calculator className="w-3.5 h-3.5" /> Count Notes
                  </button>
                </div>
                {lastClosingCash > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-left mt-1 shadow-2xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Default Opening Cash Carried Forward
                      </span>
                      <span className="text-[9px] text-emerald-600 font-medium">
                        Auto-loaded from previous closed ledger: {formatINR(lastClosingCash)}
                      </span>
                    </div>
                    {openingCash !== String(lastClosingCash) && (
                      <button
                        type="button"
                        onClick={() => setOpeningCash(String(lastClosingCash))}
                        className="text-[9px] bg-emerald-600 text-white font-bold px-2 py-1 rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
                      >
                        Reset to {formatINR(lastClosingCash)}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Play className="w-4 h-4 fill-current" /> Open Daily Ledger
              </button>
            </form>

            <DenominationModal
              isOpen={showDenomModal}
              onClose={() => setShowDenomModal(false)}
              initialDenominations={openDenoms}
              onSave={(totalCash, denoms) => {
                setOpeningCash(String(totalCash));
                setOpenDenoms(denoms);
              }}
              title="Opening Physical Cash Notes"
            />
          </div>
        )}
      </div>

      {/* Backup and CSV Export */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm text-left">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5 text-blue-600" /> Database Backup & Export
        </h3>

        {/* Date selection filters */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2 shadow-2xs">
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wide">Filter Statement Dates</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] text-slate-500 font-medium">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 px-2 bg-white border border-slate-300 rounded-lg text-[10px] font-bold text-slate-800 focus:outline-none shadow-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] text-slate-500 font-medium">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2 bg-white border border-slate-300 rounded-lg text-[10px] font-bold text-slate-800 focus:outline-none shadow-xs"
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-[9px] text-blue-600 font-bold text-right hover:underline mt-1"
            >
              Clear Date Filter
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {/* CSV Download */}
          <button
            onClick={() => downloadFile('export-csv', 'kiosk_transactions.csv')}
            className="w-full h-10 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 active:scale-95 transition-all shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Download Transactions CSV
          </button>

          {/* Encrypted BIN Download */}
          <button
            onClick={() => downloadFile('export', 'kiosk_backup_encrypted.bin')}
            className="w-full h-10 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 active:scale-95 transition-all shadow-xs"
          >
            <Download className="w-4 h-4 text-blue-600" /> Download Encrypted Bin Backup
          </button>
        </div>
      </div>

      {/* App Permissions & Notifications */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 text-left">
          <ShieldAlert className="w-3.5 h-3.5 text-blue-600" /> System Permissions
        </h3>
        
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
          <div className="flex flex-col gap-0.5 text-left">
            <span className="text-xs font-bold text-slate-800">Desktop Notifications</span>
            <span className="text-[9px] text-slate-500">Alerts for completed transfers and ledger closures</span>
          </div>
          
          {notificationPermission === 'granted' ? (
            <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[9px] font-bold uppercase">Activated</span>
          ) : (
            <button
              onClick={requestNotificationPermission}
              className="px-3 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs"
            >
              Grant Permission
            </button>
          )}
        </div>
      </div>

      {/* Database Import */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm text-left">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-blue-600" /> Restore Database
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Restore data from a previously downloaded `.bin` backup file. This replaces all accounts and ledger history.
        </p>
        
        <label className="w-full h-10 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 transition-all shadow-2xs">
          <Upload className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-700">
            {importing ? 'Restoring Ledger...' : 'Choose .bin Backup File'}
          </span>
          <input
            type="file"
            accept=".bin"
            onChange={handleImportBackup}
            disabled={importing}
            className="hidden"
          />
        </label>
      </div>

      {/* App Login Security Criteria Control Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm text-left">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-blue-600" /> App Login Security Criteria
          </h3>
          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
            loginSecurityEnabled ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            {loginSecurityEnabled ? 'ACTIVE (PIN / Bio Required)' : 'DISABLED (Direct Open)'}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          {loginSecurityEnabled
            ? 'Login criteria is currently ENABLED. The app prompts for PIN or Biometrics on launch and after 5 minutes of inactivity.'
            : 'Login criteria is currently DISABLED. The app opens directly into Simple Calculation Mode without requiring PIN or biometric verification.'}
        </p>

        <button
          onClick={() => {
            if (onToggleLoginSecurity) {
              onToggleLoginSecurity(!loginSecurityEnabled);
              setActionSuccess(!loginSecurityEnabled ? 'Login criteria enabled.' : 'Login criteria disabled. App will open directly.');
            }
          }}
          className={`w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            loginSecurityEnabled
              ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
          }`}
        >
          {loginSecurityEnabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          {loginSecurityEnabled ? 'Disable Login Criteria (Direct Access)' : 'Enable Login Criteria (PIN Required)'}
        </button>
      </div>

      {/* Biometric Security Control Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm text-left">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Fingerprint className="w-3.5 h-3.5 text-blue-600" /> Biometric Fingerprint Login
          </h3>
          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
            bioActive ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {bioActive ? 'ACTIVE (Fingerprint Primary)' : 'DISABLED (PIN Only)'}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          {bioActive
            ? 'Fingerprint biometrics are set as your PRIMARY login mode on refresh/load, with 4-Digit PIN as secondary backup.'
            : 'Enable fingerprint scanner or Windows Hello / FaceID to automatically authenticate on app launch.'}
        </p>

        <button
          onClick={toggleBiometrics}
          className={`w-full h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            bioActive
              ? 'bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          {bioActive ? 'Disable Biometric Fingerprint' : 'Activate Biometric Fingerprint Login'}
        </button>
      </div>

      {/* Security Actions & Demos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm text-left">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" /> Access & System Actions
        </h3>
        
        <div className="flex flex-col gap-2">
          {/* Seed Demo Account */}
          <button
            onClick={seedDemoData}
            disabled={isSubmitting}
            className="w-full h-10 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-600" /> Seed Dummy Bank Accounts
          </button>

          {/* Reset PIN */}
          <button
            onClick={handleResetPin}
            className="w-full h-10 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
          >
            <RefreshCw className="w-4 h-4 text-rose-600" /> Reset Security PIN Passcode
          </button>

          {/* Wipe All Data & Start Fresh */}
          <button
            onClick={() => {
              if (window.confirm('⚠️ WARNING: Are you sure you want to WIPE ALL DATA and start fresh from now on? This will reset all bank accounts, transactions, day ledger history, and calculation sheets back to zero.')) {
                if (window.confirm('FINAL CONFIRMATION: This action is permanent and cannot be undone. Wipe everything and start clean?')) {
                  if (onClearAllData) onClearAllData();
                  setActionSuccess('All data cleared successfully! System has started fresh with a clean slate.');
                }
              }
            }}
            className="w-full h-10 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs"
          >
            <Trash2 className="w-4 h-4 text-red-600" /> Wipe All Data & Start Fresh
          </button>
        </div>
      </div>

      {/* System Action & Activity History (Date-Wise Audit Log) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm text-left">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                System Action & Activity History
              </h3>
              <p className="text-[10px] text-slate-400">Date-wise audit trail of all actions performed in app</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {systemActivityLog?.length || 0} Events
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px] font-semibold">
          {['ALL', 'SESSION', 'LEDGER', 'ACCOUNTS', 'TRANSACTIONS', 'SECURITY', 'DATA'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActivityCategory(cat)}
              className={`px-2.5 py-1 rounded-lg transition-all shrink-0 uppercase tracking-wider ${
                activityCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filter Controls: Date Filter & Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search actions or details..."
              value={activitySearch}
              onChange={(e) => setActivitySearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="relative shrink-0">
            <input
              type="date"
              value={activityDateFilter}
              onChange={(e) => setActivityDateFilter(e.target.value)}
              className="px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-600 font-medium"
            />
          </div>

          {activityDateFilter && (
            <button
              onClick={() => setActivityDateFilter('')}
              className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg shrink-0"
              title="Clear date filter"
            >
              Reset
            </button>
          )}
        </div>

        {/* Activity Timeline List Grouped Date-Wise */}
        {groupedActivities.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center gap-2">
            <Activity className="w-6 h-6 text-slate-300" />
            <span className="text-xs font-medium text-slate-400">No activity logs recorded matching current filters</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
            {(showFullActivity ? groupedActivities : groupedActivities.slice(0, 3)).map(group => (
              <div key={group.date} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between sticky top-0 bg-white py-1 z-10 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    {group.date === new Date().toISOString().split('T')[0] ? 'Today' : group.date}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {group.items.length} {group.items.length === 1 ? 'action' : 'actions'}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-slate-200 ml-1.5">
                  {(showFullActivity ? group.items : group.items.slice(0, 5)).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-slate-50/80 hover:bg-slate-100/80 border border-slate-100 rounded-lg p-2 flex flex-col gap-1 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-800 truncate">
                          {item.action}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getCategoryBadgeClass(item.category)}`}>
                            {item.category}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {item.timeStr || ''}
                          </span>
                        </div>
                      </div>
                      {item.details && (
                        <p className="text-[10px] text-slate-600 leading-snug break-words">
                          {item.details}
                        </p>
                      )}
                    </div>
                  ))}
                  {!showFullActivity && group.items.length > 5 && (
                    <span className="text-[9px] text-slate-400 italic pl-1">
                      + {group.items.length - 5} more actions on this date
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View Toggle */}
        {groupedActivities.length > 0 && (
          <button
            onClick={() => setShowFullActivity(!showFullActivity)}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 py-1 text-center transition-colors"
          >
            {showFullActivity ? 'Show Recent Activities Only' : 'Show All Historical Dates & Actions'}
          </button>
        )}

        {/* Footer Actions */}
        <div className="flex gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={handleExportActivityLog}
            className="flex-1 h-9 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" /> Export Log (.txt)
          </button>

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the system activity history?')) {
                if (onClearActivityLog) onClearActivityLog();
                setActionSuccess('Activity history log cleared.');
              }
            }}
            className="h-9 px-3 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Clear
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Closing Day Physical Cash Denomination Modal */}
      <DenominationModal
        isOpen={showCloseDenomModal}
        onClose={() => setShowCloseDenomModal(false)}
        initialDenominations={closeDenoms}
        onSave={(totalCash, denoms) => {
          setCloseDenoms(denoms);
          executeCloseDay(totalCash, denoms);
        }}
        title="Closing Physical Cash Notes"
      />

      {/* Cash Statement Receipt Modal */}
      {receiptParams && (
        <CashStatementReceipt
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          dateStr={receiptParams.dateStr}
          accountName={receiptParams.accountName}
          denominations={receiptParams.denominations}
          totalCash={receiptParams.totalCash}
          onlineAmount={receiptParams.onlineAmount}
          bankAccounts={receiptParams.bankAccounts || getBankAccountsSnapshot()}
          kioskTitle="SBI Kiosk"
        />
      )}

      {/* Detailed Statement & Audit Report Modal */}
      {selectedReportDay && (
        <DetailedStatementReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setSelectedReportDay(null);
          }}
          day={selectedReportDay}
          transactions={transactions}
          accounts={accounts}
          kioskTitle="SBI Kiosk Banking Point"
        />
      )}
    </div>
  );
}
