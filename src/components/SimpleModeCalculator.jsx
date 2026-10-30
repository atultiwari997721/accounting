import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Wallet, 
  Landmark, 
  ArrowRight, 
  RotateCcw, 
  Check, 
  Save, 
  Plus, 
  Trash2, 
  Share2, 
  History, 
  Calendar, 
  TrendingUp, 
  FileText, 
  Users, 
  Coins,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { numberToIndianWords } from '../utils/numberToWords';
import CashStatementReceipt from './CashStatementReceipt';
import DetailedStatementReportModal from './DetailedStatementReportModal';

export default function SimpleModeCalculator({
  accounts = [],
  dayHistory = [],
  activeDay = null,
  onSaveDayCalculation,
  onUpdateAccounts
}) {
  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');
  const todayStr = new Date().toLocaleDateString('en-CA');

  // Helper to sanitize numeric inputs and remove unwanted leading zeros while typing
  const cleanNumber = (val) => {
    if (val === undefined || val === null) return '';
    const digits = String(val).replace(/[^0-9]/g, '');
    if (!digits) return '';
    // Strip leading zeros if followed by other digits (e.g. "05" -> "5", "00" -> "0")
    return digits.replace(/^0+(?=\d)/, '');
  };

  // 1. Core State
  const [date, setDate] = useState(todayStr);

  // Opening amounts (empty string shows placeholder '0' and allows clean typing)
  const [openingCash, setOpeningCash] = useState(() => {
    const val = activeDay?.openingCash;
    return val ? String(val) : '';
  });
  const [openingBankBalances, setOpeningBankBalances] = useState(() => {
    const map = {};
    accounts.forEach(acc => {
      const bal = Number(acc.currentBalance || 0);
      map[acc.bankName] = bal > 0 ? String(bal) : '';
    });
    return map;
  });

  // Closing / Current amounts
  const [closingCash, setClosingCash] = useState(() => {
    const val = activeDay?.closingCash;
    return val ? String(val) : '';
  });
  const [closingBankBalances, setClosingBankBalances] = useState(() => {
    const map = {};
    accounts.forEach(acc => {
      const bal = Number(acc.currentBalance || 0);
      map[acc.bankName] = bal > 0 ? String(bal) : '';
    });
    return map;
  });

  // Udhar & Jama Ledger list
  const [udharList, setUdharList] = useState(() => {
    try {
      const stored = localStorage.getItem('kiosk_simple_udhar');
      return stored ? JSON.parse(stored) : [
        { id: 'u1', name: 'Ramesh Patel', amount: 500, type: 'udhar', note: 'Pending cash withdrawal' },
        { id: 'u2', name: 'Suresh Kumar', amount: 200, type: 'jama', note: 'Advance for bill' }
      ];
    } catch (e) {
      return [];
    }
  });

  // Custom Extra Income or Expense (optional adjustments)
  const [extraExpenses, setExtraExpenses] = useState('');
  const [extraIncome, setExtraIncome] = useState('');

  // New Udhar entry form
  const [newCustName, setNewCustName] = useState('');
  const [newCustAmount, setNewCustAmount] = useState('');
  const [newCustType, setNewCustType] = useState('udhar'); // 'udhar' | 'jama'
  const [newCustNote, setNewCustNote] = useState('');

  // New Bank Account inline form
  const [newBankName, setNewBankName] = useState('');
  const [newBankOpenBal, setNewBankOpenBal] = useState('');

  // UI state
  const [activeView, setActiveView] = useState('calculator'); // 'calculator' | 'udhar' | 'history'
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptParams, setReceiptParams] = useState(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [selectedStatementDay, setSelectedStatementDay] = useState(null);

  // Save Udhar to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('kiosk_simple_udhar', JSON.stringify(udharList));
    } catch (e) {}
  }, [udharList]);

  // Sync initial account names if accounts list changes
  useEffect(() => {
    if (accounts.length > 0) {
      setOpeningBankBalances(prev => {
        const next = { ...prev };
        accounts.forEach(acc => {
          if (next[acc.bankName] === undefined) {
            const bal = Number(acc.currentBalance || 0);
            next[acc.bankName] = bal > 0 ? String(bal) : '';
          }
        });
        return next;
      });
      setClosingBankBalances(prev => {
        const next = { ...prev };
        accounts.forEach(acc => {
          if (next[acc.bankName] === undefined) {
            const bal = Number(acc.currentBalance || 0);
            next[acc.bankName] = bal > 0 ? String(bal) : '';
          }
        });
        return next;
      });
    }
  }, [accounts]);

  // 2. Calculations
  const calc = useMemo(() => {
    const openCashNum = Number(openingCash) || 0;
    const closeCashNum = Number(closingCash) || 0;
    const cashDiff = closeCashNum - openCashNum; // Cash difference

    // Total Opening Online & Closing Online
    let totalOpenOnline = 0;
    let totalCloseOnline = 0;
    const bankDiffs = {};

    Object.entries(closingBankBalances).forEach(([bName, closeVal]) => {
      const openVal = Number(openingBankBalances[bName]) || 0;
      const cVal = Number(closeVal) || 0;
      totalOpenOnline += openVal;
      totalCloseOnline += cVal;
      bankDiffs[bName] = cVal - openVal;
    });

    const onlineDiff = totalCloseOnline - totalOpenOnline;

    // Udhar calculation
    const totalUdhar = udharList
      .filter(u => u.type === 'udhar')
      .reduce((s, u) => s + (Number(u.amount) || 0), 0);

    const totalJama = udharList
      .filter(u => u.type === 'jama')
      .reduce((s, u) => s + (Number(u.amount) || 0), 0);

    const netUdharImpact = totalUdhar - totalJama; // Udhar is money given out from drawer/accounts

    const expenseNum = Number(extraExpenses) || 0;
    const incomeNum = Number(extraIncome) || 0;

    // Total Liquidity
    const totalOpeningCapital = openCashNum + totalOpenOnline;
    const totalClosingCapital = closeCashNum + totalCloseOnline;

    // In Kiosk operations:
    // Profit = (Closing Capital - Opening Capital) + Extra Expenses - Extra Income
    // Or if cash difference is primary: Cash Difference + Online Difference + Pending Udhar
    const netGrowth = totalClosingCapital - totalOpeningCapital;
    const netProfit = netGrowth + totalUdhar - totalJama + expenseNum - incomeNum;

    return {
      openCashNum,
      closeCashNum,
      cashDiff,
      totalOpenOnline,
      totalCloseOnline,
      onlineDiff,
      bankDiffs,
      totalUdhar,
      totalJama,
      netUdharImpact,
      expenseNum,
      incomeNum,
      totalOpeningCapital,
      totalClosingCapital,
      netGrowth,
      netProfit
    };
  }, [openingCash, closingCash, openingBankBalances, closingBankBalances, udharList, extraExpenses, extraIncome]);

  // Handle adding a new customer Udhar / Jama
  const handleAddUdhar = (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustAmount) return;

    const newEntry = {
      id: 'u_' + Date.now(),
      name: newCustName.trim(),
      amount: Math.abs(Number(newCustAmount) || 0),
      type: newCustType,
      note: newCustNote.trim(),
      date: todayStr,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setUdharList(prev => [newEntry, ...prev]);
    setNewCustName('');
    setNewCustAmount('');
    setNewCustNote('');
  };

  const handleRemoveUdhar = (id) => {
    setUdharList(prev => prev.filter(u => u.id !== id));
  };

  // Add Bank Account inline
  const handleAddBankInline = (e) => {
    e.preventDefault();
    if (!newBankName.trim()) return;

    const bName = newBankName.trim();
    const bal = String(Number(newBankOpenBal) || 0);

    setOpeningBankBalances(prev => ({ ...prev, [bName]: bal }));
    setClosingBankBalances(prev => ({ ...prev, [bName]: bal }));

    if (onUpdateAccounts) {
      onUpdateAccounts(bName, Number(bal));
    }

    setNewBankName('');
    setNewBankOpenBal('');
  };

  // Handle Save EOD Simple Summary
  const handleSaveEOD = () => {
    const finalDayRecord = {
      date: date || todayStr,
      status: 'Closed',
      closedAt: new Date().toISOString(),
      openingCash: calc.openCashNum,
      closingCash: calc.closeCashNum,
      totalProfit: calc.netProfit,
      openingBankBalances: { ...openingBankBalances },
      closingBankBalances: { ...closingBankBalances },
      bankBalances: { ...closingBankBalances },
      openCount: 1,
      closeCount: 1,
      mode: 'simple',
      totalUdhar: calc.totalUdhar,
      totalJama: calc.totalJama,
      netGrowth: calc.netGrowth,
      cashDiff: calc.cashDiff,
      onlineDiff: calc.onlineDiff,
      openCloseEvents: [
        {
          id: 'evt_simple_open',
          type: 'OPEN',
          timestamp: `${date || todayStr}T09:00:00.000Z`,
          cash: calc.openCashNum,
          bankBalances: { ...openingBankBalances },
          note: 'Simple Mode Opening Balance'
        },
        {
          id: 'evt_simple_close',
          type: 'CLOSE',
          timestamp: new Date().toISOString(),
          cash: calc.closeCashNum,
          bankBalances: { ...closingBankBalances },
          note: `Simple Mode EOD Profit: ${formatINR(calc.netProfit)}`
        }
      ]
    };

    if (onSaveDayCalculation) {
      onSaveDayCalculation(finalDayRecord);
    } else {
      // Local fallback
      const history = JSON.parse(localStorage.getItem('kiosk_day_history') || '[]');
      const filtered = history.filter(h => h.date !== finalDayRecord.date);
      filtered.unshift(finalDayRecord);
      localStorage.setItem('kiosk_day_history', JSON.stringify(filtered));
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // WhatsApp Share function
  const handleShareWhatsApp = () => {
    let t = `🏛️ *SBI KIOSK - DAILY SIMPLE PROFIT STATEMENT*\n`;
    t += `📅 *Date:* ${date} | *Generated:* ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    t += `------------------------------------\n`;
    t += `💵 *DRAWER CASH CALCULATION:*\n`;
    t += `• Opening Cash: ${formatINR(calc.openCashNum)}\n`;
    t += `• Closing Cash: ${formatINR(calc.closeCashNum)}\n`;
    t += `• Cash Variance: ${calc.cashDiff >= 0 ? '+' : ''}${formatINR(calc.cashDiff)}\n`;
    t += `------------------------------------\n`;
    t += `🏦 *ONLINE BANK ACCOUNTS:*\n`;
    Object.keys(closingBankBalances).forEach(bName => {
      const open = Number(openingBankBalances[bName]) || 0;
      const close = Number(closingBankBalances[bName]) || 0;
      const diff = close - open;
      t += `• ${bName}: ${formatINR(open)} ➔ ${formatINR(close)} (${diff >= 0 ? '+' : ''}${formatINR(diff)})\n`;
    });
    t += `• Total Online Variance: ${calc.onlineDiff >= 0 ? '+' : ''}${formatINR(calc.onlineDiff)}\n`;
    t += `------------------------------------\n`;
    t += `📋 *UDHAR & ADVANCE (JAMA):*\n`;
    t += `• Total Udhar Owed (Given): ${formatINR(calc.totalUdhar)}\n`;
    t += `• Total Jama (Advance): ${formatINR(calc.totalJama)}\n`;
    t += `------------------------------------\n`;
    t += `💎 *CAPITAL LIQUIDITY:*\n`;
    t += `• Opening Total: ${formatINR(calc.totalOpeningCapital)}\n`;
    t += `• Closing Total: ${formatINR(calc.totalClosingCapital)}\n`;
    t += `• Net Capital Growth: ${calc.netGrowth >= 0 ? '+' : ''}${formatINR(calc.netGrowth)}\n`;
    t += `------------------------------------\n`;
    t += `🏆 *CALCULATED NET PROFIT: +${formatINR(calc.netProfit)}*\n`;
    t += `In words: _${numberToIndianWords(calc.netProfit)}_\n`;
    t += `------------------------------------\n`;
    t += `*Quick Simple Mode • SBI Kiosk Ledger*`;

    const url = `https://wa.me/?text=${encodeURIComponent(t)}`;
    window.open(url, '_blank');
  };

  const handleOpenReceipt = () => {
    setReceiptParams({
      dateStr: date,
      totalCash: calc.closeCashNum,
      denominations: activeDay?.cashDenominations || {},
      onlineAmount: calc.totalCloseOnline,
      accountName: 'Simple Mode Calculation',
      bankAccounts: closingBankBalances
    });
    setShowReceipt(true);
  };

  return (
    <div className="flex flex-col gap-3 px-3 pt-3 pb-8 select-none text-left">
      
      {/* Top Banner: Mode Indicator & Subtabs */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-blue-700 text-white rounded-3xl p-4 shadow-md flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black tracking-widest bg-white/20 px-2 py-0.5 rounded-full uppercase">
                ⚡ Simple Mode
              </span>
              <span className="text-[9px] text-emerald-100 font-bold">1-Time Final Totals</span>
            </div>
            <h1 className="text-base font-black tracking-tight mt-1 text-white">Daily Profit & Balance Sheet</h1>
            <p className="text-[10px] text-emerald-100/90 font-medium -mt-0.5">
              No need to enter single transactions. Just fill opening & closing balances to calculate profit!
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[8px] font-bold text-emerald-200 uppercase">Calculated Profit</span>
            <span className="text-xl font-black tracking-tight text-white drop-shadow-sm">
              +{formatINR(calc.netProfit)}
            </span>
          </div>
        </div>

        {/* Navigation Subtabs */}
        <div className="grid grid-cols-3 gap-1 bg-black/15 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveView('calculator')}
            className={`py-1.5 text-center text-[10.5px] font-black rounded-xl transition-all ${
              activeView === 'calculator' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/80 hover:text-white'
            }`}
          >
            📊 Calculator
          </button>
          <button
            type="button"
            onClick={() => setActiveView('udhar')}
            className={`py-1.5 text-center text-[10.5px] font-black rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeView === 'udhar' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/80 hover:text-white'
            }`}
          >
            <span>👥 Udhar / Jama</span>
            {udharList.length > 0 && (
              <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold ${
                activeView === 'udhar' ? 'bg-rose-100 text-rose-800' : 'bg-white/20 text-white'
              }`}>
                {udharList.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('history')}
            className={`py-1.5 text-center text-[10.5px] font-black rounded-xl transition-all ${
              activeView === 'history' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/80 hover:text-white'
            }`}
          >
            📋 Past History
          </button>
        </div>
      </div>

      {/* VIEW 1: SIMPLE PROFIT CALCULATOR */}
      {activeView === 'calculator' && (
        <div className="flex flex-col gap-3.5">
          
          {/* Date Selector Row */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 flex justify-between items-center shadow-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700">Calculation Date:</span>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl px-2 py-1 focus:outline-none focus:border-emerald-600"
            />
          </div>

          {/* SECTION A: Physical Drawer Cash */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-amber-600" /> 1. Drawer Physical Cash
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                calc.cashDiff >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                Diff: {calc.cashDiff >= 0 ? '+' : ''}{formatINR(calc.cashDiff)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-slate-500">Opening Cash (₹)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={openingCash}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setOpeningCash(cleanNumber(e.target.value))}
                  className="h-11 px-3 bg-slate-50 border border-slate-200 focus:border-emerald-600 rounded-xl text-base font-black text-slate-900 focus:outline-none shadow-2xs"
                />
                <span className="text-[8px] text-slate-400">Cash in morning / start</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-slate-500">Closing Cash (₹)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={closingCash}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setClosingCash(cleanNumber(e.target.value))}
                  className="h-11 px-3 bg-emerald-50/50 border border-emerald-300 focus:border-emerald-600 rounded-xl text-base font-black text-emerald-950 focus:outline-none shadow-2xs"
                />
                <span className="text-[8px] text-slate-400">Cash counted right now</span>
              </div>
            </div>
          </div>

          {/* SECTION B: Online Bank Balances */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-blue-600" /> 2. Online Bank Balances
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                calc.onlineDiff >= 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                Net: {calc.onlineDiff >= 0 ? '+' : ''}{formatINR(calc.onlineDiff)}
              </span>
            </div>

            {/* List of Accounts */}
            <div className="flex flex-col gap-2">
              {Object.keys(closingBankBalances).map(bName => {
                const openVal = openingBankBalances[bName] !== undefined ? openingBankBalances[bName] : '';
                const closeVal = closingBankBalances[bName] !== undefined ? closingBankBalances[bName] : '';
                const diff = (Number(closeVal) || 0) - (Number(openVal) || 0);

                return (
                  <div key={bName} className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <Landmark className="w-3 h-3 text-blue-600" /> {bName}
                      </span>
                      <span className={`text-[9.5px] font-black ${diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {diff >= 0 ? '+' : ''}{formatINR(diff)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Opening (Start)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={openVal}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = cleanNumber(e.target.value);
                            setOpeningBankBalances(prev => ({ ...prev, [bName]: val }));
                          }}
                          className="h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                        />
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Closing (Final)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={closeVal}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = cleanNumber(e.target.value);
                            setClosingBankBalances(prev => ({ ...prev, [bName]: val }));
                          }}
                          className="h-9 px-2 bg-white border border-blue-300 rounded-lg text-xs font-bold text-blue-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline Add New Bank Account */}
            <form onSubmit={handleAddBankInline} className="flex gap-2 pt-1 border-t border-slate-100">
              <input
                type="text"
                placeholder="+ Bank Name (e.g. ICICI)"
                value={newBankName}
                onChange={(e) => setNewBankName(e.target.value)}
                className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Bal ₹"
                value={newBankOpenBal}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNewBankOpenBal(cleanNumber(e.target.value))}
                className="w-20 h-9 px-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-600"
              />
              <button
                type="submit"
                className="px-3 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                Add
              </button>
            </form>
          </div>

          {/* SECTION C: Udhar & Advance Quick Summary */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col gap-2.5 shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-600" /> 3. Udhar & Jama (Credit / Advance)
              </span>
              <button
                type="button"
                onClick={() => setActiveView('udhar')}
                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
              >
                Manage Customers ➔
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex flex-col gap-0.5">
                <span className="text-[8px] font-bold text-rose-600 uppercase">Customer Udhar Owed</span>
                <span className="text-sm font-black text-rose-800">{formatINR(calc.totalUdhar)}</span>
                <span className="text-[7.5px] text-rose-500">Money given to customers</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex flex-col gap-0.5">
                <span className="text-[8px] font-bold text-emerald-600 uppercase">Customer Jama (Advance)</span>
                <span className="text-sm font-black text-emerald-800">{formatINR(calc.totalJama)}</span>
                <span className="text-[7.5px] text-emerald-500">Advance deposited by customers</span>
              </div>
            </div>
          </div>

          {/* SECTION D: Extra Income / Expenses (Optional) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-3.5 flex flex-col gap-2 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              4. Additional Day Expenses / Extra Profit (Optional)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[8px] font-bold text-slate-400 uppercase">Extra Expenses (Shop/Tea)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={extraExpenses}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setExtraExpenses(cleanNumber(e.target.value))}
                  className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-rose-700 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[8px] font-bold text-slate-400 uppercase">Other Income / Bonus</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={extraIncome}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setExtraIncome(cleanNumber(e.target.value))}
                  className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* GRAND PROFIT & SUMMARY BANNER */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-3xl p-4 shadow-lg flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-emerald-400/40 pb-2">
              <div>
                <span className="text-[9px] font-bold text-emerald-100 uppercase tracking-widest block">
                  Final Simple Calculation
                </span>
                <span className="text-base font-black text-white">🏆 Day Total Net Profit</span>
              </div>
              <span className="text-2xl font-black tracking-tight text-white drop-shadow-sm">
                +{formatINR(calc.netProfit)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
              <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
                <span className="text-[8px] text-emerald-100 uppercase">Opening Total Capital</span>
                <span>{formatINR(calc.totalOpeningCapital)}</span>
              </div>
              <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
                <span className="text-[8px] text-emerald-100 uppercase">Closing Total Capital</span>
                <span>{formatINR(calc.totalClosingCapital)}</span>
              </div>
            </div>

            <div className="text-[9px] text-emerald-100 italic bg-white/10 p-2 rounded-xl text-center">
              "_{numberToIndianWords(calc.netProfit)}_"
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-emerald-400/40">
              <button
                type="button"
                onClick={handleSaveEOD}
                className="py-2.5 bg-white hover:bg-emerald-50 text-emerald-900 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1"
              >
                {saveSuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Save className="w-4 h-4 text-emerald-700" />}
                {saveSuccess ? 'Saved!' : 'Save EOD'}
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>

              <button
                type="button"
                onClick={handleOpenReceipt}
                className="py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> Cash Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: UDHAR & JAMA (CREDIT & ADVANCE LEDGER) */}
      {activeView === 'udhar' && (
        <div className="flex flex-col gap-3">
          
          {/* Header & Add form */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col gap-3 shadow-xs">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" /> Add Customer Udhar or Jama
            </span>

            <form onSubmit={handleAddUdhar} className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Customer Name"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-600"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Amount ₹"
                  value={newCustAmount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewCustAmount(cleanNumber(e.target.value))}
                  className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewCustType('udhar')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      newCustType === 'udhar' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    🔴 Udhar (Due)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustType('jama')}
                    className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      newCustType === 'jama' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    🟢 Jama (Advance)
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={newCustNote}
                  onChange={(e) => setNewCustNote(e.target.value)}
                  className="h-9 px-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Save Customer Entry
              </button>
            </form>
          </div>

          {/* Customer Entries List */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-extrabold uppercase text-slate-500 px-1">
              Recorded Customer Entries ({udharList.length})
            </span>

            {udharList.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400 font-bold">
                No customer Udhar or Jama recorded.
              </div>
            ) : (
              udharList.map(item => {
                const isUdhar = item.type === 'udhar';
                return (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-3 flex justify-between items-center shadow-xs">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded uppercase ${
                          isUdhar ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isUdhar ? 'UDHAR' : 'JAMA'}
                        </span>
                        <span className="text-xs font-black text-slate-800">{item.name}</span>
                      </div>
                      {item.note && <span className="text-[9px] text-slate-400 italic">{item.note}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black ${isUdhar ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {formatINR(item.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveUdhar(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-all"
                        title="Remove entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: PAST HISTORY & AUDIT */}
      {activeView === 'history' && (
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Past Days Simple EOD Summaries
          </span>

          {(dayHistory || []).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400 font-bold shadow-xs">
              No closed summaries recorded yet. Save an EOD from the calculator!
            </div>
          ) : (
            dayHistory.map(day => (
              <div key={day.date} className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2 text-left shadow-xs">
                <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black text-slate-800">{day.date}</span>
                    {day.mode === 'simple' && (
                      <span className="text-[8px] bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.2 rounded font-bold">
                        SIMPLE
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black text-emerald-700">
                    +{formatINR(day.totalProfit)} Profit
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-slate-50 p-2 rounded-xl flex justify-between items-center">
                    <span className="text-slate-400">Opening Cash:</span>
                    <span className="font-bold text-slate-800">{formatINR(day.openingCash)}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl flex justify-between items-center">
                    <span className="text-slate-400">Closing Cash:</span>
                    <span className="font-bold text-amber-800">{formatINR(day.closingCash)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatementDay(day);
                    setShowStatementModal(true);
                  }}
                  className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                >
                  <FileText className="w-3.5 h-3.5" /> View Statement & Report
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Cash Statement Receipt Modal */}
      {receiptParams && (
        <CashStatementReceipt
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          dateStr={receiptParams.dateStr}
          accountName={receiptParams.accountName}
          denominations={receiptParams.denominations}
          totalCash={receiptParams.totalCash}
          onlineAmount={receiptParams.onlineAmount}
          bankAccounts={receiptParams.bankAccounts}
          kioskTitle="SBI Kiosk Simple Ledger"
        />
      )}

      {/* Detailed Statement Modal */}
      {selectedStatementDay && (
        <DetailedStatementReportModal
          isOpen={showStatementModal}
          onClose={() => {
            setShowStatementModal(false);
            setSelectedStatementDay(null);
          }}
          day={selectedStatementDay}
          transactions={[]}
          accounts={accounts}
          kioskTitle="SBI Kiosk Simple Statement"
        />
      )}
    </div>
  );
}
