import React, { useState, useEffect, useMemo } from 'react';
import { Landmark, ClipboardList, PlusCircle, CreditCard, ChevronRight, Search, Calendar, Edit3 } from 'lucide-react';

export default function PassbookAccounts({ 
  accounts, 
  transactions, 
  dayHistory = [], 
  onAddAccount, 
  onBulkUpdateBalances, 
  onUpdateCustomerName 
}) {
  const [activeSubTab, setActiveSubTab] = useState('passbook'); // 'passbook' | 'accounts' | 'reports'
  const [bankName, setBankName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [tempName, setTempName] = useState('');

  const handleSaveName = async (id) => {
    if (onUpdateCustomerName) {
      await onUpdateCustomerName(id, tempName);
    }
    setEditingTxId(null);
  };
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editableBalances, setEditableBalances] = useState({});

  useEffect(() => {
    if (accounts.length > 0) {
      const initial = {};
      accounts.forEach(acc => {
        initial[acc._id] = String(acc.currentBalance || 0);
      });
      setEditableBalances(initial);
    }
  }, [accounts]);

  const liveTotalBankMoney = Object.values(editableBalances).reduce((sum, val) => sum + (Number(val) || 0), 0);

  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');

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

  const filteredTransactions = transactions.filter(tx => {
    const bankNameStr = tx.bankAccountId?.bankName || '';
    return bankNameStr.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 select-none">
      {/* Sub tabs header */}
      <div className="bg-slate-900/60 p-1 rounded-xl border border-slate-800 flex gap-1">
        <button
          onClick={() => { setActiveSubTab('passbook'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeSubTab === 'passbook'
              ? 'bg-slate-800 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Passbook
        </button>
        <button
          onClick={() => { setActiveSubTab('accounts'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeSubTab === 'accounts'
              ? 'bg-slate-800 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" /> Accounts
        </button>
        <button
          onClick={() => { setActiveSubTab('reports'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-all ${
            activeSubTab === 'reports'
              ? 'bg-slate-800 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Daily Reports
        </button>
      </div>

      {activeSubTab === 'passbook' && (
        <div className="flex flex-col gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Bank Account Name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:border-amber-500 focus:outline-none placeholder:text-slate-500 text-slate-100"
            />
          </div>

          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto no-scrollbar pb-10">
            {filteredTransactions.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800/40 rounded-xl p-8 text-center text-slate-500 text-xs">
                No matching transactions recorded.
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const bankNameStr = tx.bankAccountId?.bankName || 'Deleted Bank';
                const dateObj = new Date(tx.timestamp);
                const isToday = new Date().toDateString() === dateObj.toDateString();

                return (
                  <div key={tx._id} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 flex justify-between items-center transition-all">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-bold text-slate-200">{bankNameStr}</span>
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
                          <span className="text-slate-300 font-bold truncate max-w-[80px]">{tx.customerName || '—'}</span>
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
                      <span className={`text-xs font-extrabold ${tx.customerAmount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {tx.customerAmount >= 0 ? '+' : ''}{formatINR(tx.customerAmount)}
                      </span>
                      <div className="text-[9px] text-slate-400 flex items-center justify-end gap-1.5">
                        <span className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded border border-slate-700">
                          {tx.type === 'Debit' ? 'Cash In' : 'Cash Out'}: {formatINR(Math.abs(tx.cashOut))}
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

      {activeSubTab === 'accounts' && (
        <div className="flex flex-col gap-4">
          
          {/* Register bank account form */}
          <form onSubmit={handleAddAccount} className="bg-slate-900/30 border border-slate-850 p-4 rounded-2xl flex flex-col gap-3">
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

          {/* List of accounts */}
          <div className="flex flex-col gap-3">
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
                <div className="bg-slate-900/20 border border-slate-800/40 rounded-xl p-8 text-center text-slate-500 text-xs">
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
                    
                    {/* Editable input field */}
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

      {activeSubTab === 'reports' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide text-left">Daily EOD Reports</h3>
            <p className="text-[10px] text-slate-500 text-left">Chronological snapshot feed of closed daily sessions, cash handbooks, and bank EOD balances.</p>
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
                let profitDeducted = 0;
                let profitCash = 0;
                let profitBank = 0;
                dayTxs.forEach(t => {
                  const mode = t.commissionMode || 'Deducted';
                  if (mode === 'Deducted') profitDeducted += t.profit;
                  else if (mode === 'Cash') profitCash += t.profit;
                  else if (mode === 'Bank') profitBank += t.profit;
                });

                return (
                  <div key={day.date} className="bg-slate-900/50 border border-slate-850 rounded-2xl p-4 flex flex-col gap-3">
                    {/* Header: Date and status tag */}
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

                    {/* Summary statistics */}
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

                    {/* Commission Mode Breakdown */}
                    {dayTxs.length > 0 && (
                      <div className="bg-slate-950/20 border border-slate-900/60 p-2.5 rounded-xl flex flex-col gap-1 text-left text-[10px]">
                        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-900 pb-1">Commission Breakdown</span>
                        <div className="grid grid-cols-3 gap-2 text-slate-400 font-semibold mt-1">
                          <div>Cut: <span className="text-slate-100 font-bold">{formatINR(profitDeducted)}</span></div>
                          <div>Cash: <span className="text-slate-100 font-bold">{formatINR(profitCash)}</span></div>
                          <div>Online: <span className="text-slate-100 font-bold">{formatINR(profitBank)}</span></div>
                        </div>
                      </div>
                    )}

                    {/* Bank Balances at EOD */}
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
