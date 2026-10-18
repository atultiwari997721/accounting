import React, { useState, useEffect } from 'react';
import { Landmark, ArrowRightLeft, DollarSign, Wallet, Percent, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, HelpCircle, Calculator, PlusCircle, UserCheck } from 'lucide-react';
import DenominationModal from './DenominationModal';

export default function TransactionForm({ activeDay, accounts, onSubmitTransaction, onNavigateToAccounts, onOpenDay }) {
  const [amount, setAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [quickOpeningCash, setQuickOpeningCash] = useState('');
  const [showDenomModal, setShowDenomModal] = useState(false);
  const [quickDenoms, setQuickDenoms] = useState({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0 });

  // Jama (Advance Deposit) Modal State
  const [showJamaModal, setShowJamaModal] = useState(false);
  const [jamaCustomerName, setJamaCustomerName] = useState('');
  const [jamaAmount, setJamaAmount] = useState('');
  const [jamaMethod, setJamaMethod] = useState('cash'); // 'cash' | 'bank'

  // Physical Notes Breakdown Modal State (for Withdrawal & Deposit)
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [pendingTx, setPendingTx] = useState(null);
  const [txNotes, setTxNotes] = useState({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0 });

  const handleQuickOpen = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const today = new Date().toISOString().split('T')[0];
    const cashAmount = Number(quickOpeningCash) || 0;
    const result = await onOpenDay(today, cashAmount, quickDenoms);
    if (result.success) {
      setSuccessMsg(`Ledger opened for today with ${formatINR(cashAmount)} starting cash!`);
      setQuickOpeningCash('');
    } else {
      setErrorMsg(result.error || 'Failed to open ledger.');
    }
  };

  // Automatically select the first bank if available
  useEffect(() => {
    if (accounts.length > 0 && !selectedBankId) {
      setSelectedBankId(accounts[0]._id);
    }
  }, [accounts, selectedBankId]);

  const [commissionMode, setCommissionMode] = useState('deducted'); // deducted | cash | bank | udhar
  const [customerName, setCustomerName] = useState('');
  const [txType, setTxType] = useState('Credit'); // 'Credit' = Cash Out (Withdrawal), 'Debit' = Cash In (Deposit)

  const numAmount = Number(amount) || 0;
  // 1% Commission Model calculations
  const commission = Math.round(numAmount * 0.01 * 100) / 100; // Rs 10 charged per Rs 1000

  let targetCustomerAmount = 0;
  let targetCashOut = 0;
  let initialCashRequired = 0;
  let initialBankRequired = 0;

  const selectedBankAcc = accounts.find(a => a._id === selectedBankId);
  const bankBalance = selectedBankAcc ? selectedBankAcc.currentBalance : 0;

  if (txType === 'Credit') {
    // Cash Out (Withdrawal)
    if (commissionMode === 'deducted') {
      targetCustomerAmount = numAmount;
      targetCashOut = numAmount - commission;
      initialCashRequired = numAmount - commission;
    } else if (commissionMode === 'cash') {
      targetCustomerAmount = numAmount;
      targetCashOut = numAmount - commission;
      initialCashRequired = numAmount;
    } else if (commissionMode === 'bank') {
      targetCustomerAmount = numAmount + commission;
      targetCashOut = numAmount;
      initialCashRequired = numAmount;
    } else if (commissionMode === 'udhar') {
      targetCustomerAmount = 0; // Customer hasn't transferred money online yet (Udhar!)
      targetCashOut = numAmount; // Physical cash given out to customer
      initialCashRequired = numAmount;
    }
  } else {
    // Cash In (Deposit)
    if (commissionMode === 'deducted') {
      targetCustomerAmount = -(numAmount - commission);
      targetCashOut = -numAmount;
      initialBankRequired = numAmount - commission;
    } else if (commissionMode === 'cash') {
      targetCustomerAmount = -numAmount;
      targetCashOut = -(numAmount + commission);
      initialBankRequired = numAmount;
    } else if (commissionMode === 'bank') {
      targetCustomerAmount = -numAmount;
      targetCashOut = -numAmount;
      initialBankRequired = numAmount;
    } else if (commissionMode === 'udhar') {
      targetCustomerAmount = -numAmount; // Sent online transfer to customer
      targetCashOut = 0; // Customer hasn't paid cash yet (Udhar!)
      initialBankRequired = numAmount;
    }
  }

  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!activeDay) {
      setErrorMsg('Cannot record transaction. Ledger is closed. Open it in Settings.');
      return;
    }
    if (!selectedBankId) {
      setErrorMsg('Please select a bank account.');
      return;
    }
    if (numAmount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    if (commissionMode === 'udhar' && (!customerName || !customerName.trim())) {
      setErrorMsg('Customer Name is REQUIRED for Udhar (Credit) transactions!');
      return;
    }

    if (txType === 'Credit') {
      if (initialCashRequired > activeDay.closingCash) {
        setErrorMsg(`Insufficient Cash in Hand! You need at least ${formatINR(initialCashRequired)} available.`);
        return;
      }
    } else {
      if (initialBankRequired > bankBalance) {
        setErrorMsg(`Insufficient Bank Balance! You need at least ${formatINR(initialBankRequired)} in ${selectedBankAcc?.bankName || 'bank'}.`);
        return;
      }
    }

    // Execute transaction directly using the user's chosen commissionMode
    handleCommissionChosen(commissionMode);
  };

  // Helper to calculate notes total
  const computeNotesTotal = (notes) => {
    return (
      (Number(notes.n500) || 0) * 500 +
      (Number(notes.n200) || 0) * 200 +
      (Number(notes.n100) || 0) * 100 +
      (Number(notes.n50)  || 0) * 50 +
      (Number(notes.n20)  || 0) * 20 +
      (Number(notes.n10)  || 0) * 10 +
      (Number(notes.coins) || 0)
    );
  };

  // Helper to format note details as human-readable string
  const formatNoteDetailsStr = (notes, direction) => {
    const parts = [];
    if (notes.n500 > 0) parts.push(`500×${notes.n500}`);
    if (notes.n200 > 0) parts.push(`200×${notes.n200}`);
    if (notes.n100 > 0) parts.push(`100×${notes.n100}`);
    if (notes.n50 > 0)  parts.push(`50×${notes.n50}`);
    if (notes.n20 > 0)  parts.push(`20×${notes.n20}`);
    if (notes.n10 > 0)  parts.push(`10×${notes.n10}`);
    if (notes.coins > 0) parts.push(`Coins: ₹${notes.coins}`);
    if (parts.length === 0) return 'Skipped (Count at EOD)';
    const prefix = direction === 'deducted' ? 'Deducted: ' : 'Added: ';
    return prefix + parts.join(', ');
  };

  // Auto-calculate suggested notes for a given cash total
  const autoCalculateNotes = (total) => {
    let rem = Number(total) || 0;
    const notes = { n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0 };
    if (rem >= 500) { notes.n500 = Math.floor(rem / 500); rem %= 500; }
    if (rem >= 200) { notes.n200 = Math.floor(rem / 200); rem %= 200; }
    if (rem >= 100) { notes.n100 = Math.floor(rem / 100); rem %= 100; }
    if (rem >= 50)  { notes.n50 = Math.floor(rem / 50); rem %= 50; }
    if (rem >= 20)  { notes.n20 = Math.floor(rem / 20); rem %= 20; }
    if (rem >= 10)  { notes.n10 = Math.floor(rem / 10); rem %= 10; }
    if (rem > 0)    { notes.coins = rem; }
    return notes;
  };

  const handleCommissionChosen = (selectedMode) => {
    if (selectedMode === 'udhar' && (!customerName || !customerName.trim())) {
      setErrorMsg('Customer Name is REQUIRED for Udhar (Credit) transactions!');
      return;
    }

    let finalCustomerAmount = 0;
    let finalCashOut = 0;
    const rate = 0.01;
    const comm = Math.round(numAmount * rate * 100) / 100;

    if (txType === 'Credit') {
      if (selectedMode === 'deducted') {
        finalCustomerAmount = numAmount;
        finalCashOut = numAmount - comm;
      } else if (selectedMode === 'cash') {
        finalCustomerAmount = numAmount;
        finalCashOut = numAmount - comm;
      } else if (selectedMode === 'bank') {
        finalCustomerAmount = numAmount + comm;
        finalCashOut = numAmount;
      } else if (selectedMode === 'udhar') {
        finalCustomerAmount = 0;
        finalCashOut = numAmount;
      }
    } else {
      if (selectedMode === 'deducted') {
        finalCustomerAmount = -(numAmount - comm);
        finalCashOut = -numAmount;
      } else if (selectedMode === 'cash') {
        finalCustomerAmount = -numAmount;
        finalCashOut = -(numAmount + comm);
      } else if (selectedMode === 'bank') {
        finalCustomerAmount = -numAmount;
        finalCashOut = -numAmount;
      } else if (selectedMode === 'udhar') {
        finalCustomerAmount = -numAmount;
        finalCashOut = 0;
      }
    }

    const direction = finalCashOut > 0 ? 'deducted' : 'added';
    const targetCash = Math.abs(finalCashOut);

    const pending = {
      mode: selectedMode,
      customerAmount: finalCustomerAmount,
      cashOut: finalCashOut,
      profit: comm,
      direction,
      targetCash
    };

    setPendingTx(pending);

    // If there is physical cash involved, ask user which notes are deducting / adding
    // (with full option to skip now and count at end of day)
    if (targetCash > 0) {
      const suggested = autoCalculateNotes(targetCash);
      setTxNotes(suggested);
      setShowNotesModal(true);
    } else {
      finalizeTransaction(pending, null);
    }
  };

  const finalizeTransaction = async (txInfo, notesBreakdown = null) => {
    setShowNotesModal(false);
    setIsSubmitting(true);

    let noteDetails = 'Skipped (Count at EOD)';
    let notesDirection = null;

    if (notesBreakdown) {
      notesDirection = txInfo.direction;
      noteDetails = formatNoteDetailsStr(notesBreakdown, notesDirection);
    }

    try {
      const result = await onSubmitTransaction({
        bankAccountId: selectedBankId,
        customerAmount: txInfo.customerAmount,
        cashOut: txInfo.cashOut,
        profit: txInfo.profit,
        customerName: customerName ? customerName.trim() : '',
        type: txType,
        commissionMode: txInfo.mode === 'udhar' ? 'Udhar' : txInfo.mode.charAt(0).toUpperCase() + txInfo.mode.slice(1),
        noteDetails,
        notesBreakdown,
        notesDirection
      });

      if (result.success) {
        setSuccessMsg(`Success! Recorded ${txType === 'Credit' ? 'Withdrawal' : 'Deposit'} [${noteDetails}].`);
        setAmount('');
        setCustomerName('');
        setPendingTx(null);
        setTxNotes({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0 });
      } else {
        setErrorMsg(result.error || 'Failed to submit transaction.');
      }
    } catch (err) {
      setErrorMsg('Network error. Check server connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJamaSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!jamaCustomerName.trim()) {
      setErrorMsg('Customer Name is required for Jama (Advance Deposit).');
      return;
    }
    const amt = Number(jamaAmount) || 0;
    if (amt <= 0) {
      setErrorMsg('Please enter a valid Jama amount.');
      return;
    }

    if (!selectedBankId && jamaMethod === 'bank') {
      setErrorMsg('Please select a Bank Account for online Jama.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Jama transaction:
      // If cash: cashIn hand increases (cashOut = -amt), bankAmount = 0
      // If bank: bank currentBalance increases (customerAmount = +amt), cashOut = 0
      const result = await onSubmitTransaction({
        bankAccountId: selectedBankId || accounts[0]?._id,
        customerAmount: jamaMethod === 'bank' ? amt : 0,
        cashOut: jamaMethod === 'cash' ? -amt : 0,
        profit: 0,
        customerName: jamaCustomerName.trim(),
        type: 'Jama',
        commissionMode: 'Jama'
      });

      if (result.success) {
        setSuccessMsg(`Jama of ${formatINR(amt)} for ${jamaCustomerName.trim()} recorded successfully!`);
        setShowJamaModal(false);
        setJamaCustomerName('');
        setJamaAmount('');
      } else {
        setErrorMsg(result.error || 'Failed to record Jama.');
      }
    } catch (err) {
      setErrorMsg('Network error while saving Jama.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 select-none">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" /> New Transaction
          </h2>
          <p className="text-xs text-slate-500">
            Log Cash Withdrawals, Cash Deposits, Udhar, or Jama Advances
          </p>
        </div>

        {activeDay && (
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setSuccessMsg('');
              setShowJamaModal(true);
            }}
            className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" /> Add Jama (Advance)
          </button>
        )}
      </div>

      {!activeDay && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <h4 className="text-xs font-bold text-red-700">Day Summary is Closed</h4>
              <p className="text-[10px] text-red-600">Open the day ledger directly below to begin logging transactions.</p>
            </div>
          </div>
          
          <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-red-200 shadow-2xs">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Opening Cash (₹)"
              value={quickOpeningCash}
              onChange={(e) => setQuickOpeningCash(e.target.value.replace(/[^0-9]/g, ''))}
              className="flex-1 h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:border-blue-600 focus:outline-none font-bold text-slate-900 placeholder:text-slate-400"
            />

            <button
              type="button"
              onClick={() => setShowDenomModal(true)}
              className="h-9 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-all shadow-xs"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-700" /> Notes
            </button>

            <button
              type="button"
              onClick={handleQuickOpen}
              className="h-9 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs"
            >
              Open Day
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col items-center gap-3 shadow-xs">
          <Landmark className="w-8 h-8 text-blue-600" />
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-bold text-slate-800">No Active Bank Accounts</h4>
            <p className="text-[10px] text-slate-500">You must register at least one bank account to route customer transfers.</p>
          </div>
          <button
            onClick={onNavigateToAccounts}
            className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
          >
            Add Bank Account
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Transaction Type Selection Toggle */}
          <div className="flex gap-2 p-1 bg-slate-200/70 rounded-xl border border-slate-200 select-none">
            <button
              type="button"
              onClick={() => {
                setTxType('Credit');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                txType === 'Credit'
                  ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cash Out (Withdraw)
            </button>
            <button
              type="button"
              onClick={() => {
                setTxType('Debit');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                txType === 'Debit'
                  ? 'bg-blue-600 text-white font-extrabold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cash In (Deposit)
            </button>
          </div>

          {/* Main Numeric Amount Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              {txType === 'Credit' ? 'Customer Withdrawal Amount' : 'Customer Deposit Amount'}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter Amount"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setAmount(val);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                disabled={!activeDay}
                className="w-full h-14 text-center text-2xl font-black bg-white border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-slate-900 rounded-xl px-4 focus:outline-none transition-all placeholder:text-slate-300 disabled:opacity-50 shadow-xs"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">
                INR
              </span>
            </div>
          </div>

          {/* Customer Name Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Customer Name {commissionMode === 'udhar' ? '(REQUIRED for Udhar)' : '(Optional)'}
              </label>
            </div>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={!activeDay}
              className={`w-full h-11 bg-white border ${commissionMode === 'udhar' ? 'border-red-400' : 'border-slate-300'} focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-slate-900 rounded-xl px-4 focus:outline-none text-xs transition-all placeholder:text-slate-400 disabled:opacity-50 font-bold shadow-xs`}
            />
          </div>

          {/* Bank Selection horizontal slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                {txType === 'Credit' ? 'Receiving Bank Account' : 'Debited Bank Account'}
              </label>
              <span className="text-[10px] text-slate-400">Swipe to view</span>
            </div>
            <div className="flex overflow-x-auto gap-2 py-1 snap-x no-scrollbar scroll-smooth">
              {accounts.map((acc) => {
                const isSelected = selectedBankId === acc._id;
                return (
                  <button
                    key={acc._id}
                    type="button"
                    onClick={() => {
                      setSelectedBankId(acc._id);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className={`snap-center flex-shrink-0 min-w-[110px] p-3 rounded-xl border flex flex-col gap-1 text-left transition-all shadow-xs ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold truncate w-full">{acc.bankName}</span>
                    <span className={`text-[10px] font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-400'}`}>
                      {formatINR(acc.currentBalance)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto Calculation Live Breakdown Engine */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-blue-600" /> Transaction Ledger Impact
            </h3>
            
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Cash Impact */}
              {txType === 'Credit' ? (
                <div className="flex flex-col bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-left">
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-red-600" /> Cash Payout
                  </span>
                  <span className="text-lg font-black text-red-600 tracking-tight mt-0.5">
                    {formatINR(commissionMode === 'deducted' ? numAmount - commission : numAmount)}
                  </span>
                  <span className="text-[8px] text-slate-500 leading-tight">
                    {commissionMode === 'deducted' && `Gave ₹${numAmount - commission} (₹10 cut)`}
                    {commissionMode === 'cash' && `Gave ₹${numAmount} cash. Customer paid ₹${commission} extra cash.`}
                    {commissionMode === 'bank' && `Gave ₹${numAmount} cash.`}
                    {commissionMode === 'udhar' && `Gave ₹${numAmount} cash on UDHAR.`}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-left">
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-emerald-600" /> Cash In drawer
                  </span>
                  <span className="text-lg font-black text-emerald-600 tracking-tight mt-0.5">
                    {formatINR(commissionMode === 'cash' ? numAmount + commission : (commissionMode === 'udhar' ? 0 : numAmount))}
                  </span>
                  <span className="text-[8px] text-slate-500 leading-tight">
                    {commissionMode === 'deducted' && `Received ₹${numAmount} cash.`}
                    {commissionMode === 'cash' && `Received ₹${numAmount} + ₹${commission} extra cash.`}
                    {commissionMode === 'bank' && `Received ₹${numAmount} cash.`}
                    {commissionMode === 'udhar' && `Service given on UDHAR (no cash received now).`}
                  </span>
                </div>
              )}

              {/* Bank Impact */}
              {txType === 'Credit' ? (
                <div className="flex flex-col bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-left">
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-blue-600" /> Bank Balance Added
                  </span>
                  <span className="text-lg font-black text-blue-700 tracking-tight mt-0.5">
                    {formatINR(commissionMode === 'bank' ? numAmount + commission : (commissionMode === 'udhar' ? 0 : numAmount))}
                  </span>
                  <span className="text-[8px] text-slate-500 leading-tight">
                    {commissionMode === 'bank' && `Transferred ₹${numAmount + commission}`}
                    {commissionMode === 'udhar' && `Customer will pay later (UDHAR)`}
                    {commissionMode !== 'bank' && commissionMode !== 'udhar' && `Transferred ₹${numAmount}`}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-left">
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-red-600" /> Bank Balance Debited
                  </span>
                  <span className="text-lg font-black text-red-600 tracking-tight mt-0.5">
                    {formatINR(commissionMode === 'deducted' ? numAmount - commission : numAmount)}
                  </span>
                  <span className="text-[8px] text-slate-500 leading-tight">
                    {commissionMode === 'deducted' && `Sent ₹${numAmount - commission} from bank`}
                    {commissionMode !== 'deducted' && `Sent ₹${numAmount} from bank`}
                  </span>
                </div>
              )}
            </div>

            {/* Profit Bar */}
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex justify-between items-center shadow-2xs">
              <span className="text-[9px] text-emerald-800 font-bold uppercase tracking-wide">Net Commission Profit</span>
              <span className="text-sm font-black text-emerald-700">{formatINR(commission)}</span>
            </div>
          </div>

          {/* Payment / Commission Mode Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
              Payment & Commission Handling
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'deducted', label: 'Deducted', desc: 'Cut 1% from Payout' },
                { id: 'cash', label: 'Extra Cash', desc: 'Customer Pays Cash' },
                { id: 'bank', label: 'Extra Online', desc: 'Transfers to Bank' },
                { id: 'udhar', label: 'UDHAR (Credit)', desc: 'Unpaid / Pay Later' }
              ].map(mode => {
                const isActive = commissionMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      setCommissionMode(mode.id);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center text-center gap-0.5 transition-all shadow-xs ${
                      isActive
                        ? mode.id === 'udhar'
                          ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold'
                          : 'bg-blue-50 border-blue-500 text-blue-900 font-bold'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xs font-bold">{mode.label}</span>
                    <span className="text-[7.5px] font-semibold text-slate-400 truncate w-full">{mode.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Notifications */}
          {errorMsg && (
            <div className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Submit Button */}
          <button
            type="submit"
            disabled={!activeDay || accounts.length === 0 || numAmount <= 0 || isSubmitting}
            className={`w-full h-12 rounded-xl font-bold text-sm tracking-wide shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 ${
              commissionMode === 'udhar'
                ? 'bg-rose-600 hover:bg-rose-700 text-white font-extrabold'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              commissionMode === 'udhar' ? 'Confirm UDHAR (Credit Entry)' : 'Confirm Transaction'
            )}
          </button>
        </form>
      )}

      {/* Physical Notes Deducting / Adding Modal (with Skip Now option) */}
      {showNotesModal && pendingTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 select-none">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-3.5 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto no-scrollbar">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border ${pendingTx.direction === 'deducted' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">
                    {pendingTx.direction === 'deducted' ? '💸 Cash Out: Which Notes Giving?' : '💵 Cash In: Which Notes Receiving?'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {pendingTx.direction === 'deducted' ? 'Deducting physical cash from drawer' : 'Adding physical cash into drawer'}
                  </p>
                </div>
              </div>
            </div>

            {/* Target vs Counted Banner */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between ${
              computeNotesTotal(txNotes) === pendingTx.targetCash
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-70">
                  Target Physical Cash:
                </span>
                <span className="text-base font-black">
                  {formatINR(pendingTx.targetCash)}
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-[9px] uppercase font-bold tracking-wider opacity-70">
                  Notes Counted:
                </span>
                <span className="text-base font-black">
                  {formatINR(computeNotesTotal(txNotes))}
                </span>
              </div>
            </div>

            {/* Status Match Pill */}
            <div className="flex justify-between items-center text-[10px] px-1 font-bold">
              {computeNotesTotal(txNotes) === pendingTx.targetCash ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Exact Match: {formatINR(pendingTx.targetCash)}
                </span>
              ) : (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Difference: {formatINR(Math.abs(pendingTx.targetCash - computeNotesTotal(txNotes)))}
                  {computeNotesTotal(txNotes) > pendingTx.targetCash ? ' over' : ' remaining'}
                </span>
              )}

              <button
                type="button"
                onClick={() => setTxNotes(autoCalculateNotes(pendingTx.targetCash))}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline"
              >
                Auto-Fill Exact Notes
              </button>
            </div>

            {/* Denomination Notes Row List */}
            <div className="flex flex-col gap-1.5 max-h-[36vh] overflow-y-auto no-scrollbar">
              {[
                { key: 'n500', label: '₹500', value: 500, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { key: 'n200', label: '₹200', value: 200, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { key: 'n100', label: '₹100', value: 100, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { key: 'n50',  label: '₹50',  value: 50,  color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                { key: 'n20',  label: '₹20',  value: 20,  color: 'text-orange-700 bg-orange-50 border-orange-200' },
                { key: 'n10',  label: '₹10',  value: 10,  color: 'text-purple-700 bg-purple-50 border-purple-200' },
              ].map(note => {
                const count = txNotes[note.key] || 0;
                return (
                  <div key={note.key} className="flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${note.color} w-14 text-center`}>
                      {note.label}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTxNotes(prev => ({ ...prev, [note.key]: Math.max(0, (prev[note.key] || 0) - 1) }))}
                        className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-xs flex items-center justify-center text-slate-700 active:scale-95 shadow-2xs"
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={count === 0 ? '' : count}
                        placeholder="0"
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0);
                          setTxNotes(prev => ({ ...prev, [note.key]: val }));
                        }}
                        className="w-12 h-7 text-center text-xs font-black bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setTxNotes(prev => ({ ...prev, [note.key]: (prev[note.key] || 0) + 1 }))}
                        className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-bold text-xs flex items-center justify-center text-slate-700 active:scale-95 shadow-2xs"
                      >
                        +
                      </button>
                    </div>

                    <span className="w-16 text-right text-xs font-black text-slate-800">
                      {formatINR(count * note.value)}
                    </span>
                  </div>
                );
              })}

              {/* Coins & Loose */}
              <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-800 border-amber-200 w-14 text-center">
                  Coins
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-bold">₹</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={txNotes.coins === 0 ? '' : txNotes.coins}
                    placeholder="0"
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0);
                      setTxNotes(prev => ({ ...prev, coins: val }));
                    }}
                    className="w-20 h-7 text-center text-xs font-black bg-white border border-slate-300 rounded-lg text-amber-800 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <span className="w-16 text-right text-xs font-black text-slate-800">
                  {formatINR(txNotes.coins || 0)}
                </span>
              </div>
            </div>

            {/* Action Buttons: Confirm Notes vs Skip Now */}
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => finalizeTransaction(pendingTx, txNotes)}
                disabled={isSubmitting}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                {pendingTx.direction === 'deducted' ? 'Confirm Deducting Notes & Save' : 'Confirm Adding Notes & Save'}
              </button>

              {/* Crucial: Skip Now and Count at End of Day option */}
              <button
                type="button"
                onClick={() => finalizeTransaction(pendingTx, null)}
                disabled={isSubmitting}
                className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] border border-amber-300 rounded-xl text-amber-900 flex flex-col items-center justify-center transition-all shadow-xs"
              >
                <span className="text-xs font-extrabold flex items-center gap-1">
                  ⏭️ Skip Now (Count at End of Day / Close Ledger)
                </span>
                <span className="text-[9px] text-amber-700 font-medium">
                  Drawer total will adjust; count notes when closing ledger
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowNotesModal(false);
                  setPendingTx(null);
                }}
                className="w-full py-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold transition-all text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Denomination Note Calculator Modal */}
      <DenominationModal
        isOpen={showDenomModal}
        onClose={() => setShowDenomModal(false)}
        initialDenominations={quickDenoms}
        onSave={(totalCash, denoms) => {
          setQuickOpeningCash(String(totalCash));
          setQuickDenoms(denoms);
        }}
        title="Opening Cash Denominations"
      />

      {/* Jama (Advance Deposit) Modal */}
      {showJamaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleJamaSubmit} className="bg-white border border-slate-200 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-4 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-600">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800">Record JAMA (Advance)</h3>
                  <p className="text-[10px] text-slate-400">Customer advance deposit for future services</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Customer Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={jamaCustomerName}
                onChange={(e) => setJamaCustomerName(e.target.value)}
                className="w-full h-11 bg-white border border-slate-300 text-slate-900 rounded-xl px-3 text-xs font-bold focus:border-emerald-600 focus:outline-none shadow-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Jama Deposit Amount (₹) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                placeholder="Enter Jama Amount"
                value={jamaAmount}
                onChange={(e) => setJamaAmount(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full h-12 bg-white border border-slate-300 text-emerald-600 font-black text-xl text-center rounded-xl px-3 focus:border-emerald-600 focus:outline-none shadow-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Deposit Received Via
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setJamaMethod('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                    jamaMethod === 'cash'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Cash In Hand
                </button>
                <button
                  type="button"
                  onClick={() => setJamaMethod('bank')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                    jamaMethod === 'bank'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Bank Deposit
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowJamaModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md"
              >
                Save Jama
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

