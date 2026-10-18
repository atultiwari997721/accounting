import React, { useState, useMemo } from 'react';
import { IndianRupee, Wallet, Landmark, TrendingUp, Calendar, AlertTriangle, ArrowUpRight, ClipboardList, Edit2, Check, X, Calculator } from 'lucide-react';
import DenominationModal from './DenominationModal';

export default function Dashboard({ activeDay, accounts, transactions, onNavigateToAddTx, onAdjustCash }) {
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [editCashVal, setEditCashVal] = useState('');
  const [savingCash, setSavingCash] = useState(false);
  const [showDenomModal, setShowDenomModal] = useState(false);

  // Memoized calculations for ultra-fast performance
  const { totalBankBalance, cashInHand, todayProfit, openingCash, totalAssets, cashPercentage, bankPercentage, totalUdhar, totalJama } = useMemo(() => {
    const totalBank = (accounts || []).reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
    const cash = activeDay ? activeDay.closingCash : 0;
    const profit = activeDay ? activeDay.totalProfit : 0;
    const openCash = activeDay ? activeDay.openingCash : 0;
    const assets = cash + totalBank;
    const cPct = assets > 0 ? (cash / assets) * 100 : 0;
    const bPct = assets > 0 ? (totalBank / assets) * 100 : 0;

    let udharSum = 0;
    let jamaSum = 0;
    (transactions || []).forEach(tx => {
      if (tx.commissionMode === 'Udhar') {
        udharSum += Math.abs(tx.cashOut || tx.customerAmount || 0);
      }
      if (tx.type === 'Jama' || tx.commissionMode === 'Jama') {
        jamaSum += Math.abs(tx.customerAmount || tx.cashOut || 0);
      }
    });

    return {
      totalBankBalance: totalBank,
      cashInHand: cash,
      todayProfit: profit,
      openingCash: openCash,
      totalAssets: assets,
      cashPercentage: cPct,
      bankPercentage: bPct,
      totalUdhar: udharSum,
      totalJama: jamaSum
    };
  }, [accounts, activeDay, transactions]);

  const formatINR = (num) => '₹' + Number(num || 0).toLocaleString('en-IN');

  const denoms = activeDay?.cashDenominations || null;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 select-none">
      {/* Day Status Banner */}
      {!activeDay ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-2 shadow-xs">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="font-bold text-sm">Ledger is Currently Closed</h3>
          </div>
          <p className="text-xs text-red-700/80">
            You must open the day in Settings/Backup or Passbook tab to enable recording transactions and tracking cash balances.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-700">Active Session: {activeDay.date}</span>
          </div>
          <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
            OPENED
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="flex flex-col gap-3">
        {/* Cash In Hand Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-amber-600" /> Cash In Hand
                {activeDay && (
                  <button
                    type="button"
                    onClick={() => setShowDenomModal(true)}
                    className="text-[10px] bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 transition-all ml-1 shadow-xs"
                    title="Open Physical Note Counter"
                  >
                    <Calculator className="w-3 h-3" /> Count Notes
                  </button>
                )}
                {activeDay && !isEditingCash && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditCashVal(String(cashInHand));
                      setIsEditingCash(true);
                    }}
                    className="text-slate-400 hover:text-amber-600 p-1"
                    title="Quick number edit"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </span>
              {isEditingCash ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={editCashVal}
                    onChange={(e) => setEditCashVal(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-28 h-8 px-2 text-sm font-bold bg-white border border-slate-300 text-slate-900 rounded focus:outline-none focus:border-blue-600 shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setSavingCash(true);
                      await onAdjustCash(Number(editCashVal) || 0);
                      setIsEditingCash(false);
                      setSavingCash(false);
                    }}
                    disabled={savingCash}
                    className="p-1.5 bg-blue-600 rounded text-white hover:bg-blue-700 shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingCash(false)}
                    className="p-1.5 bg-slate-200 rounded text-slate-600 hover:text-slate-800"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span 
                  onClick={() => activeDay && setShowDenomModal(true)}
                  className="text-3xl font-black tracking-tight text-amber-600 cursor-pointer hover:opacity-90 transition-all"
                  title="Click to count notes"
                >
                  {formatINR(cashInHand)}
                </span>
              )}
              {activeDay && (
                <span className="text-[10px] text-slate-400 font-medium">
                  Opening Cash: {formatINR(openingCash)}
                </span>
              )}
            </div>
            <div 
              onClick={() => activeDay && setShowDenomModal(true)}
              className="p-3 bg-amber-50 rounded-2xl border border-amber-200 cursor-pointer hover:bg-amber-100 transition-all shadow-xs"
              title="Click to count notes & coins"
            >
              <IndianRupee className="w-6 h-6 text-amber-600" />
            </div>
          </div>

          {/* Note breakdown quick preview if available */}
          {denoms && (denoms.n500 > 0 || denoms.n200 > 0 || denoms.n100 > 0 || denoms.n50 > 0 || denoms.n20 > 0 || denoms.n10 > 0 || denoms.coins > 0) && (
            <div 
              onClick={() => setShowDenomModal(true)}
              className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 cursor-pointer hover:opacity-90 transition-all"
              title="Click to adjust note denominations"
            >
              {denoms.n500 > 0 && <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">500×{denoms.n500}</span>}
              {denoms.n200 > 0 && <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md font-bold">200×{denoms.n200}</span>}
              {denoms.n100 > 0 && <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-bold">100×{denoms.n100}</span>}
              {denoms.n50 > 0 && <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">50×{denoms.n50}</span>}
              {denoms.n20 > 0 && <span className="text-[9px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-md font-bold">20×{denoms.n20}</span>}
              {denoms.n10 > 0 && <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold">10×{denoms.n10}</span>}
              {denoms.coins > 0 && <span className="text-[9px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-md font-bold">Coins: {formatINR(denoms.coins)}</span>}
            </div>
          )}
        </div>

        {/* Udhar & Jama Summary Bar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex flex-col gap-0.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-rose-700 tracking-wider">Pending UDHAR</span>
            <span className="text-xl font-black text-rose-700">{formatINR(totalUdhar)}</span>
            <span className="text-[9px] text-slate-500">Uncollected credit</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex flex-col gap-0.5 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-emerald-700 tracking-wider">Customer JAMA</span>
            <span className="text-xl font-black text-emerald-700">{formatINR(totalJama)}</span>
            <span className="text-[9px] text-slate-500">Advance deposits</span>
          </div>
        </div>

        {/* Total Bank Balances Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between z-10">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-blue-600" /> Total Bank Balances
              </span>
              <span className="text-3xl font-black tracking-tight text-blue-900">
                {formatINR(totalBankBalance)}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Active Accounts: {accounts.length}
              </span>
            </div>
            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 shadow-xs">
              <Landmark className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          {/* Individual Bank Accounts Breakdown */}
          {accounts.length > 0 && (
            <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Individual Bank Balances</span>
              <div className="grid grid-cols-2 gap-2">
                {accounts.map(acc => (
                  <div key={acc._id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-[10px] shadow-2xs">
                    <span className="font-semibold text-slate-700 truncate max-w-[80px]">{acc.bankName}</span>
                    <span className="font-bold text-blue-700">{formatINR(acc.currentBalance)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Today's Profit Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Today's Net Profit
            </span>
            <span className="text-3xl font-black tracking-tight text-emerald-600">
              {formatINR(todayProfit)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              1% commission model
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-xs">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Clean Assets Visualisation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Cash vs Bank Balance</h3>
        <div className="w-full h-3 bg-slate-100 rounded-full flex overflow-hidden">
          <div
            style={{ width: `${cashPercentage}%` }}
            className="h-full bg-amber-500 rounded-l-full transition-all duration-500"
          />
          <div
            style={{ width: `${bankPercentage}%` }}
            className="h-full bg-blue-600 rounded-r-full transition-all duration-500"
          />
        </div>
        <div className="flex justify-between items-center text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-amber-700">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Cash ({Math.round(cashPercentage)}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-700">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Bank ({Math.round(bankPercentage)}%)</span>
          </div>
        </div>
      </div>

      {/* Action Button & Recent Transactions */}
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-slate-500" /> Recent Transactions
          </h3>
          {activeDay && (
            <button
              onClick={onNavigateToAddTx}
              className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
            >
              Add New <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-xs flex flex-col gap-1.5 shadow-xs">
            <p>No transactions registered for the day.</p>
            {activeDay && (
              <p className="text-blue-600 font-semibold">Tap "Add New" to track your first withdraw transfer.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto no-scrollbar">
            {transactions.slice(0, 5).map((tx) => {
              const bankName = tx.bankAccountId?.bankName || 'Deleted Bank';
              return (
                <div key={tx._id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center shadow-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-800">{bankName}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-right flex flex-col gap-0.5">
                    <span className={`text-xs font-black ${tx.customerAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.customerAmount >= 0 ? '+' : ''}{formatINR(tx.customerAmount)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {tx.type === 'Debit' ? 'Cash In' : 'Cash Out'}: {formatINR(Math.abs(tx.cashOut))} | Profit: {formatINR(tx.profit)} ({tx.commissionMode || 'Deducted'})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Note & Coin Calculator Modal for Dashboard */}
      <DenominationModal
        isOpen={showDenomModal}
        onClose={() => setShowDenomModal(false)}
        initialDenominations={denoms}
        onSave={(totalCash, updatedDenoms) => {
          if (onAdjustCash) {
            onAdjustCash(totalCash, updatedDenoms);
          }
        }}
        title="Physical Cash & Note Counter"
      />
    </div>
  );
}
