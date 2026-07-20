import React, { useState, useEffect } from 'react';
import { Landmark, ArrowRightLeft, DollarSign, Wallet, Percent, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, HelpCircle, Calculator, PlusCircle, UserCheck } from 'lucide-react';
import DenominationModal from './DenominationModal';

export default function TransactionForm({ activeDay, accounts, onSubmitTransaction, onNavigateToAccounts, onOpenDay }) {
  const [amount, setAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommModal, setShowCommModal] = useState(false);
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

    // Pass validations, prompt user to confirm the commission mode
    setShowCommModal(true);
  };

  const confirmAndSubmitTransaction = async (selectedMode) => {
    setShowCommModal(false);
    setIsSubmitting(true);

    if (selectedMode === 'udhar' && (!customerName || !customerName.trim())) {
      setErrorMsg('Customer Name is REQUIRED for Udhar (Credit) transactions!');
      setIsSubmitting(false);
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
        finalCustomerAmount = 0; // Customer owes money
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

    try {
      const result = await onSubmitTransaction({
        bankAccountId: selectedBankId,
        customerAmount: finalCustomerAmount,
        cashOut: finalCashOut,
        profit: comm,
        customerName: customerName ? customerName.trim() : '',
        type: txType,
        commissionMode: selectedMode === 'udhar' ? 'Udhar' : selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)
      });
      
      if (result.success) {
        setSuccessMsg(`Success! Recorded ${txType === 'Credit' ? 'Withdrawal' : 'Deposit'} [Mode: ${selectedMode.toUpperCase()}].`);
        setAmount('');
        setCustomerName('');
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
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-400" /> New Transaction
          </h2>
          <p className="text-xs text-slate-400">
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
            className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Add Jama (Advance)
          </button>
        )}
      </div>

      {!activeDay && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <h4 className="text-xs font-bold text-red-400">Day Summary is Closed</h4>
              <p className="text-[10px] text-slate-300">Open the day ledger directly below to begin logging transactions.</p>
            </div>
          </div>
          
          <div className="flex gap-2 items-center bg-slate-950/60 p-2 rounded-xl border border-slate-900">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Opening Cash (₹)"
              value={quickOpeningCash}
              onChange={(e) => setQuickOpeningCash(e.target.value.replace(/[^0-9]/g, ''))}
              className="flex-1 h-9 px-2 text-xs bg-slate-900 border border-slate-800 rounded-lg focus:border-amber-500 focus:outline-none font-bold text-slate-100 placeholder:text-slate-600"
            />

            <button
              type="button"
              onClick={() => setShowDenomModal(true)}
              className="h-9 px-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-all"
            >
              <Calculator className="w-3.5 h-3.5" /> Notes
            </button>

            <button
              type="button"
              onClick={handleQuickOpen}
              className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-slate-100 text-xs font-bold rounded-lg transition-all"
            >
              Open Day
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center gap-3">
          <Landmark className="w-8 h-8 text-slate-500" />
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-bold text-slate-300">No Active Bank Accounts</h4>
            <p className="text-[10px] text-slate-500">You must register at least one bank account to route customer transfers.</p>
          </div>
          <button
            onClick={onNavigateToAccounts}
            className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all"
          >
            Add Bank Account
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Transaction Type Selection Toggle */}
          <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-900 select-none">
            <button
              type="button"
              onClick={() => {
                setTxType('Credit');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                txType === 'Credit'
                  ? 'bg-amber-400 text-slate-950 font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
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
                  ? 'bg-amber-400 text-slate-950 font-extrabold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cash In (Deposit)
            </button>
          </div>

          {/* Main Numeric Amount Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
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
                className="w-full h-14 text-center text-2xl font-extrabold bg-slate-900 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-100 rounded-xl px-4 focus:outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-500">
                INR
              </span>
            </div>
          </div>

          {/* Customer Name Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Customer Name {commissionMode === 'udhar' ? '(REQUIRED for Udhar)' : '(Optional)'}
              </label>
            </div>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={!activeDay}
              className={`w-full h-11 bg-slate-900 border ${commissionMode === 'udhar' ? 'border-red-500/50' : 'border-slate-800'} focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-100 rounded-xl px-4 focus:outline-none text-xs transition-all placeholder:text-slate-600 disabled:opacity-50 font-bold`}
            />
          </div>

          {/* Bank Selection horizontal slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                {txType === 'Credit' ? 'Receiving Bank Account' : 'Debited Bank Account'}
              </label>
              <span className="text-[10px] text-slate-500">Swipe to view</span>
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
                    className={`snap-center flex-shrink-0 min-w-[110px] p-3 rounded-xl border flex flex-col gap-1 text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.15)] text-slate-100'
                        : 'bg-slate-900/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="text-xs font-bold truncate w-full">{acc.bankName}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-amber-300 font-semibold' : 'text-slate-500'}`}>
                      {formatINR(acc.currentBalance)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto Calculation Live Breakdown Engine */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-slate-400" /> Transaction Ledger Impact
            </h3>
            
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Cash Impact */}
              {txType === 'Credit' ? (
                <div className="flex flex-col bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-left">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-red-400" /> Physical Cash Payout
                  </span>
                  <span className="text-lg font-bold text-red-400 tracking-tight mt-0.5">
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
                <div className="flex flex-col bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-left">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Wallet className="w-3 h-3 text-emerald-400" /> Physical Cash In drawer
                  </span>
                  <span className="text-lg font-bold text-emerald-400 tracking-tight mt-0.5">
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
                <div className="flex flex-col bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-left">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" /> Bank Balance Added
                  </span>
                  <span className="text-lg font-bold text-emerald-400 tracking-tight mt-0.5">
                    {formatINR(commissionMode === 'bank' ? numAmount + commission : (commissionMode === 'udhar' ? 0 : numAmount))}
                  </span>
                  <span className="text-[8px] text-slate-500 leading-tight">
                    {commissionMode === 'bank' && `Transferred ₹${numAmount + commission}`}
                    {commissionMode === 'udhar' && `Customer will pay later (UDHAR)`}
                    {commissionMode !== 'bank' && commissionMode !== 'udhar' && `Transferred ₹${numAmount}`}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl text-left">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-red-400" /> Bank Balance Debited
                  </span>
                  <span className="text-lg font-bold text-red-400 tracking-tight mt-0.5">
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
            <div className="bg-slate-950/30 border border-slate-900 px-3 py-2 rounded-xl flex justify-between items-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Net Commission Profit</span>
              <span className="text-sm font-bold text-emerald-400">{formatINR(commission)}</span>
            </div>
          </div>

          {/* Payment / Commission Mode Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
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
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center text-center gap-0.5 transition-all ${
                      isActive
                        ? mode.id === 'udhar'
                          ? 'bg-red-500/10 border-red-400 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                          : 'bg-amber-500/10 border-amber-400 text-slate-100 shadow-[0_0_8px_rgba(251,191,36,0.15)]'
                        : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold">{mode.label}</span>
                    <span className="text-[7.5px] font-semibold text-slate-500 truncate w-full">{mode.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Notifications */}
          {errorMsg && (
            <div className="text-xs font-semibold text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Submit Button */}
          <button
            type="submit"
            disabled={!activeDay || accounts.length === 0 || numAmount <= 0 || isSubmitting}
            className={`w-full h-12 rounded-xl font-bold text-sm tracking-wide shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 ${
              commissionMode === 'udhar'
                ? 'bg-red-500 hover:bg-red-600 text-slate-950 font-extrabold'
                : 'bg-amber-400 hover:bg-amber-500 text-slate-950'
            }`}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              commissionMode === 'udhar' ? 'Confirm UDHAR (Credit Entry)' : 'Confirm Transaction'
            )}
          </button>
        </form>
      )}

      {/* Confirmation Modal */}
      {showCommModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto p-3 bg-amber-500/10 rounded-full border border-amber-500/20 w-fit">
              <HelpCircle className="w-6 h-6 text-amber-400" />
            </div>
            
            <div>
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Confirm Payment Method</h3>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                For this <span className="text-slate-200 font-bold">{formatINR(numAmount)}</span> {txType === 'Credit' ? 'Withdrawal' : 'Deposit'}, confirm how payment/commission is settled:
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              <button
                type="button"
                onClick={() => confirmAndSubmitTransaction('deducted')}
                className="w-full py-2.5 px-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex justify-between items-center text-left transition-all"
              >
                <span className="text-xs font-bold text-slate-100">1. Deducted (Cut Payout)</span>
                <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Deducted</span>
              </button>

              <button
                type="button"
                onClick={() => confirmAndSubmitTransaction('cash')}
                className="w-full py-2.5 px-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 rounded-2xl flex justify-between items-center text-left transition-all"
              >
                <span className="text-xs font-bold text-slate-100">2. Extra Cash Paid</span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">Cash</span>
              </button>

              <button
                type="button"
                onClick={() => confirmAndSubmitTransaction('bank')}
                className="w-full py-2.5 px-3.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 rounded-2xl flex justify-between items-center text-left transition-all"
              >
                <span className="text-xs font-bold text-slate-100">3. Paid via Online Bank</span>
                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">Bank</span>
              </button>

              <button
                type="button"
                onClick={() => confirmAndSubmitTransaction('udhar')}
                className="w-full py-2.5 px-3.5 bg-red-950/40 hover:bg-red-900/50 border border-red-500/30 rounded-2xl flex justify-between items-center text-left transition-all"
              >
                <span className="text-xs font-bold text-red-200">4. Mark as UDHAR (Credit)</span>
                <span className="text-[9px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded">Udhar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCommModal(false)}
              className="w-full py-2.5 mt-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl transition-all border border-slate-700"
            >
              Cancel
            </button>
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
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleJamaSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm flex flex-col gap-4 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-150 select-none">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">Record JAMA (Advance)</h3>
                  <p className="text-[10px] text-slate-400">Customer advance deposit for future services</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Customer Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={jamaCustomerName}
                onChange={(e) => setJamaCustomerName(e.target.value)}
                className="w-full h-11 bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-3 text-xs font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
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
                className="w-full h-12 bg-slate-950 border border-slate-800 text-emerald-400 font-extrabold text-xl text-center rounded-xl px-3 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Deposit Received Via
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setJamaMethod('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    jamaMethod === 'cash'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Cash In Hand
                </button>
                <button
                  type="button"
                  onClick={() => setJamaMethod('bank')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    jamaMethod === 'bank'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
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
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-md"
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

