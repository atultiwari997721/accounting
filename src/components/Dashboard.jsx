import React, { useState, useMemo } from 'react';
import { IndianRupee, Wallet, Landmark, TrendingUp, Calendar, AlertTriangle, ArrowUpRight, ClipboardList, Edit2, Check, X } from 'lucide-react';

export default function Dashboard({ activeDay, accounts, transactions, onNavigateToAddTx, onAdjustCash }) {
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [editCashVal, setEditCashVal] = useState('');
  const [savingCash, setSavingCash] = useState(false);

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
    <div className="flex flex-col gap-5 px-4 pt-4 select-none">
      {/* Day Status Banner */}
      {!activeDay ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="font-bold text-sm">Ledger is Currently Closed</h3>
          </div>
          <p className="text-xs text-slate-300">
            You must open the day in Settings/Backup tab to enable recording transactions and tracking cash balances.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-300">Active Session: {activeDay.date}</span>
          </div>
          <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
            OPENED
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="flex flex-col gap-3">
        {/* Cash In Hand Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-amber-400" /> Cash In Hand
                {activeDay && !isEditingCash && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditCashVal(String(cashInHand));
                      setIsEditingCash(true);
                    }}
                    className="text-slate-500 hover:text-amber-400 p-1"
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
                    className="w-28 h-8 px-2 text-sm font-bold bg-slate-950 border border-slate-750 text-slate-100 rounded focus:outline-none focus:border-amber-400"
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
                    className="p-1 bg-amber-500 rounded text-slate-950 hover:bg-amber-400"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingCash(false)}
                    className="p-1 bg-slate-800 rounded text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-3xl font-extrabold tracking-tight text-amber-400">
                  {formatINR(cashInHand)}
                </span>
              )}
              {activeDay && (
                <span className="text-[10px] text-slate-500">
                  Opening Cash: {formatINR(openingCash)}
                </span>
              )}
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <IndianRupee className="w-6 h-6 text-amber-400" />
            </div>
          </div>

          {/* Note breakdown quick preview if available */}
          {denoms && (denoms.n500 > 0 || denoms.n200 > 0 || denoms.n100 > 0 || denoms.n50 > 0 || denoms.n20 > 0 || denoms.n10 > 0 || denoms.coins > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/80">
              {denoms.n500 > 0 && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">500×{denoms.n500}</span>}
              {denoms.n200 > 0 && <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-bold">200×{denoms.n200}</span>}
              {denoms.n100 > 0 && <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold">100×{denoms.n100}</span>}
              {denoms.n50 > 0 && <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-bold">50×{denoms.n50}</span>}
              {denoms.n20 > 0 && <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-md font-bold">20×{denoms.n20}</span>}
              {denoms.n10 > 0 && <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-md font-bold">10×{denoms.n10}</span>}
              {denoms.coins > 0 && <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-md font-bold">Coins: {formatINR(denoms.coins)}</span>}
            </div>
          )}
        </div>

        {/* Udhar & Jama Summary Bar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-3 flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase text-red-400 tracking-wider">Total Pending UDHAR</span>
            <span className="text-xl font-extrabold text-red-300">{formatINR(totalUdhar)}</span>
            <span className="text-[9px] text-slate-500">Uncollected customer credit</span>
          </div>

          <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-3 flex flex-col gap-0.5">
            <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Total Customer JAMA</span>
            <span className="text-xl font-extrabold text-emerald-300">{formatINR(totalJama)}</span>
            <span className="text-[9px] text-slate-500">Advance customer deposits</span>
          </div>
        </div>

        {/* Total Bank Balances Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          
          <div className="flex items-center justify-between z-10">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5 text-emerald-400" /> Total Bank Balances
              </span>
              <span className="text-3xl font-extrabold tracking-tight text-emerald-400">
                {formatINR(totalBankBalance)}
              </span>
              <span className="text-[10px] text-slate-500">
                Active Accounts: {accounts.length}
              </span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Landmark className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Individual Bank Accounts Breakdown */}
          {accounts.length > 0 && (
            <div className="flex flex-col gap-2 pt-3 border-t border-slate-800/80 z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Individual Bank Balances</span>
              <div className="grid grid-cols-2 gap-2">
                {accounts.map(acc => (
                  <div key={acc._id} className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/80 flex justify-between items-center text-[10px]">
                    <span className="font-semibold text-slate-300 truncate max-w-[80px]">{acc.bankName}</span>
                    <span className="font-bold text-emerald-400">{formatINR(acc.currentBalance)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Today's Profit Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Today's Net Profit
            </span>
            <span className="text-3xl font-extrabold tracking-tight text-cyan-400">
              {formatINR(todayProfit)}
            </span>
            <span className="text-[10px] text-slate-500">
              1% commission model
            </span>
          </div>
          <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Clean Assets Visualisation */}
      <div className="bg-slate-900/50 border border-slate-800/60 rounded-2xl p-4 flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Cash vs Bank Balance</h3>
        <div className="w-full h-3 bg-slate-800 rounded-full flex overflow-hidden">
          <div
            style={{ width: `${cashPercentage}%` }}
            className="h-full bg-amber-400 rounded-l-full transition-all duration-500"
          />
          <div
            style={{ width: `${bankPercentage}%` }}
            className="h-full bg-emerald-400 rounded-r-full transition-all duration-500"
          />
        </div>
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 text-amber-400">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Cash ({Math.round(cashPercentage)}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Bank ({Math.round(bankPercentage)}%)</span>
          </div>
        </div>
      </div>

      {/* Action Button & Recent Transactions */}
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-slate-400" /> Recent Transactions
          </h3>
          {activeDay && (
            <button
              onClick={onNavigateToAddTx}
              className="text-xs font-semibold text-amber-400 flex items-center gap-1"
            >
              Add New <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="bg-slate-900/30 border border-slate-800/40 rounded-2xl p-6 text-center text-slate-500 text-xs flex flex-col gap-1.5">
            <p>No transactions registered for the day.</p>
            {activeDay && (
              <p className="text-amber-400/80 font-medium">Tap "Add New" to track your first withdraw transfer.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto no-scrollbar">
            {transactions.slice(0, 5).map((tx) => {
              const bankName = tx.bankAccountId?.bankName || 'Deleted Bank';
              return (
                <div key={tx._id} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex justify-between items-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-200">{bankName}</span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-right flex flex-col gap-0.5">
                    <span className={`text-xs font-bold ${tx.customerAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.customerAmount >= 0 ? '+' : ''}{formatINR(tx.customerAmount)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {tx.type === 'Debit' ? 'Cash In' : 'Cash Out'}: {formatINR(Math.abs(tx.cashOut))} | Profit: {formatINR(tx.profit)} ({tx.commissionMode || 'Deducted'})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
