import React, { useState, useEffect, useMemo } from 'react';
import { Landmark, ClipboardList, PlusCircle, CreditCard, ChevronRight, Search, Calendar, Edit3, UserCheck, Calculator, Coins, IndianRupee, ArrowDownRight, ArrowUpRight, CheckCircle2, UserX, FileText, Square, RotateCcw, Check, Play, AlertTriangle, Download, Share2, Clock, Eye, History, ShieldCheck } from 'lucide-react';
import DenominationModal from './DenominationModal';
import CashStatementReceipt from './CashStatementReceipt';
import DetailedStatementReportModal from './DetailedStatementReportModal';
import { numberToIndianWords } from '../utils/numberToWords';

export default function PassbookAccounts({ 
  accounts, 
  transactions, 
  dayHistory = [], 
  activeDay = null,
  onAddAccount, 
  onBulkUpdateBalances, 
  onUpdateCustomerName,
  onSubmitTransaction,
  onAdjustCash,
  onCloseDay,
  onOpenDay,
  onReopenDay
}) {
  const [activeSubTab, setActiveSubTab] = useState('passbook'); // 'passbook' | 'cash_counter' | 'receipt' | 'udhar_jama' | 'accounts' | 'reports'
  const [bankName, setBankName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'credit' | 'debit' | 'udhar' | 'jama'

  // Cash addition & note counter state
  const [cashNotes, setCashNotes] = useState({
    n500: 0,
    n200: 0,
    n100: 0,
    n50: 0,
    n20: 0,
    n10: 0,
    coins: 0,
    c20: 0,
    c10: 0,
    c5: 0,
    c2: 0,
    c1: 0
  });

  // Cash addition & receipt modal states
  const [showDenomModal, setShowDenomModal] = useState(false);
  const [showCloseDenomModal, setShowCloseDenomModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptParams, setReceiptParams] = useState(null);
  const [closeDenoms, setCloseDenoms] = useState({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0, c20: 0, c10: 0, c5: 0, c2: 0, c1: 0 });

  // Settlement Modal state for Udhar payment
  const [settleCustomer, setSettleCustomer] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('cash'); // 'cash' | 'bank'
  const [settleBankId, setSettleBankId] = useState('');

  // EOD History expandable transactions state
  const [expandedDays, setExpandedDays] = useState({});
  const [expandedAuditDays, setExpandedAuditDays] = useState({});
  const [selectedStatementDay, setSelectedStatementDay] = useState(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [quickCopiedDay, setQuickCopiedDay] = useState(null);

  const [editableBalances, setEditableBalances] = useState({});

  useEffect(() => {
    if (accounts.length > 0) {
      const initial = {};
      accounts.forEach(acc => {
        initial[acc._id] = String(acc.currentBalance || 0);
      });
      setEditableBalances(initial);
      if (!settleBankId) setSettleBankId(accounts[0]._id);
    }
  }, [accounts]);

  const liveTotalBankMoney = Object.values(editableBalances).reduce((sum, val) => sum + (Number(val) || 0), 0);

  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');

  const handleSaveName = async (id) => {
    if (onUpdateCustomerName) {
      await onUpdateCustomerName(id, tempName);
    }
    setEditingTxId(null);
  };

  const handleBalanceChange = (id, val) => {
    const cleanVal = val.replace(/[^0-9]/g, '');
    setEditableBalances(prev => ({
      ...prev,
      [id]: cleanVal
    }));
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSaveAllBalances = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      const payload = Object.entries(editableBalances).map(([id, currentBalance]) => ({
        id,
        currentBalance: Number(currentBalance) || 0
      }));
      const result = await onBulkUpdateBalances(payload);
      if (result.success) {
        setSuccessMsg('All bank balances updated successfully!');
      } else {
        setErrorMsg(result.error || 'Failed to update balances.');
      }
    } catch (err) {
      setErrorMsg('Error saving bank balances.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!bankName.trim()) {
      setErrorMsg('Bank name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onAddAccount({
        bankName: bankName.trim(),
        currentBalance: Number(initialBalance) || 0
      });

      if (result.success) {
        setSuccessMsg(`Bank "${bankName}" registered successfully!`);
        setBankName('');
        setInitialBalance('');
      } else {
        setErrorMsg(result.error || 'Failed to add bank account.');
      }
    } catch (err) {
      setErrorMsg('Network error. Check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute per-customer customer ledgers (Udhar vs Jama)
  const customerLedgers = useMemo(() => {
    const ledgers = {};
    (transactions || []).forEach(tx => {
      const name = (tx.customerName || '').trim();
      if (!name) return;

      if (!ledgers[name]) {
        ledgers[name] = { customerName: name, totalUdhar: 0, totalJama: 0, txCount: 0 };
      }

      ledgers[name].txCount++;

      if (tx.commissionMode === 'Udhar') {
        ledgers[name].totalUdhar += Math.abs(tx.cashOut || tx.customerAmount || 0);
      }
      if (tx.type === 'Jama' || tx.commissionMode === 'Jama') {
        ledgers[name].totalJama += Math.abs(tx.customerAmount || tx.cashOut || 0);
      }
    });

    return Object.values(ledgers).map(item => ({
      ...item,
      netBalance: item.totalJama - item.totalUdhar // Positive = Jama advance, Negative = Udhar due
    }));
  }, [transactions]);

  const totalOutstandingUdhar = useMemo(() => {
    return customerLedgers.reduce((sum, c) => sum + (c.netBalance < 0 ? Math.abs(c.netBalance) : 0), 0);
  }, [customerLedgers]);

  const totalCustomerJama = useMemo(() => {
    return customerLedgers.reduce((sum, c) => sum + (c.netBalance > 0 ? c.netBalance : 0), 0);
  }, [customerLedgers]);

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const bankNameStr = tx.bankAccountId?.bankName || '';
    const custNameStr = tx.customerName || '';
    const matchesSearch = bankNameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          custNameStr.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterType === 'credit') return tx.type === 'Credit' && tx.commissionMode !== 'Udhar';
    if (filterType === 'debit') return tx.type === 'Debit' && tx.commissionMode !== 'Udhar';
    if (filterType === 'udhar') return tx.commissionMode === 'Udhar';
    if (filterType === 'jama') return tx.type === 'Jama' || tx.commissionMode === 'Jama';

    return true;
  });

  const denoms = activeDay?.cashDenominations || { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0 };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    if (!settleCustomer) return;

    const amt = Number(settleAmount) || 0;
    if (amt <= 0) {
      setErrorMsg('Please enter a valid settlement amount.');
      return;
    }

    if (!onSubmitTransaction) return;

    setIsSubmitting(true);
    try {
      // Settle Udhar: Customer pays cash or bank transfer to reduce Udhar
      // If paid via Cash: Physical cash increases (cashOut = -amt), bankAmount = 0
      // If paid via Bank: Bank balance increases (customerAmount = +amt), cashOut = 0
      const result = await onSubmitTransaction({
        bankAccountId: settleBankId || accounts[0]?._id,
        customerAmount: settleMethod === 'bank' ? amt : 0,
        cashOut: settleMethod === 'cash' ? -amt : 0,
        profit: 0,
        customerName: settleCustomer.customerName,
        type: 'Jama', // Treats as Udhar settlement / deposit entry
        commissionMode: 'Jama'
      });

      if (result.success) {
        setSuccessMsg(`Received ${formatINR(amt)} payment from ${settleCustomer.customerName}! Udhar settled.`);
        setSettleCustomer(null);
        setSettleAmount('');
      } else {
        setErrorMsg(result.error || 'Failed to settle Udhar.');
      }
    } catch (err) {
      setErrorMsg('Error settling Udhar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeDay?.cashDenominations) {
      setCashNotes({
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
  }, [activeDay]);

  const calculateCashNotesTotal = (notes) => {
    return (
      (Number(notes.n500) || 0) * 500 +
      (Number(notes.n200) || 0) * 200 +
      (Number(notes.n100) || 0) * 100 +
      (Number(notes.n50) || 0) * 50 +
      (Number(notes.n20) || 0) * 20 +
      (Number(notes.n10) || 0) * 10 +
      (Number(notes.c20) || 0) * 20 +
      (Number(notes.c10) || 0) * 10 +
      (Number(notes.c5) || 0) * 5 +
      (Number(notes.c2) || 0) * 2 +
      (Number(notes.c1) || 0) * 1 +
      (Number(notes.coins) || 0)
    );
  };

  const handleCashNoteChange = (field, val) => {
    const num = Math.max(0, parseInt(val.replace(/[^0-9]/g, ''), 10) || 0);
    setCashNotes(prev => ({ ...prev, [field]: num }));
  };

  const handleCashNoteAdjust = (field, delta) => {
    setCashNotes(prev => ({ ...prev, [field]: Math.max(0, (Number(prev[field]) || 0) + delta) }));
  };

  const handleSaveDenoms = async (totalCash, denomsPayload) => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      if (onAdjustCash) {
        const res = await onAdjustCash(totalCash, denomsPayload);
        if (res && res.success) {
          setSuccessMsg(`Physical Cash updated to ${formatINR(totalCash)}! Denominations applied.`);
          setCashNotes({ ...denomsPayload });
        } else {
          setErrorMsg(res?.error || 'Failed to adjust physical cash.');
        }
      }
    } catch (e) {
      setErrorMsg('Error saving physical cash.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLiveBankAccountsList = () => {
    return accounts.map(a => ({
      id: a._id,
      name: a.bankName,
      balance: Number(editableBalances[a._id] !== undefined ? editableBalances[a._id] : a.currentBalance) || 0
    }));
  };

  const handleOpenCurrentReceipt = () => {
    setReceiptParams({
      dateStr: activeDay?.date || new Date().toISOString().split('T')[0],
      totalCash: activeDay ? activeDay.closingCash : calculateCashNotesTotal(cashNotes),
      denominations: denoms,
      onlineAmount: liveTotalBankMoney,
      accountName: 'SBI Kiosk Cash Calculation',
      bankAccounts: getLiveBankAccountsList()
    });
    setShowReceiptModal(true);
  };

  const handleCloseLedgerFromPassbook = () => {
    if (!window.confirm('Are you sure you want to CLOSE the ledger session for today?')) return;
    setCloseDenoms({
      n500: Number(denoms.n500) || 0,
      n200: Number(denoms.n200) || 0,
      n100: Number(denoms.n100) || 0,
      n50: Number(denoms.n50) || 0,
      n20: Number(denoms.n20) || 0,
      n10: Number(denoms.n10) || 0,
      coins: Number(denoms.coins) || 0,
      c20: Number(denoms.c20) || 0,
      c10: Number(denoms.c10) || 0,
      c5: Number(denoms.c5) || 0,
      c2: Number(denoms.c2) || 0,
      c1: Number(denoms.c1) || 0
    });
    setShowCloseDenomModal(true);
  };

  const executeCloseFromPassbook = async (totalCash, closingDenomsPayload) => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    if (onAdjustCash) {
      await onAdjustCash(totalCash, closingDenomsPayload);
    }
    if (onCloseDay) {
      const res = await onCloseDay(totalCash, closingDenomsPayload);
      if (res && res.success) {
        setSuccessMsg('Business Day Ledger closed successfully! Cash Statement Receipt generated.');
        setReceiptParams({
          dateStr: activeDay?.date || new Date().toISOString().split('T')[0],
          totalCash: totalCash,
          denominations: closingDenomsPayload,
          onlineAmount: liveTotalBankMoney,
          accountName: 'SBI Kiosk Cash Calculation',
          bankAccounts: getLiveBankAccountsList()
        });
        setShowReceiptModal(true);
      } else {
        setErrorMsg(res?.error || 'Failed to close ledger.');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 select-none">
      {/* Sub tabs header with dedicated Cash & Receipt shortcuts */}
      <div className="bg-slate-200/70 p-1 rounded-xl border border-slate-200 flex gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => { setActiveSubTab('passbook'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`px-3 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shrink-0 transition-all ${
            activeSubTab === 'passbook'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Passbook & EOD
        </button>
        <button
          onClick={() => { setActiveSubTab('cash_counter'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`px-3 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shrink-0 transition-all ${
            activeSubTab === 'cash_counter'
              ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
              : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" /> 💵 Cash Counter
        </button>
        <button
          onClick={() => { 
            setActiveSubTab('receipt'); 
            setErrorMsg(''); 
            setSuccessMsg('');
            setReceiptParams({
              dateStr: activeDay?.date || new Date().toISOString().split('T')[0],
              totalCash: activeDay ? activeDay.closingCash : calculateCashNotesTotal(cashNotes),
              denominations: activeDay?.cashDenominations || cashNotes,
              onlineAmount: liveTotalBankMoney,
              accountName: 'SBI Kiosk Cash Calculation',
              bankAccounts: getLiveBankAccountsList()
            });
          }}
          className={`px-3 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shrink-0 transition-all ${
            activeSubTab === 'receipt'
              ? 'bg-blue-700 text-white font-black shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> 📄 Statement Receipt
        </button>
        <button
          onClick={() => { setActiveSubTab('udhar_jama'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`px-3 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shrink-0 transition-all ${
            activeSubTab === 'udhar_jama'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" /> Udhar & Jama
        </button>
        <button
          onClick={() => { setActiveSubTab('accounts'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`px-3 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shrink-0 transition-all ${
            activeSubTab === 'accounts'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" /> Accounts
        </button>
        <button
          onClick={() => { setActiveSubTab('reports'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`px-3 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 shrink-0 transition-all ${
            activeSubTab === 'reports'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> EOD History
        </button>
      </div>

      {activeSubTab === 'passbook' && (
        <div className="flex flex-col gap-4">
          {!activeDay && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex flex-col gap-2 text-left shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span className="font-extrabold text-xs uppercase tracking-wide">Daily Ledger is Currently Closed</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const total = calculateCashNotesTotal(cashNotes);
                    handleSaveDenoms(total, cashNotes);
                  }}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1 shadow-xs transition-all"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Open Session
                </button>
              </div>
              <p className="text-[10px] text-amber-700/80">
                Opening cash will be set from your notes. You can also count cash in the <button type="button" onClick={() => setActiveSubTab('cash_counter')} className="text-amber-900 font-bold underline">Cash Counter</button> tab.
              </p>
            </div>
          )}
          
          {/* All Details At One Place Summary Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3.5 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-xl border border-blue-200 text-blue-600">
                  <Calculator className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">Passbook & EOD Master Summary</h3>
                  <p className="text-[10px] text-slate-500">All Cash, Bank Balances & Details at One Place</p>
                </div>
              </div>
              {activeDay && (
                <span className="text-[9px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full">
                  SESSION OPEN
                </span>
              )}
            </div>

            {/* Physical Cash Breakdown Section */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col gap-2.5 text-left shadow-2xs">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider flex items-center gap-1">
                  <IndianRupee className="w-3 h-3 text-amber-600" /> Cash In Hand: {formatINR(activeDay ? activeDay.closingCash : 0)}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">Opening: {formatINR(activeDay ? activeDay.openingCash : 0)}</span>
              </div>

              {/* Denomination Notes Grid (Clickable) */}
              <div 
                onClick={() => setShowDenomModal(true)}
                className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1 cursor-pointer hover:opacity-90 transition-all"
                title="Click to edit notes and coins"
              >
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                  <span className="text-[8px] text-slate-400 font-bold block">₹500</span>
                  <span className="text-xs font-black text-emerald-600">{denoms.n500 || 0}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                  <span className="text-[8px] text-slate-400 font-bold block">₹200</span>
                  <span className="text-xs font-black text-amber-600">{denoms.n200 || 0}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                  <span className="text-[8px] text-slate-400 font-bold block">₹100</span>
                  <span className="text-xs font-black text-blue-600">{denoms.n100 || 0}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                  <span className="text-[8px] text-slate-400 font-bold block">₹50</span>
                  <span className="text-xs font-black text-indigo-600">{denoms.n50 || 0}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                  <span className="text-[8px] text-slate-400 font-bold block">₹20</span>
                  <span className="text-xs font-black text-orange-600">{denoms.n20 || 0}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center shadow-2xs">
                  <span className="text-[8px] text-slate-400 font-bold block">₹10</span>
                  <span className="text-xs font-black text-purple-600">{denoms.n10 || 0}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-slate-200 text-center col-span-2 sm:col-span-1 shadow-2xs">
                  <span className="text-[8px] text-slate-400 font-bold block">Coins</span>
                  <div className="flex flex-col text-[8px] mt-0.5 font-bold">
                    {denoms.c20 > 0 && <span className="text-amber-700">₹20×{denoms.c20}</span>}
                    {denoms.c10 > 0 && <span className="text-amber-700">₹10×{denoms.c10}</span>}
                    {denoms.c5 > 0 && <span className="text-amber-700">₹5×{denoms.c5}</span>}
                    {denoms.c2 > 0 && <span className="text-amber-700">₹2×{denoms.c2}</span>}
                    {denoms.c1 > 0 && <span className="text-amber-700">₹1×{denoms.c1}</span>}
                    {denoms.coins > 0 && <span className="text-amber-700">₹{denoms.coins}</span>}
                    {(!denoms.c20 && !denoms.c10 && !denoms.c5 && !denoms.c2 && !denoms.c1 && !denoms.coins) && <span className="text-slate-400">0</span>}
                  </div>
                </div>
              </div>

              {/* Action Buttons for Physical Cash Addition in Passbook */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDenomModal(true)}
                  className="flex-1 min-w-[130px] h-9 px-3 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-800 border border-amber-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-600" /> Add / Count Notes
                </button>

                <button
                  type="button"
                  onClick={handleOpenCurrentReceipt}
                  className="flex-1 min-w-[130px] h-9 px-3 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 border border-blue-200 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> Statement Receipt
                </button>

                {activeDay && (
                  <button
                    type="button"
                    onClick={handleCloseLedgerFromPassbook}
                    className="h-9 px-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> Close Ledger
                  </button>
                )}
              </div>
            </div>

            {/* Bank Accounts Remaining Balances Section */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col gap-2 text-left shadow-2xs">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-blue-800 tracking-wider flex items-center gap-1">
                  <Landmark className="w-3 h-3 text-blue-600" /> Bank Accounts Remaining Balance
                </span>
                <span className="text-[10px] font-black text-blue-900">Total: {formatINR(liveTotalBankMoney)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {accounts.map(acc => (
                  <div key={acc._id} className="bg-white p-2 rounded-lg border border-slate-200 flex justify-between items-center text-[10px] shadow-2xs">
                    <span className="font-bold text-slate-700 truncate max-w-[80px]">{acc.bankName}</span>
                    <span className="font-black text-blue-700">{formatINR(acc.currentBalance)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Udhar & Jama Ledger Summary */}
            <div className="grid grid-cols-2 gap-2 text-left">
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex flex-col gap-0.5 shadow-2xs">
                <span className="text-[9px] font-bold uppercase text-rose-700">Total Udhar Owed</span>
                <span className="text-sm font-black text-rose-700">{formatINR(totalOutstandingUdhar)}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex flex-col gap-0.5 shadow-2xs">
                <span className="text-[9px] font-bold uppercase text-emerald-700">Total Jama Advance</span>
                <span className="text-sm font-black text-emerald-700">{formatINR(totalCustomerJama)}</span>
              </div>
            </div>
          </div>

          {/* Search bar & Type Filter */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Bank or Customer Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-4 text-xs bg-white border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none placeholder:text-slate-400 text-slate-900 font-semibold shadow-xs"
              />
            </div>

            {/* Filter pills */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: 'All Entries' },
                { id: 'credit', label: 'Withdrawals' },
                { id: 'debit', label: 'Deposits' },
                { id: 'udhar', label: 'UDHAR (Credit)' },
                { id: 'jama', label: 'JAMA (Advance)' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold shrink-0 transition-all shadow-2xs ${
                    filterType === f.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Passbook Transactions List */}
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto no-scrollbar pb-10">
            {filteredTransactions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs font-bold shadow-xs">
                No matching transactions found in passbook.
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const bankNameStr = tx.bankAccountId?.bankName || 'Local Bank';
                const dateObj = new Date(tx.timestamp);
                const isToday = new Date().toDateString() === dateObj.toDateString();
                const isUdhar = tx.commissionMode === 'Udhar';
                const isJama = tx.type === 'Jama' || tx.commissionMode === 'Jama';

                return (
                  <div key={tx._id} className={`bg-white border ${isUdhar ? 'border-rose-200' : isJama ? 'border-emerald-200' : 'border-slate-200'} rounded-xl p-3.5 flex justify-between items-center transition-all shadow-xs`}>
                    <div className="flex flex-col gap-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-slate-800">{bankNameStr}</span>
                        {isUdhar && <span className="text-[8px] bg-rose-50 text-rose-700 font-extrabold px-1.5 py-0.5 rounded border border-rose-200">UDHAR</span>}
                        {isJama && <span className="text-[8px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded border border-emerald-200">JAMA</span>}
                      </div>

                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {isToday
                          ? `Today, ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        }
                      </span>
                      
                      {/* Customer Name Inline Editor */}
                      {editingTxId === tx._id ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="text"
                            className="h-6 px-1.5 text-[9px] bg-white border border-slate-300 rounded text-slate-900 focus:border-blue-600 focus:outline-none font-bold placeholder:text-slate-400 w-28 shadow-2xs"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            placeholder="Customer Name"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveName(tx._id)}
                            className="h-6 w-6 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center rounded text-[9px] font-bold shadow-2xs"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTxId(null)}
                            className="h-6 w-6 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 flex items-center justify-center rounded text-[9px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] leading-none select-none">
                          <span className="text-slate-400">Customer:</span>
                          <span className="text-slate-800 font-extrabold truncate max-w-[120px]">{tx.customerName || 'Walk-in'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTxId(tx._id);
                              setTempName(tx.customerName || '');
                            }}
                            className="text-blue-600 hover:text-blue-800 p-0.5"
                          >
                            <Edit3 className="w-2.5 h-2.5 inline" />
                          </button>
                        </div>
                      )}

                      {/* Account & Physical Cash Movement Track */}
                      <div className="flex flex-wrap items-center gap-1 mt-1 text-[8.5px] font-bold">
                        <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-0.5">
                          <Landmark className="w-2.5 h-2.5 text-blue-600" />
                          {bankNameStr}: {tx.customerAmount >= 0 ? `+${formatINR(tx.customerAmount)}` : `-${formatINR(Math.abs(tx.customerAmount))}`}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                          tx.cashOut > 0 ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        }`}>
                          <Coins className="w-2.5 h-2.5 text-amber-600" />
                          {tx.cashOut > 0 ? `Drawer Cash Out: -${formatINR(tx.cashOut)}` : `Drawer Cash In: +${formatINR(Math.abs(tx.cashOut))}`}
                        </span>
                      </div>

                      {/* Physical Notes Breakdown Badge */}
                      {tx.noteDetails && (
                        <div className="mt-1">
                          {tx.noteDetails.includes('Skipped') ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              ⏳ Notes: Skipped (Count at EOD / Close Ledger)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              💵 Notes: {tx.noteDetails}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right flex flex-col gap-1 shrink-0 ml-2">
                      <span className={`text-xs font-black ${isUdhar ? 'text-rose-600' : isJama ? 'text-emerald-600' : (tx.customerAmount >= 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                        {isUdhar ? `₹${Math.abs(tx.cashOut || tx.customerAmount)} UDHAR` : isJama ? `+${formatINR(Math.abs(tx.customerAmount || tx.cashOut))} JAMA` : (tx.customerAmount >= 0 ? '+' : '') + formatINR(tx.customerAmount)}
                      </span>
                      <div className="text-[9px] text-slate-500 flex flex-col items-end gap-0.5">
                        <span className="bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-200 font-semibold text-[8px]">
                          +{formatINR(tx.profit)} ({tx.commissionMode || 'Deducted'})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* CASH NOTE COUNTER DEDICATED SUB-TAB */}
      {activeSubTab === 'cash_counter' && (
        <div className="flex flex-col gap-4 text-left">
          {/* Header Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-xl border border-blue-200 text-blue-600 shadow-2xs">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    SBI Kiosk Cash Note & Coin Counter
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Count physical cash, add/edit notes, and sync drawer with passbook
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                activeDay
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {activeDay ? 'Session Open' : 'Session Closed'}
              </span>
            </div>

            {!activeDay && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between mt-1 shadow-2xs">
                <div className="flex items-center gap-2 text-xs text-amber-800 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Ledger not open yet. Saving notes will automatically open today's session!</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveDenoms(calculateCashNotesTotal(cashNotes), cashNotes)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-lg shrink-0 transition-all shadow-xs"
                >
                  Open Ledger
                </button>
              </div>
            )}
          </div>

          {/* Paper Notes List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
              <span>Paper Notes</span>
              <span className="text-blue-700 font-extrabold">
                Total Notes: {(cashNotes.n500 || 0) + (cashNotes.n200 || 0) + (cashNotes.n100 || 0) + (cashNotes.n50 || 0) + (cashNotes.n20 || 0) + (cashNotes.n10 || 0)} pcs
              </span>
            </div>

            {[
              { key: 'n500', label: '₹500', value: 500, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { key: 'n200', label: '₹200', value: 200, color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { key: 'n100', label: '₹100', value: 100, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { key: 'n50',  label: '₹50',  value: 50,  color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              { key: 'n20',  label: '₹20',  value: 20,  color: 'bg-orange-50 text-orange-700 border-orange-200' },
              { key: 'n10',  label: '₹10',  value: 10,  color: 'bg-purple-50 text-purple-700 border-purple-200' },
            ].map(note => {
              const count = cashNotes[note.key] || 0;
              const subtotal = count * note.value;
              return (
                <div key={note.key} className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="w-20">
                    <span className={`text-xs font-black px-2 py-1 rounded-lg border ${note.color} w-full text-center block shadow-2xs`}>
                      {note.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-1 justify-center">
                    <button
                      type="button"
                      onClick={() => handleCashNoteAdjust(note.key, -1)}
                      className="w-8 h-8 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs active:scale-95 text-slate-700 rounded-lg flex items-center justify-center font-bold text-sm"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={count === 0 ? '' : count}
                      placeholder="0"
                      onChange={(e) => handleCashNoteChange(note.key, e.target.value)}
                      className="w-20 h-8 px-2 text-center text-sm font-black bg-white border border-slate-300 text-blue-900 rounded-lg focus:border-blue-600 focus:outline-none shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleCashNoteAdjust(note.key, 1)}
                      className="w-8 h-8 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs active:scale-95 text-slate-700 rounded-lg flex items-center justify-center font-bold text-sm"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCashNoteAdjust(note.key, 100)}
                      className="h-8 px-2 bg-blue-50 hover:bg-blue-100 active:scale-95 text-[10px] text-blue-700 rounded-lg font-extrabold border border-blue-200 shadow-2xs"
                      title="Add 1 Bundle (+100 notes)"
                    >
                      +100
                    </button>
                  </div>

                  <div className="w-24 text-right">
                    <span className="text-xs font-black text-slate-800">
                      {formatINR(subtotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Coins List */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
              Coins Breakdown
            </span>

            {[
              { key: 'c20', label: '₹20', value: 20 },
              { key: 'c10', label: '₹10', value: 10 },
              { key: 'c5',  label: '₹5',  value: 5 },
              { key: 'c2',  label: '₹2',  value: 2 },
              { key: 'c1',  label: '₹1',  value: 1 },
            ].map(coin => {
              const count = cashNotes[coin.key] || 0;
              const subtotal = count * coin.value;
              return (
                <div key={coin.key} className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="w-20">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 flex items-center justify-center gap-1 w-full shadow-2xs">
                      <Coins className="w-3 h-3 text-amber-600" /> {coin.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-1 justify-center">
                    <button
                      type="button"
                      onClick={() => handleCashNoteAdjust(coin.key, -1)}
                      className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs text-slate-700 rounded flex items-center justify-center font-bold text-xs"
                    >
                      -
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={count === 0 ? '' : count}
                      placeholder="0"
                      onChange={(e) => handleCashNoteChange(coin.key, e.target.value)}
                      className="w-20 h-7 px-1 text-center text-xs font-black bg-white border border-slate-300 text-amber-800 rounded focus:border-blue-600 focus:outline-none shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleCashNoteAdjust(coin.key, 1)}
                      className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs text-slate-700 rounded flex items-center justify-center font-bold text-xs"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-24 text-right">
                    <span className="text-xs font-black text-slate-800">
                      {formatINR(subtotal)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Loose Coins */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1 w-24">
                <Coins className="w-3.5 h-3.5 text-amber-600" /> Loose Coins:
              </span>
              <div className="flex items-center gap-1 flex-1 justify-center">
                <span className="text-xs text-slate-400 font-bold">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={cashNotes.coins === 0 ? '' : cashNotes.coins}
                  placeholder="0"
                  onChange={(e) => handleCashNoteChange('coins', e.target.value)}
                  className="w-28 h-8 px-2 text-center text-xs font-black bg-white border border-slate-300 text-amber-800 rounded-lg focus:border-blue-600 focus:outline-none shadow-xs"
                />
              </div>
              <div className="w-24 text-right">
                <span className="text-xs font-black text-slate-800">
                  {formatINR(cashNotes.coins || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Grand Summary & Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex flex-col gap-1 shadow-2xs">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                  <IndianRupee className="w-4 h-4 text-blue-700" /> Total Cash In Drawer:
                </span>
                <span className="text-2xl font-black text-blue-900">
                  {formatINR(calculateCashNotesTotal(cashNotes))}
                </span>
              </div>
              <div className="text-[11px] text-blue-800/80 font-medium italic">
                {numberToIndianWords(calculateCashNotesTotal(cashNotes))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCashNotes({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0, c20: 0, c10: 0, c5: 0, c2: 0, c1: 0 })}
                className="px-3 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs active:scale-95 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </button>

              <button
                type="button"
                onClick={() => {
                  const total = calculateCashNotesTotal(cashNotes);
                  setReceiptParams({
                    dateStr: activeDay?.date || new Date().toISOString().split('T')[0],
                    totalCash: total,
                    denominations: cashNotes,
                    onlineAmount: liveTotalBankMoney,
                    accountName: 'SBI Kiosk Cash Calculation',
                    bankAccounts: getLiveBankAccountsList()
                  });
                  setShowReceiptModal(true);
                }}
                className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" /> Receipt
              </button>

              <button
                type="button"
                onClick={() => handleSaveDenoms(calculateCashNotesTotal(cashNotes), cashNotes)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <Check className="w-4 h-4" /> Save Cash to Passbook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATEMENT RECEIPT DEDICATED SUB-TAB */}
      {activeSubTab === 'receipt' && (
        <div className="flex flex-col gap-4 items-center">
          <CashStatementReceipt
            isOpen={true}
            onClose={() => setActiveSubTab('passbook')}
            dateStr={activeDay?.date || new Date().toISOString().split('T')[0]}
            accountName="SBI Kiosk Cash Calculation"
            denominations={activeDay?.cashDenominations || cashNotes}
            totalCash={activeDay ? activeDay.closingCash : calculateCashNotesTotal(cashNotes)}
            onlineAmount={liveTotalBankMoney}
            bankAccounts={getLiveBankAccountsList()}
            kioskTitle="SBI Kiosk"
          />
        </div>
      )}

      {/* UDHAR & JAMA Customer Ledger Sub-Tab */}
      {activeSubTab === 'udhar_jama' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-left">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Customer Udhar & Jama Ledger</h3>
            <p className="text-[10px] text-slate-500">Track pending customer dues (Udhar) and advance deposits (Jama)</p>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex flex-col gap-1 text-left shadow-xs">
              <span className="text-[10px] font-bold uppercase text-rose-700">Pending Udhar Owed</span>
              <span className="text-xl font-black text-rose-700">{formatINR(totalOutstandingUdhar)}</span>
              <span className="text-[9px] text-slate-500">Unpaid service dues</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex flex-col gap-1 text-left shadow-xs">
              <span className="text-[10px] font-bold uppercase text-emerald-700">Customer Jama Advances</span>
              <span className="text-xl font-black text-emerald-700">{formatINR(totalCustomerJama)}</span>
              <span className="text-[9px] text-slate-500">Advance deposits</span>
            </div>
          </div>

          {/* Customer Ledger List */}
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto no-scrollbar pb-10">
            {customerLedgers.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs font-bold shadow-xs">
                No customer Udhar or Jama records created yet.
              </div>
            ) : (
              customerLedgers.map((cust) => {
                const isDue = cust.netBalance < 0;
                const isAdvance = cust.netBalance > 0;

                return (
                  <div key={cust.customerName} className={`bg-white border ${isDue ? 'border-rose-200' : isAdvance ? 'border-emerald-200' : 'border-slate-200'} rounded-2xl p-4 flex justify-between items-center transition-all text-left shadow-xs`}>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-black text-slate-800">{cust.customerName}</span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>Udhar: <span className="text-rose-600 font-bold">{formatINR(cust.totalUdhar)}</span></span>
                        <span>•</span>
                        <span>Jama: <span className="text-emerald-600 font-bold">{formatINR(cust.totalJama)}</span></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right flex flex-col items-end">
                        <span className={`text-xs font-black ${isDue ? 'text-rose-600' : isAdvance ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {isDue ? `₹${Math.abs(cust.netBalance)} UDHAR` : isAdvance ? `+${formatINR(cust.netBalance)} JAMA` : 'Settled (₹0)'}
                        </span>
                        <span className="text-[9px] text-slate-400">{cust.txCount} transactions</span>
                      </div>

                      {isDue && (
                        <button
                          type="button"
                          onClick={() => {
                            setSettleCustomer(cust);
                            setSettleAmount(String(Math.abs(cust.netBalance)));
                            setErrorMsg('');
                          }}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-bold transition-all shadow-xs"
                        >
                          Settle Dues
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Settle Udhar Modal */}
      {settleCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 select-none">
          <form onSubmit={handleSettleSubmit} className="bg-white border border-slate-200 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-4 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Settle Customer Udhar</h3>
                <p className="text-[10px] text-slate-500">Customer paying pending credit: <span className="font-bold text-slate-800">{settleCustomer.customerName}</span></p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Settlement Payment Amount (₹)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full h-12 bg-white border border-slate-300 text-emerald-600 font-black text-xl text-center rounded-xl px-3 focus:border-emerald-600 focus:outline-none shadow-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Received Via
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettleMethod('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                    settleMethod === 'cash'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Cash In Hand
                </button>
                <button
                  type="button"
                  onClick={() => setSettleMethod('bank')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                    settleMethod === 'bank'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Bank Transfer
                </button>
              </div>
            </div>

            {settleMethod === 'bank' && accounts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  Target Bank Account
                </label>
                <select
                  value={settleBankId}
                  onChange={(e) => setSettleBankId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none shadow-xs"
                >
                  {accounts.map(a => (
                    <option key={a._id} value={a._id}>{a.bankName} ({formatINR(a.currentBalance)})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSettleCustomer(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md"
              >
                Confirm Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ACCOUNTS SUB-TAB */}
      {activeSubTab === 'accounts' && (
        <div className="flex flex-col gap-4">
          <form onSubmit={handleAddAccount} className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col gap-3 text-left shadow-sm">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-blue-600" /> Register Bank Account
            </h3>
            
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                placeholder="Bank Name (e.g. SBI, ICICI, HDFC)"
                value={bankName}
                onChange={(e) => { setBankName(e.target.value); setErrorMsg(''); setSuccessMsg(''); }}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none placeholder:text-slate-400 text-slate-900 font-semibold shadow-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Opening Bank Balance (Rs)"
                value={initialBalance}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setInitialBalance(val);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="w-full h-10 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none placeholder:text-slate-400 text-slate-900 font-semibold shadow-xs"
              />
            </div>

            {errorMsg && (
              <p className="text-[10px] text-red-600 font-semibold">{errorMsg}</p>
            )}
            {successMsg && (
              <p className="text-[10px] text-emerald-700 font-semibold">{successMsg}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl bg-blue-600 text-white font-bold text-xs shadow hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Add Account'
              )}
            </button>
          </form>

          <div className="flex flex-col gap-3 text-left">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Registered Accounts ({accounts.length})
              </h3>
              <div className="text-xs font-extrabold text-slate-700">
                Live Total: <span className="text-blue-700 font-black">{formatINR(liveTotalBankMoney)}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2.5 max-h-[35vh] overflow-y-auto no-scrollbar pb-2">
              {accounts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs font-bold shadow-xs">
                  No bank accounts registered yet.
                </div>
              ) : (
                accounts.map((acc) => (
                  <div key={acc._id} className="bg-white border border-slate-200 p-3 rounded-xl flex justify-between items-center shadow-xs">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 shrink-0 shadow-2xs">
                        <Landmark className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate">{acc.bankName}</span>
                        <span className="text-[9px] text-slate-400">Edit balance manually</span>
                      </div>
                    </div>
                    
                    <div className="relative shrink-0 w-28">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editableBalances[acc._id] !== undefined ? editableBalances[acc._id] : ''}
                        onChange={(e) => handleBalanceChange(acc._id, e.target.value)}
                        className="w-full h-8 px-2 text-right text-xs font-black bg-white border border-slate-300 focus:border-blue-600 text-slate-900 rounded focus:outline-none placeholder:text-slate-400 shadow-2xs"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {accounts.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAllBalances}
                disabled={isSubmitting}
                className="w-full h-10 rounded-xl bg-blue-600 text-white font-bold text-xs shadow hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Save All Bank Balances'
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* DAILY REPORTS SUB-TAB */}
      {activeSubTab === 'reports' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-left">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Daily EOD Reports</h3>
            <p className="text-[10px] text-slate-500">Chronological snapshot feed of closed daily sessions, cash handbooks, and bank EOD balances.</p>
          </div>

          {(() => {
            const displayDayHistory = (() => {
              const list = [...(dayHistory || [])];
              if (activeDay && activeDay.status === 'Open') {
                if (!list.some(d => d.date === activeDay.date)) {
                  list.unshift(activeDay);
                }
              }
              return list;
            })();

            if (displayDayHistory.length === 0) {
              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400 font-bold shadow-xs">
                  No daily summaries history available yet.
                </div>
              );
            }

              return (
                <div className="flex flex-col gap-4">
                  {displayDayHistory.map((day) => {
                    const isClosed = day.status === 'Closed';
                    const isTodayActive = activeDay && activeDay.date === day.date && activeDay.status === 'Open';
                    const dayTxs = (transactions || []).filter(t => (t.timestamp || '').split('T')[0] === day.date);

                    const closingBankBalances = day.closingBankBalances || day.bankBalances || {};
                    const openingBankBalances = day.openingBankBalances || {};

                    // Calculate net transactions by bank
                    const netTxByBank = {};
                    const bankInflow = {};
                    const bankOutflow = {};
                    let dayCashIn = 0;
                    let dayCashOut = 0;
                    let dayOnlineIn = 0;
                    let dayOnlineOut = 0;
                    let dayTxProfitSum = 0;

                    dayTxs.forEach(tx => {
                      const bName = tx.bankAccountId?.bankName || 'Bank';
                      const cAmt = Number(tx.customerAmount) || 0;
                      const cOut = Number(tx.cashOut) || 0;
                      netTxByBank[bName] = (netTxByBank[bName] || 0) + cAmt;
                      if (cAmt > 0) {
                        bankInflow[bName] = (bankInflow[bName] || 0) + cAmt;
                        dayOnlineIn += cAmt;
                      } else if (cAmt < 0) {
                        bankOutflow[bName] = (bankOutflow[bName] || 0) + Math.abs(cAmt);
                        dayOnlineOut += Math.abs(cAmt);
                      }
                      if (cOut < 0) dayCashIn += Math.abs(cOut);
                      else if (cOut > 0) dayCashOut += cOut;
                      dayTxProfitSum += (Number(tx.profit) || 0);
                    });

                    const allDayBanks = Array.from(new Set([
                      ...Object.keys(closingBankBalances),
                      ...Object.keys(openingBankBalances),
                      ...accounts.map(a => a.bankName),
                      ...Object.keys(netTxByBank)
                    ])).filter(Boolean);

                    const bankModes = allDayBanks.map(bName => {
                      const closeBal = closingBankBalances[bName] !== undefined
                        ? Number(closingBankBalances[bName])
                        : (accounts.find(a => a.bankName === bName)?.currentBalance || 0);
                      const openBal = openingBankBalances[bName] !== undefined
                        ? Number(openingBankBalances[bName])
                        : Math.max(0, closeBal - (netTxByBank[bName] || 0));
                      return {
                        name: bName,
                        openBal,
                        inflow: bankInflow[bName] || 0,
                        outflow: bankOutflow[bName] || 0,
                        closeBal,
                        netDiff: closeBal - openBal
                      };
                    });

                    const openCash = Number(day.openingCash) || 0;
                    const closeCash = Number(day.closingCash) || 0;
                    const cashNetDiff = closeCash - openCash;

                    const totalOpenOnline = bankModes.reduce((s, b) => s + b.openBal, 0);
                    const totalCloseOnline = bankModes.reduce((s, b) => s + b.closeBal, 0);

                    const grandOpenTotal = openCash + totalOpenOnline;
                    const grandCloseTotal = closeCash + totalCloseOnline;
                    const grandNetDiff = grandCloseTotal - grandOpenTotal;

                    // Open / Close events & counts
                    const rawEvents = Array.isArray(day.openCloseEvents) && day.openCloseEvents.length > 0
                      ? day.openCloseEvents
                      : [
                          {
                            id: 'evt_open_def',
                            type: 'OPEN',
                            timestamp: day.openedAt || `${day.date}T09:00:00.000Z`,
                            cash: openCash,
                            bankBalances: openingBankBalances,
                            note: 'Initial Open'
                          },
                          ...(isClosed ? [{
                            id: 'evt_close_def',
                            type: 'CLOSE',
                            timestamp: day.closedAt || `${day.date}T21:00:00.000Z`,
                            cash: closeCash,
                            bankBalances: closingBankBalances,
                            note: 'Ledger Closed'
                          }] : [])
                        ];

                    const openCount = Number(day.openCount) || rawEvents.filter(e => e.type === 'OPEN' || e.type === 'REOPEN').length || 1;
                    const closeCount = Number(day.closeCount) || rawEvents.filter(e => e.type === 'CLOSE').length || (isClosed ? 1 : 0);
                    const dayFinalProfit = Number(day.totalProfit !== undefined ? day.totalProfit : dayTxProfitSum);

                    // Formatted summary text for WhatsApp/Clipboard
                    const generateDaySummaryText = () => {
                      let t = `🏛️ *SBI KIOSK STATEMENT - ${day.date}*\n`;
                      t += `Status: ${day.status} | Sessions: Open ${openCount}x, Close ${closeCount}x\n`;
                      t += `------------------------------------\n`;
                      t += `💰 *OPENING BALANCES (ALL MODES):*\n`;
                      t += `• Drawer Cash: ₹${openCash.toLocaleString('en-IN')}\n`;
                      bankModes.forEach(b => {
                        t += `• ${b.name}: ₹${b.openBal.toLocaleString('en-IN')}\n`;
                      });
                      t += `*Total Opening:* ₹${grandOpenTotal.toLocaleString('en-IN')}\n`;
                      t += `------------------------------------\n`;
                      t += `🏁 *CLOSING BALANCES (ALL MODES):*\n`;
                      t += `• Drawer Cash: ₹${closeCash.toLocaleString('en-IN')}\n`;
                      bankModes.forEach(b => {
                        t += `• ${b.name}: ₹${b.closeBal.toLocaleString('en-IN')}\n`;
                      });
                      t += `*Total Closing:* ₹${grandCloseTotal.toLocaleString('en-IN')} (${grandNetDiff >= 0 ? '+' : ''}₹${grandNetDiff.toLocaleString('en-IN')})\n`;
                      t += `------------------------------------\n`;
                      t += `📈 *DAY FLOW & PROFIT:*\n`;
                      t += `• Transactions: ${dayTxs.length} entries\n`;
                      t += `• Cash Flow: In ₹${dayCashIn.toLocaleString('en-IN')} | Out ₹${dayCashOut.toLocaleString('en-IN')}\n`;
                      t += `• Online Flow: In ₹${dayOnlineIn.toLocaleString('en-IN')} | Out ₹${dayOnlineOut.toLocaleString('en-IN')}\n`;
                      t += `🏆 *TOTAL DAY NET PROFIT:* +₹${dayFinalProfit.toLocaleString('en-IN')}\n`;
                      t += `------------------------------------\n`;
                      return t;
                    };

                    const handleCopyDaySummary = async () => {
                      try {
                        await navigator.clipboard.writeText(generateDaySummaryText());
                        setQuickCopiedDay(day.date);
                        setTimeout(() => setQuickCopiedDay(null), 2000);
                      } catch (e) {}
                    };

                    const handleShareDayWhatsApp = () => {
                      const text = encodeURIComponent(generateDaySummaryText());
                      window.open(`https://wa.me/?text=${text}`, '_blank');
                    };

                    return (
                      <div key={day.date} className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col gap-3 text-left shadow-sm">
                        {/* Day Card Header */}
                        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-900">{day.date}</span>
                                {isTodayActive && (
                                  <span className="text-[8px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full border border-emerald-300 animate-pulse">
                                    LIVE TODAY
                                  </span>
                                )}
                              </div>
                              <span className="text-[8.5px] font-bold text-slate-500">
                                {dayTxs.length} Transactions Logged
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                              isClosed
                                ? 'bg-red-50 border border-red-200 text-red-700'
                                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            }`}>
                              {day.status}
                            </span>

                            {/* Open / Close Cycle Badge */}
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-extrabold bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-blue-600" />
                              Open {openCount}x • Close {closeCount}x
                            </span>
                          </div>
                        </div>

                        {/* Top Action Toolbar for this Day */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStatementDay(day);
                              setShowStatementModal(true);
                            }}
                            className="py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1 transition-all shadow-xs active:scale-95 text-[9.5px]"
                          >
                            <FileText className="w-3 h-3" /> Full Statement
                          </button>

                          <button
                            type="button"
                            onClick={handleShareDayWhatsApp}
                            className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 text-[9.5px]"
                          >
                            <Share2 className="w-3 h-3 text-emerald-600" /> Share WhatsApp
                          </button>

                          <button
                            type="button"
                            onClick={handleCopyDaySummary}
                            className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 text-[9.5px]"
                          >
                            {quickCopiedDay === day.date ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                            {quickCopiedDay === day.date ? 'Copied!' : 'Copy Report'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const onlineTotal = Object.values(day.bankBalances || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                              setReceiptParams({
                                dateStr: day.date,
                                totalCash: day.closingCash,
                                denominations: day.cashDenominations || {},
                                onlineAmount: onlineTotal,
                                accountName: 'SBI Kiosk Cash Calculation',
                                bankAccounts: day.bankBalances || {}
                              });
                              setShowReceiptModal(true);
                            }}
                            className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold flex items-center justify-center gap-1 transition-all shadow-2xs active:scale-95 text-[9.5px]"
                          >
                            <Coins className="w-3 h-3 text-amber-600" /> Cash Slip
                          </button>
                        </div>

                        {/* MODE-WISE OPENING & CLOSING BALANCE SHEET */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex flex-col gap-2 shadow-2xs">
                          <div className="flex justify-between items-center text-[9px] font-extrabold uppercase text-slate-600 pb-1 border-b border-slate-200">
                            <span className="flex items-center gap-1">
                              <Landmark className="w-3 h-3 text-blue-600" />
                              All Modes Opening vs Closing Balances
                            </span>
                            <span className="text-slate-400 font-semibold">Cash + Online</span>
                          </div>

                          {/* Table Grid of All Modes */}
                          <div className="flex flex-col gap-1.5">
                            {/* Drawer Cash Row */}
                            <div className="bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <Coins className="w-3.5 h-3.5 text-amber-600" />
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800">Drawer Physical Cash</span>
                                  <span className="text-[8px] text-slate-400">Opening: {formatINR(openCash)}</span>
                                </div>
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="font-black text-amber-950 text-xs">{formatINR(closeCash)}</span>
                                <span className={`text-[8px] font-bold ${cashNetDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {cashNetDiff >= 0 ? '+' : ''}{formatINR(cashNetDiff)} change
                                </span>
                              </div>
                            </div>

                            {/* Each Bank Account Row */}
                            {bankModes.map(b => (
                              <div key={b.name} className="bg-white border border-slate-200 rounded-xl p-2 flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-700">{b.name} (Online)</span>
                                    <span className="text-[8px] text-slate-400">Opening: {formatINR(b.openBal)}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col text-right">
                                  <span className="font-black text-blue-950 text-xs">{formatINR(b.closeBal)}</span>
                                  <span className={`text-[8px] font-bold ${b.netDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {b.netDiff >= 0 ? '+' : ''}{formatINR(b.netDiff)} change
                                  </span>
                                </div>
                              </div>
                            ))}

                            {/* GRAND TOTAL ROW */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between text-[10px] shadow-2xs">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black uppercase text-blue-700 tracking-wider">Grand Total Liquidity (All Modes)</span>
                                <span className="text-[8.5px] font-semibold text-slate-500">Opening: {formatINR(grandOpenTotal)}</span>
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-xs font-black text-blue-900">{formatINR(grandCloseTotal)}</span>
                                <span className={`text-[8.5px] font-black ${grandNetDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {grandNetDiff >= 0 ? '+' : ''}{formatINR(grandNetDiff)} net growth
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* DATE & TIME WISE OPEN/CLOSE AUDIT TIMELINE (EXPANDABLE) */}
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setExpandedAuditDays(prev => ({ ...prev, [day.date]: !prev[day.date] }))}
                            className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-[10px] font-extrabold text-slate-700 transition-all border-b border-slate-200"
                          >
                            <span className="flex items-center gap-1.5 text-blue-700">
                              <Clock className="w-3.5 h-3.5" />
                              Date & Time Open / Close History ({rawEvents.length} Sessions)
                            </span>
                            <span className="text-[9px] font-bold text-blue-600">
                              {expandedAuditDays[day.date] ? '▲ Hide Timeline' : '▼ View Times & Balances'}
                            </span>
                          </button>

                          {expandedAuditDays[day.date] && (
                            <div className="p-3 flex flex-col gap-2 bg-slate-50/50">
                              {rawEvents.map((ev, evIdx) => {
                                const dObj = new Date(ev.timestamp);
                                const tStr = dObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                const isOp = ev.type === 'OPEN';
                                const isRe = ev.type === 'REOPEN';

                                const evBankTotal = Object.values(ev.bankBalances || {}).reduce((s, v) => s + (Number(v) || 0), 0);
                                const evTotal = (Number(ev.cash) || 0) + evBankTotal;

                                return (
                                  <div key={ev.id || evIdx} className="bg-white border border-slate-200 rounded-xl p-2 flex flex-col gap-1 text-[9.5px]">
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${
                                          isOp ? 'bg-emerald-100 text-emerald-800' : isRe ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                        }`}>
                                          {isOp ? '🟢 OPEN' : isRe ? '🟡 REOPEN' : '🔴 CLOSE'}
                                        </span>
                                        <span className="font-bold text-slate-700">{tStr}</span>
                                      </div>
                                      <span className="text-[8px] text-slate-400 italic">{ev.note || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] pt-1 border-t border-slate-100 text-slate-600">
                                      <span>Drawer Cash: <b>{formatINR(ev.cash)}</b></span>
                                      <span>Online: <b>{formatINR(evBankTotal)}</b></span>
                                      <span className="font-black text-slate-900">Total: {formatINR(evTotal)}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Denomination Notes Breakdown if present */}
                        {day.cashDenominations && (
                          <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex flex-col gap-1 text-[10px] shadow-2xs">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 pb-1">Notes Denomination Snapshot</span>
                            <div className="flex flex-wrap gap-1.5 mt-1 font-bold text-slate-800">
                              {day.cashDenominations.n500 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-emerald-700">500×{day.cashDenominations.n500}</span>}
                              {day.cashDenominations.n200 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-amber-700">200×{day.cashDenominations.n200}</span>}
                              {day.cashDenominations.n100 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-blue-700">100×{day.cashDenominations.n100}</span>}
                              {day.cashDenominations.n50 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-indigo-700">50×{day.cashDenominations.n50}</span>}
                              {day.cashDenominations.n20 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-orange-700">20×{day.cashDenominations.n20}</span>}
                              {day.cashDenominations.n10 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-purple-700">10×{day.cashDenominations.n10}</span>}
                              {day.cashDenominations.c20 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-amber-700">c20×{day.cashDenominations.c20}</span>}
                              {day.cashDenominations.c10 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-amber-700">c10×{day.cashDenominations.c10}</span>}
                              {day.cashDenominations.c5 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-amber-700">c5×{day.cashDenominations.c5}</span>}
                              {day.cashDenominations.c2 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-amber-700">c2×{day.cashDenominations.c2}</span>}
                              {day.cashDenominations.c1 > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-amber-700">c1×{day.cashDenominations.c1}</span>}
                              {day.cashDenominations.coins > 0 && <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-amber-700">Coins: ₹{day.cashDenominations.coins}</span>}
                            </div>
                          </div>
                        )}

                    {/* Expandable All Transactions (Date & Time Wise) */}
                    <button
                      type="button"
                      onClick={() => setExpandedDays(prev => ({ ...prev, [day.date]: prev[day.date] === false ? true : false }))}
                      className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 active:scale-[0.99] text-slate-700 rounded-xl text-[10px] font-extrabold flex items-center justify-between transition-all border border-slate-200 shadow-2xs"
                    >
                      <span className="flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                        Transactions on {day.date} ({dayTxs.length} entries)
                      </span>
                      <span className="text-[10px] text-blue-600 font-bold">
                        {expandedDays[day.date] === false ? '▼ View Full Details' : '▲ Hide Details'}
                      </span>
                    </button>

                    {expandedDays[day.date] !== false && (
                      <div className="flex flex-col gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-200">
                          <span>Complete Time-wise Transaction Records</span>
                          <span>{dayTxs.length} Logged</span>
                        </div>

                        {dayTxs.length === 0 ? (
                          <div className="text-[10px] text-slate-400 italic py-3 text-center">
                            No individual transactions logged on this day.
                          </div>
                        ) : (
                          dayTxs.map((tx, txIdx) => {
                            const dateObj = new Date(tx.timestamp);
                            const tStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const bName = tx.bankAccountId?.bankName || 'Bank Account';
                            const isUdhar = tx.commissionMode === 'Udhar';
                            const isJama = tx.type === 'Jama' || tx.commissionMode === 'Jama';

                            return (
                              <div key={tx._id || txIdx} className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-col gap-2">
                                {/* Header: Sequence, Time, Type, Mode, Single Transaction Profit */}
                                <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      #{txIdx + 1}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                      ⏰ {tStr}
                                    </span>
                                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                                      isUdhar 
                                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                        : isJama 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                          : tx.type === 'Credit' 
                                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    }`}>
                                      {isUdhar ? 'Udhar (Credit)' : isJama ? 'Jama (Advance)' : tx.type === 'Credit' ? 'Withdrawal' : 'Deposit'}
                                    </span>
                                    <span className="text-[8.5px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                      {tx.commissionMode || 'Deducted'}
                                    </span>
                                  </div>

                                  {/* PROFIT IN THIS SINGLE TRANSACTION */}
                                  <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg shadow-2xs">
                                    <span className="text-[8.5px] font-bold text-emerald-600 uppercase">Tx Profit:</span>
                                    <span className="text-xs font-black text-emerald-700">+{formatINR(tx.profit)}</span>
                                  </div>
                                </div>

                                {/* Customer Name */}
                                <div className="flex items-center justify-between text-xs text-slate-700 px-0.5">
                                  <span className="text-slate-400 text-[10px] font-semibold">Customer:</span>
                                  <span className="text-slate-900 font-extrabold">{tx.customerName || 'Walk-in Customer'}</span>
                                </div>

                                {/* Cash and Online Details in Single Transaction */}
                                <div className="grid grid-cols-2 gap-2 text-left">
                                  {/* Online Bank Details */}
                                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2 flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[8.5px] font-bold uppercase text-blue-800 flex items-center gap-1">
                                        <Landmark className="w-3 h-3 text-blue-600" /> {bName}
                                      </span>
                                      <span className="text-[7.5px] font-bold bg-blue-100 text-blue-800 px-1 py-0.2 rounded">
                                        Online
                                      </span>
                                    </div>
                                    <span className={`text-xs font-black ${tx.customerAmount >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                                      {tx.customerAmount >= 0 ? `+${formatINR(tx.customerAmount)}` : `-${formatINR(Math.abs(tx.customerAmount))}`}
                                    </span>
                                    <span className="text-[8px] text-blue-700/80 font-medium">
                                      {tx.customerAmount >= 0 ? 'Customer paid / transferred' : 'Sent online to customer'}
                                    </span>
                                  </div>

                                  {/* Drawer Physical Cash Details */}
                                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2 flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[8.5px] font-bold uppercase text-amber-800 flex items-center gap-1">
                                        <Coins className="w-3 h-3 text-amber-600" /> Drawer Cash
                                      </span>
                                      <span className="text-[7.5px] font-bold bg-amber-100 text-amber-900 px-1 py-0.2 rounded">
                                        Physical
                                      </span>
                                    </div>
                                    <span className={`text-xs font-black ${tx.cashOut > 0 ? 'text-amber-900' : 'text-emerald-700'}`}>
                                      {tx.cashOut > 0 ? `-${formatINR(tx.cashOut)} (Out)` : `+${formatINR(Math.abs(tx.cashOut))} (In)`}
                                    </span>
                                    <span className="text-[8px] text-amber-800/80 font-medium">
                                      {tx.cashOut > 0 ? 'Deducted from drawer' : 'Added to drawer'}
                                    </span>
                                  </div>
                                </div>

                                {/* Physical Notes Used in that transaction */}
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex items-center justify-between text-[10px]">
                                  <span className="text-slate-500 font-bold flex items-center gap-1">
                                    <Calculator className="w-3 h-3 text-slate-400" />
                                    Notes Details:
                                  </span>
                                  {tx.noteDetails && tx.noteDetails.includes('Skipped') ? (
                                    <span className="text-[8.5px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                      ⏳ Notes: Skipped (Counted at EOD)
                                    </span>
                                  ) : tx.noteDetails ? (
                                    <span className="text-[8.5px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                      💵 {tx.noteDetails}
                                    </span>
                                  ) : (
                                    <span className="text-[8.5px] text-slate-400 italic">No notes specified</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* AT THE LAST: Complete Day Profit & Flow Summary Banner */}
                        {(() => {
                          const dayCashIn = dayTxs.reduce((sum, t) => sum + (t.cashOut < 0 ? Math.abs(Number(t.cashOut)) : 0), 0);
                          const dayCashOut = dayTxs.reduce((sum, t) => sum + (t.cashOut > 0 ? Number(t.cashOut) : 0), 0);
                          const dayOnlineIn = dayTxs.reduce((sum, t) => sum + (t.customerAmount > 0 ? Number(t.customerAmount) : 0), 0);
                          const dayOnlineOut = dayTxs.reduce((sum, t) => sum + (t.customerAmount < 0 ? Math.abs(Number(t.customerAmount)) : 0), 0);
                          const dayProfitComputed = dayTxs.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
                          const dayProfitFinal = Number(day.totalProfit !== undefined ? day.totalProfit : dayProfitComputed);

                          return (
                            <div className="mt-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-md flex flex-col gap-2.5">
                              <div className="flex justify-between items-center border-b border-emerald-400/40 pb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1">
                                    🏆 Total Day Net Profit
                                  </span>
                                </div>
                                <span className="text-xl font-black tracking-tight text-white drop-shadow-xs">
                                  +{formatINR(dayProfitFinal)}
                                </span>
                              </div>

                              {/* Cash & Online Flow Summary */}
                              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                                <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
                                  <span className="text-emerald-100 text-[8px] uppercase">Drawer Cash Flow</span>
                                  <span>Cash In: {formatINR(dayCashIn)}</span>
                                  <span>Cash Out: {formatINR(dayCashOut)}</span>
                                </div>

                                <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
                                  <span className="text-emerald-100 text-[8px] uppercase">Online Bank Flow</span>
                                  <span>Online In: {formatINR(dayOnlineIn)}</span>
                                  <span>Online Out: {formatINR(dayOnlineOut)}</span>
                                </div>
                              </div>

                              <div className="flex justify-between items-center text-[10px] border-t border-emerald-400/40 pt-2 text-emerald-100 font-semibold">
                                <span>Opening Cash: {formatINR(day.openingCash)}</span>
                                <span className="text-white font-black">Closing Drawer Cash: {formatINR(day.closingCash)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
        </div>
      )}

      {/* Denomination Note Calculator Modal for Passbook Cash Addition */}
      <DenominationModal
        isOpen={showDenomModal}
        onClose={() => setShowDenomModal(false)}
        initialDenominations={denoms}
        onSave={(totalCash, updatedDenoms) => {
          handleSaveDenoms(totalCash, updatedDenoms);
        }}
        onPreviewReceipt={(totalCash, updatedDenoms) => {
          setReceiptParams({
            dateStr: activeDay?.date || new Date().toISOString().split('T')[0],
            totalCash,
            denominations: updatedDenoms,
            onlineAmount: liveTotalBankMoney,
            accountName: 'SBI Kiosk Cash Calculation',
            bankAccounts: getLiveBankAccountsList()
          });
          setShowReceiptModal(true);
        }}
        title="Passbook Physical Cash & Note Counter"
      />

      {/* Closing Day Physical Cash Denomination Modal for Passbook */}
      <DenominationModal
        isOpen={showCloseDenomModal}
        onClose={() => setShowCloseDenomModal(false)}
        initialDenominations={closeDenoms}
        onSave={(totalCash, closingDenomsPayload) => {
          setCloseDenoms(closingDenomsPayload);
          executeCloseFromPassbook(totalCash, closingDenomsPayload);
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
          bankAccounts={receiptParams.bankAccounts || getLiveBankAccountsList()}
          kioskTitle="SBI Kiosk"
        />
      )}

      {/* Detailed Statement & Audit Report Modal */}
      {selectedStatementDay && (
        <DetailedStatementReportModal
          isOpen={showStatementModal}
          onClose={() => {
            setShowStatementModal(false);
            setSelectedStatementDay(null);
          }}
          day={selectedStatementDay}
          transactions={transactions}
          accounts={accounts}
          kioskTitle="SBI Kiosk Banking Point"
        />
      )}
    </div>
  );
}
