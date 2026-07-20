import React, { useState, useEffect, useMemo } from 'react';
import { Landmark, ClipboardList, PlusCircle, CreditCard, ChevronRight, Search, Calendar, Edit3, UserCheck, Calculator, Coins, IndianRupee, ArrowDownRight, ArrowUpRight, CheckCircle2, UserX } from 'lucide-react';

export default function PassbookAccounts({ 
  accounts, 
  transactions, 
  dayHistory = [], 
  activeDay = null,
  onAddAccount, 
  onBulkUpdateBalances, 
  onUpdateCustomerName,
  onSubmitTransaction
}) {
  const [activeSubTab, setActiveSubTab] = useState('passbook'); // 'passbook' | 'udhar_jama' | 'accounts' | 'reports'
  const [bankName, setBankName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'credit' | 'debit' | 'udhar' | 'jama'

  // Settlement Modal state for Udhar payment
  const [settleCustomer, setSettleCustomer] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('cash'); // 'cash' | 'bank'
  const [settleBankId, setSettleBankId] = useState('');

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

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 select-none">
      {/* Sub tabs header */}
      <div className="bg-slate-900/60 p-1 rounded-xl border border-slate-800 flex gap-1">
        <button
          onClick={() => { setActiveSubTab('passbook'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeSubTab === 'passbook'
              ? 'bg-slate-800 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Passbook & EOD
        </button>
        <button
          onClick={() => { setActiveSubTab('udhar_jama'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeSubTab === 'udhar_jama'
              ? 'bg-slate-800 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" /> Udhar & Jama
        </button>
        <button
          onClick={() => { setActiveSubTab('accounts'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeSubTab === 'accounts'
              ? 'bg-slate-800 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" /> Accounts
        </button>
        <button
          onClick={() => { setActiveSubTab('reports'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeSubTab === 'reports'
              ? 'bg-slate-800 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> EOD History
        </button>
      </div>

      {activeSubTab === 'passbook' && (
        <div className="flex flex-col gap-4">
          
          {/* All Details At One Place Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3.5 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
                  <Calculator className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h3 className="text-xs font-extrabold text-slate-100 uppercase tracking-wide">Passbook & EOD Master Summary</h3>
                  <p className="text-[10px] text-slate-400">All Cash, Bank Balances & Details at One Place</p>
                </div>
              </div>
              {activeDay && (
                <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full">
                  SESSION OPEN
                </span>
              )}
            </div>

            {/* Physical Cash Breakdown Section */}
            <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex flex-col gap-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1">
                  <IndianRupee className="w-3 h-3" /> Cash In Hand: {formatINR(activeDay ? activeDay.closingCash : 0)}
                </span>
                <span className="text-[9px] text-slate-500">Opening: {formatINR(activeDay ? activeDay.openingCash : 0)}</span>
              </div>

              {/* Denomination Notes Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[8px] text-slate-500 font-bold block">₹500</span>
                  <span className="text-xs font-extrabold text-emerald-400">{denoms.n500 || 0}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[8px] text-slate-500 font-bold block">₹200</span>
                  <span className="text-xs font-extrabold text-amber-400">{denoms.n200 || 0}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[8px] text-slate-500 font-bold block">₹100</span>
                  <span className="text-xs font-extrabold text-blue-400">{denoms.n100 || 0}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[8px] text-slate-500 font-bold block">₹50</span>
                  <span className="text-xs font-extrabold text-indigo-400">{denoms.n50 || 0}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[8px] text-slate-500 font-bold block">₹20</span>
                  <span className="text-xs font-extrabold text-orange-400">{denoms.n20 || 0}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-center">
                  <span className="text-[8px] text-slate-500 font-bold block">₹10</span>
                  <span className="text-xs font-extrabold text-purple-400">{denoms.n10 || 0}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800 text-center col-span-2 sm:col-span-1">
                  <span className="text-[8px] text-slate-500 font-bold block">Coins</span>
                  <div className="flex flex-col text-[8px] mt-0.5">
                    {denoms.c20 > 0 && <span className="text-yellow-400">₹20×{denoms.c20}</span>}
                    {denoms.c10 > 0 && <span className="text-yellow-400">₹10×{denoms.c10}</span>}
                    {denoms.c5 > 0 && <span className="text-yellow-400">₹5×{denoms.c5}</span>}
                    {denoms.c2 > 0 && <span className="text-yellow-400">₹2×{denoms.c2}</span>}
                    {denoms.c1 > 0 && <span className="text-yellow-400">₹1×{denoms.c1}</span>}
                    {denoms.coins > 0 && <span className="text-yellow-400">₹{denoms.coins}</span>}
                    {(!denoms.c20 && !denoms.c10 && !denoms.c5 && !denoms.c2 && !denoms.c1 && !denoms.coins) && <span className="text-slate-500">0</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Accounts Remaining Balances Section */}
            <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-xl flex flex-col gap-2 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                  <Landmark className="w-3 h-3" /> Bank Accounts Remaining Balance
                </span>
                <span className="text-[10px] font-extrabold text-emerald-400">Total: {formatINR(liveTotalBankMoney)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {accounts.map(acc => (
                  <div key={acc._id} className="bg-slate-900 p-2 rounded-lg border border-slate-800 flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-300 truncate max-w-[80px]">{acc.bankName}</span>
                    <span className="font-extrabold text-emerald-400">{formatINR(acc.currentBalance)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Udhar & Jama Ledger Summary */}
            <div className="grid grid-cols-2 gap-2 text-left">
              <div className="bg-red-950/40 border border-red-500/20 p-2.5 rounded-xl flex flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase text-red-400">Total Udhar Owed</span>
                <span className="text-sm font-extrabold text-red-300">{formatINR(totalOutstandingUdhar)}</span>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-500/20 p-2.5 rounded-xl flex flex-col gap-0.5">
                <span className="text-[9px] font-bold uppercase text-emerald-400">Total Jama Advance</span>
                <span className="text-sm font-extrabold text-emerald-300">{formatINR(totalCustomerJama)}</span>
              </div>
            </div>
          </div>

          {/* Search bar & Type Filter */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Bank or Customer Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-9 pr-4 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-500 text-slate-100 font-semibold"
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
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold shrink-0 transition-all ${
                    filterType === f.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
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
              <div className="bg-slate-900/20 border border-slate-800/40 rounded-xl p-8 text-center text-slate-500 text-xs font-bold">
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
                  <div key={tx._id} className={`bg-slate-900/50 border ${isUdhar ? 'border-red-500/30' : isJama ? 'border-emerald-500/30' : 'border-slate-800/80'} rounded-xl p-3.5 flex justify-between items-center transition-all`}>
                    <div className="flex flex-col gap-1 text-left">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-slate-200">{bankNameStr}</span>
                        {isUdhar && <span className="text-[8px] bg-red-500/20 text-red-400 font-extrabold px-1.5 py-0.5 rounded">UDHAR</span>}
                        {isJama && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded">JAMA</span>}
                      </div>

                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-600" />
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
                            className="h-6 px-1.5 text-[9px] bg-slate-950 border border-slate-800 rounded text-slate-100 focus:border-amber-500 focus:outline-none font-bold placeholder:text-slate-700 w-28"
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            placeholder="Customer Name"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveName(tx._id)}
                            className="h-6 w-6 bg-emerald-600 hover:bg-emerald-700 text-slate-100 flex items-center justify-center rounded text-[9px] font-bold"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTxId(null)}
                            className="h-6 w-6 bg-slate-800 border border-slate-700 hover:bg-slate-750 text-slate-400 flex items-center justify-center rounded text-[9px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mt-1 text-[9px] leading-none select-none">
                          <span className="text-slate-500">Customer:</span>
                          <span className="text-slate-200 font-extrabold truncate max-w-[100px]">{tx.customerName || '—'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTxId(tx._id);
                              setTempName(tx.customerName || '');
                            }}
                            className="text-amber-500/80 hover:text-amber-400 p-0.5"
                          >
                            <Edit3 className="w-2.5 h-2.5 inline" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-right flex flex-col gap-1">
                      <span className={`text-xs font-extrabold ${isUdhar ? 'text-red-400' : isJama ? 'text-emerald-400' : (tx.customerAmount >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                        {isUdhar ? `₹${Math.abs(tx.cashOut || tx.customerAmount)} UDHAR` : isJama ? `+${formatINR(Math.abs(tx.customerAmount || tx.cashOut))} JAMA` : (tx.customerAmount >= 0 ? '+' : '') + formatINR(tx.customerAmount)}
                      </span>
                      <div className="text-[9px] text-slate-400 flex items-center justify-end gap-1.5">
                        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                          {tx.type === 'Debit' ? 'Cash In' : tx.type === 'Jama' ? 'Advance' : 'Cash Out'}: {formatINR(Math.abs(tx.cashOut))}
                        </span>
                        <span className="bg-cyan-500/10 text-cyan-400 px-1 py-0.5 rounded border border-cyan-500/10 font-semibold">
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

      {/* UDHAR & JAMA Customer Ledger Sub-Tab */}
      {activeSubTab === 'udhar_jama' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-left">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Customer Udhar & Jama Ledger</h3>
            <p className="text-[10px] text-slate-400">Track pending customer dues (Udhar) and advance deposits (Jama)</p>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-3 flex flex-col gap-1 text-left">
              <span className="text-[10px] font-bold uppercase text-red-400">Pending Udhar Owed</span>
              <span className="text-xl font-extrabold text-red-300">{formatINR(totalOutstandingUdhar)}</span>
              <span className="text-[9px] text-slate-500">Unpaid service dues</span>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-3 flex flex-col gap-1 text-left">
              <span className="text-[10px] font-bold uppercase text-emerald-400">Customer Jama Advances</span>
              <span className="text-xl font-extrabold text-emerald-300">{formatINR(totalCustomerJama)}</span>
              <span className="text-[9px] text-slate-500">Advance deposits</span>
            </div>
          </div>

          {/* Customer Ledger List */}
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto no-scrollbar pb-10">
            {customerLedgers.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800/40 rounded-xl p-8 text-center text-slate-500 text-xs font-bold">
                No customer Udhar or Jama records created yet.
              </div>
            ) : (
              customerLedgers.map((cust) => {
                const isDue = cust.netBalance < 0;
                const isAdvance = cust.netBalance > 0;

                return (
                  <div key={cust.customerName} className={`bg-slate-900/50 border ${isDue ? 'border-red-500/30' : isAdvance ? 'border-emerald-500/30' : 'border-slate-800'} rounded-2xl p-4 flex justify-between items-center transition-all text-left`}>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-extrabold text-slate-100">{cust.customerName}</span>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Udhar: <span className="text-red-400 font-bold">{formatINR(cust.totalUdhar)}</span></span>
                        <span>•</span>
                        <span>Jama: <span className="text-emerald-400 font-bold">{formatINR(cust.totalJama)}</span></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right flex flex-col items-end">
                        <span className={`text-xs font-extrabold ${isDue ? 'text-red-400' : isAdvance ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {isDue ? `₹${Math.abs(cust.netBalance)} UDHAR` : isAdvance ? `+${formatINR(cust.netBalance)} JAMA` : 'Settled (₹0)'}
                        </span>
                        <span className="text-[9px] text-slate-500">{cust.txCount} transactions</span>
                      </div>

                      {isDue && (
                        <button
                          type="button"
                          onClick={() => {
                            setSettleCustomer(cust);
                            setSettleAmount(String(Math.abs(cust.netBalance)));
                            setErrorMsg('');
                          }}
                          className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-[10px] font-bold transition-all"
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
          <form onSubmit={handleSettleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-4 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">Settle Customer Udhar</h3>
                <p className="text-[10px] text-slate-400">Customer paying pending credit: <span className="font-bold text-slate-200">{settleCustomer.customerName}</span></p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Settlement Payment Amount (₹)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full h-12 bg-slate-950 border border-slate-800 text-emerald-400 font-extrabold text-xl text-center rounded-xl px-3 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Received Via
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettleMethod('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    settleMethod === 'cash'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Cash In Hand
                </button>
                <button
                  type="button"
                  onClick={() => setSettleMethod('bank')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    settleMethod === 'bank'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Bank Transfer
                </button>
              </div>
            </div>

            {settleMethod === 'bank' && accounts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Target Bank Account
                </label>
                <select
                  value={settleBankId}
                  onChange={(e) => setSettleBankId(e.target.value)}
                  className="w-full h-10 px-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 font-bold focus:outline-none"
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
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-md"
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
          <form onSubmit={handleAddAccount} className="bg-slate-900/30 border border-slate-850 p-4 rounded-2xl flex flex-col gap-3 text-left">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-amber-500" /> Register Bank Account
            </h3>
            
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                placeholder="Bank Name (e.g. SBI, ICICI, HDFC)"
                value={bankName}
                onChange={(e) => { setBankName(e.target.value); setErrorMsg(''); setSuccessMsg(''); }}
                className="w-full h-10 px-3 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-600 text-slate-100 font-semibold"
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
                className="w-full h-10 px-3 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-600 text-slate-100 font-semibold"
              />
            </div>

            {errorMsg && (
              <p className="text-[10px] text-red-400 font-semibold">{errorMsg}</p>
            )}
            {successMsg && (
              <p className="text-[10px] text-emerald-400 font-semibold">{successMsg}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs shadow hover:bg-amber-500 active:scale-95 transition-all flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Add Account'
              )}
            </button>
          </form>

          <div className="flex flex-col gap-3 text-left">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Registered Accounts ({accounts.length})
              </h3>
              <div className="text-xs font-extrabold text-slate-200">
                Live Total: <span className="text-emerald-400">{formatINR(liveTotalBankMoney)}</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2.5 max-h-[35vh] overflow-y-auto no-scrollbar pb-2">
              {accounts.length === 0 ? (
                <div className="bg-slate-900/20 border border-slate-800/40 rounded-xl p-8 text-center text-slate-500 text-xs font-bold">
                  No bank accounts registered yet.
                </div>
              ) : (
                accounts.map((acc) => (
                  <div key={acc._id} className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl flex justify-between items-center">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="p-2 bg-slate-950 rounded-lg border border-slate-850 shrink-0">
                        <Landmark className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-bold text-slate-200 truncate">{acc.bankName}</span>
                        <span className="text-[9px] text-slate-500">Edit balance manually</span>
                      </div>
                    </div>
                    
                    <div className="relative shrink-0 w-28">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editableBalances[acc._id] !== undefined ? editableBalances[acc._id] : ''}
                        onChange={(e) => handleBalanceChange(acc._id, e.target.value)}
                        className="w-full h-8 px-2 text-right text-xs font-bold bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-100 rounded focus:outline-none placeholder:text-slate-700"
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
                className="w-full h-10 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
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
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Daily EOD Reports</h3>
            <p className="text-[10px] text-slate-500">Chronological snapshot feed of closed daily sessions, cash handbooks, and bank EOD balances.</p>
          </div>

          {(dayHistory || []).length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500 font-bold">
              No daily summaries history available yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(dayHistory || []).map((day) => {
                const isClosed = day.status === 'Closed';
                const balancesObj = day.bankBalances || {};
                const balancesArray = Object.entries(balancesObj);
                const dayTxs = (transactions || []).filter(t => t.timestamp.split('T')[0] === day.date);
                
                return (
                  <div key={day.date} className="bg-slate-900/50 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3 text-left">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-slate-100">{day.date}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        isClosed
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      }`}>
                        {day.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-left">
                      <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-900 flex flex-col gap-0.5">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Opening Cash</span>
                        <span className="text-xs font-bold text-slate-300">{formatINR(day.openingCash)}</span>
                      </div>
                      <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-900 flex flex-col gap-0.5">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Closing Cash</span>
                        <span className="text-xs font-bold text-slate-300">{formatINR(day.closingCash)}</span>
                      </div>
                      <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-900 flex flex-col gap-0.5">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Net Profit</span>
                        <span className="text-xs font-bold text-emerald-400">{formatINR(day.totalProfit)}</span>
                      </div>
                    </div>

                    {/* Denomination Notes Breakdown if present */}
                    {day.cashDenominations && (
                      <div className="bg-slate-950/20 border border-slate-900/60 p-2.5 rounded-xl flex flex-col gap-1 text-[10px]">
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-900 pb-1">Notes Denomination Snapshot</span>
                        <div className="flex flex-wrap gap-1.5 mt-1 font-bold text-slate-300">
                          {day.cashDenominations.n500 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400">500×{day.cashDenominations.n500}</span>}
                          {day.cashDenominations.n200 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-400">200×{day.cashDenominations.n200}</span>}
                          {day.cashDenominations.n100 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-blue-400">100×{day.cashDenominations.n100}</span>}
                          {day.cashDenominations.n50 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-400">50×{day.cashDenominations.n50}</span>}
                          {day.cashDenominations.n20 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-orange-400">20×{day.cashDenominations.n20}</span>}
                          {day.cashDenominations.n10 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-purple-400">10×{day.cashDenominations.n10}</span>}
                          {day.cashDenominations.c20 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-yellow-400">c20×{day.cashDenominations.c20}</span>}
                          {day.cashDenominations.c10 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-yellow-400">c10×{day.cashDenominations.c10}</span>}
                          {day.cashDenominations.c5 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-yellow-400">c5×{day.cashDenominations.c5}</span>}
                          {day.cashDenominations.c2 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-yellow-400">c2×{day.cashDenominations.c2}</span>}
                          {day.cashDenominations.c1 > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-yellow-400">c1×{day.cashDenominations.c1}</span>}
                          {day.cashDenominations.coins > 0 && <span className="bg-slate-900 px-1.5 py-0.5 rounded text-yellow-400">Coins: ₹{day.cashDenominations.coins}</span>}
                        </div>
                      </div>
                    )}

                    {balancesArray.length > 0 && (
                      <div className="bg-slate-950/20 border border-slate-900/80 p-2.5 rounded-xl flex flex-col gap-1.5 text-left">
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-900 pb-1">Bank Balances at Close</span>
                        <div className="grid grid-cols-2 gap-2">
                          {balancesArray.map(([bank, bal]) => (
                            <div key={bank} className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-400 font-semibold truncate max-w-[80px]">{bank}</span>
                              <span className="text-slate-100 font-bold">{formatINR(bal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
