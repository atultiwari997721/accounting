import React, { useState, useEffect } from 'react';
import { Calculator, Check, X, RotateCcw, Coins, IndianRupee } from 'lucide-react';

export default function DenominationModal({ initialDenominations, isOpen, onClose, onSave, title = "Physical Cash Note Calculator" }) {
  const [denoms, setDenoms] = useState({
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

  useEffect(() => {
    if (initialDenominations) {
      setDenoms({
        n500: Number(initialDenominations.n500) || 0,
        n200: Number(initialDenominations.n200) || 0,
        n100: Number(initialDenominations.n100) || 0,
        n50: Number(initialDenominations.n50) || 0,
        n20: Number(initialDenominations.n20) || 0,
        n10: Number(initialDenominations.n10) || 0,
        coins: Number(initialDenominations.coins) || 0,
        c20: Number(initialDenominations.c20) || 0,
        c10: Number(initialDenominations.c10) || 0,
        c5: Number(initialDenominations.c5) || 0,
        c2: Number(initialDenominations.c2) || 0,
        c1: Number(initialDenominations.c1) || 0
      });
    }
  }, [initialDenominations, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, val) => {
    const num = Math.max(0, parseInt(val.replace(/[^0-9]/g, ''), 10) || 0);
    setDenoms(prev => ({ ...prev, [field]: num }));
  };

  const calculateTotal = () => {
    return (
      (denoms.n500 * 500) +
      (denoms.n200 * 200) +
      (denoms.n100 * 100) +
      (denoms.n50 * 50) +
      (denoms.n20 * 20) +
      (denoms.n10 * 10) +
      (denoms.c20 * 20) +
      (denoms.c10 * 10) +
      (denoms.c5 * 5) +
      (denoms.c2 * 2) +
      (denoms.c1 * 1) +
      denoms.coins
    );
  };

  const grandTotal = calculateTotal();
  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');

  const resetAll = () => {
    setDenoms({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0, c20: 0, c10: 0, c5: 0, c2: 0, c1: 0 });
  };

  const handleConfirm = () => {
    onSave(grandTotal, denoms);
    onClose();
  };

  const noteTypes = [
    { key: 'n500', label: '₹500 Notes', value: 500, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { key: 'n200', label: '₹200 Notes', value: 200, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { key: 'n100', label: '₹100 Notes', value: 100, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { key: 'n50',  label: '₹50 Notes',  value: 50,  color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    { key: 'n20',  label: '₹20 Notes',  value: 20,  color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    { key: 'n10',  label: '₹10 Notes',  value: 10,  color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
              <p className="text-[10px] text-slate-400">Enter quantity for notes & coins</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Notes List */}
        <div className="p-4 flex flex-col gap-3 overflow-y-auto no-scrollbar">
          {noteTypes.map(note => {
            const count = denoms[note.key];
            const subtotal = count * note.value;
            return (
              <div key={note.key} className="flex items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-2 w-28">
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${note.color}`}>
                    ₹{note.value}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 justify-center">
                  <span className="text-xs text-slate-400">×</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={count === 0 ? '' : count}
                    placeholder="0"
                    onChange={(e) => handleChange(note.key, e.target.value)}
                    className="w-20 h-9 px-2 text-center text-sm font-bold bg-slate-900 border border-slate-750 text-amber-400 rounded-xl focus:border-amber-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">pcs</span>
                </div>

                <div className="w-24 text-right">
                  <span className="text-xs font-extrabold text-slate-200">
                    {formatINR(subtotal)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Coin List */}
          {[
            { key: 'c20', label: '₹20 Coins', value: 20, color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
            { key: 'c10', label: '₹10 Coins', value: 10, color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
            { key: 'c5',  label: '₹5 Coins',  value: 5,  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
            { key: 'c2',  label: '₹2 Coins',  value: 2,  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
            { key: 'c1',  label: '₹1 Coins',  value: 1,  color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' }
          ].map(coin => {
            const count = denoms[coin.key];
            const subtotal = count * coin.value;
            return (
              <div key={coin.key} className="flex items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-2xl border border-slate-800/80">
                <div className="flex items-center gap-2 w-28">
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${coin.color} flex items-center gap-1`}>
                    <Coins className="w-3 h-3" /> ₹{coin.value}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 justify-center">
                  <span className="text-xs text-slate-400">×</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={count === 0 ? '' : count}
                    placeholder="0"
                    onChange={(e) => handleChange(coin.key, e.target.value)}
                    className="w-20 h-9 px-2 text-center text-sm font-bold bg-slate-900 border border-slate-750 text-amber-400 rounded-xl focus:border-amber-400 focus:outline-none"
                  />
                  <span className="text-xs text-slate-500">pcs</span>
                </div>

                <div className="w-24 text-right">
                  <span className="text-xs font-extrabold text-slate-200">
                    {formatINR(subtotal)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Summary & Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
              <IndianRupee className="w-4 h-4 text-amber-400" /> Grand Total Cash:
            </div>
            <div className="text-xl font-extrabold text-amber-400">
              {formatINR(grandTotal)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <Check className="w-4 h-4" /> Save Denominations & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
