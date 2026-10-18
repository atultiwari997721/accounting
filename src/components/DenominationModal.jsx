import React, { useState, useEffect } from 'react';
import { Calculator, Check, X, RotateCcw, Coins, IndianRupee, Plus, Minus, FileText } from 'lucide-react';
import { numberToIndianWords } from '../utils/numberToWords';

export default function DenominationModal({ 
  initialDenominations, 
  isOpen, 
  onClose, 
  onSave, 
  title = "Physical Cash Note Calculator",
  onPreviewReceipt
}) {
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

  const handleAdjust = (field, delta) => {
    setDenoms(prev => ({ ...prev, [field]: Math.max(0, (prev[field] || 0) + delta) }));
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
      (denoms.coins || 0)
    );
  };

  const totalPaperNotes = 
    (denoms.n500 || 0) +
    (denoms.n200 || 0) +
    (denoms.n100 || 0) +
    (denoms.n50 || 0) +
    (denoms.n20 || 0) +
    (denoms.n10 || 0);

  const grandTotal = calculateTotal();
  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');
  const words = numberToIndianWords(grandTotal);

  const resetAll = () => {
    setDenoms({ n500: 0, n200: 0, n100: 0, n50: 0, n20: 0, n10: 0, coins: 0, c20: 0, c10: 0, c5: 0, c2: 0, c1: 0 });
  };

  const handleConfirm = () => {
    if (onSave) {
      onSave(grandTotal, denoms);
    }
    onClose();
  };

  const noteTypes = [
    { key: 'n500', label: '₹500', value: 500, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { key: 'n200', label: '₹200', value: 200, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { key: 'n100', label: '₹100', value: 100, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { key: 'n50',  label: '₹50',  value: 50,  color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    { key: 'n20',  label: '₹20',  value: 20,  color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    { key: 'n10',  label: '₹10',  value: 10,  color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  ];

  const coinTypes = [
    { key: 'c20', label: '₹20', value: 20 },
    { key: 'c10', label: '₹10', value: 10 },
    { key: 'c5',  label: '₹5',  value: 5 },
    { key: 'c2',  label: '₹2',  value: 2 },
    { key: 'c1',  label: '₹1',  value: 1 }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-xl border border-blue-200 text-blue-600 shadow-2xs">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="font-extrabold text-sm text-slate-800">{title}</h3>
              <p className="text-[10px] text-slate-500">Add or edit notes & coins quantity</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Notes & Coins List */}
        <div className="p-3.5 flex flex-col gap-2.5 overflow-y-auto no-scrollbar">
          
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left flex justify-between items-center">
            <span>Paper Notes</span>
            <span className="text-blue-700 font-extrabold">Total Notes: {totalPaperNotes} pcs</span>
          </div>

          {/* Paper Notes */}
          {noteTypes.map(note => {
            const count = denoms[note.key] || 0;
            const subtotal = count * note.value;
            return (
              <div key={note.key} className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 w-20">
                  <span className={`text-xs font-black px-2 py-1 rounded-lg border ${note.color} w-full text-center shadow-2xs`}>
                    {note.label}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-1 justify-center">
                  <button
                    type="button"
                    onClick={() => handleAdjust(note.key, -1)}
                    className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs active:scale-95 text-slate-700 rounded-lg flex items-center justify-center font-bold text-xs"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={count === 0 ? '' : count}
                    placeholder="0"
                    onChange={(e) => handleChange(note.key, e.target.value)}
                    className="w-16 h-8 px-1 text-center text-sm font-black bg-white border border-slate-300 text-blue-900 rounded-lg focus:border-blue-600 focus:outline-none shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjust(note.key, 1)}
                    className="w-7 h-7 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs active:scale-95 text-slate-700 rounded-lg flex items-center justify-center font-bold text-xs"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjust(note.key, 100)}
                    className="h-7 px-1.5 bg-blue-50 hover:bg-blue-100 active:scale-95 text-[9px] text-blue-700 border border-blue-200 rounded-md font-bold shadow-2xs"
                    title="Add 1 bundle (+100 notes)"
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

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-left pt-1">
            <span>Coins Breakdown</span>
          </div>

          {/* Coins List */}
          {coinTypes.map(coin => {
            const count = denoms[coin.key] || 0;
            const subtotal = count * coin.value;
            return (
              <div key={coin.key} className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1 w-20">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 flex items-center justify-center gap-1 w-full shadow-2xs">
                    <Coins className="w-3 h-3 text-amber-600" /> {coin.label}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-1 justify-center">
                  <button
                    type="button"
                    onClick={() => handleAdjust(coin.key, -1)}
                    className="w-6 h-6 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs text-slate-700 rounded flex items-center justify-center font-bold text-xs"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={count === 0 ? '' : count}
                    placeholder="0"
                    onChange={(e) => handleChange(coin.key, e.target.value)}
                    className="w-16 h-7 px-1 text-center text-xs font-black bg-white border border-slate-300 text-amber-800 rounded focus:border-blue-600 focus:outline-none shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjust(coin.key, 1)}
                    className="w-6 h-6 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs text-slate-700 rounded flex items-center justify-center font-bold text-xs"
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

          {/* Loose / Mixed Coins Row */}
          <div className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1 w-28 text-left">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-600" /> Loose Coins:
              </span>
            </div>

            <div className="flex items-center gap-1 flex-1 justify-center">
              <span className="text-xs text-slate-400 font-bold">₹</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={denoms.coins === 0 ? '' : denoms.coins}
                placeholder="0"
                onChange={(e) => handleChange('coins', e.target.value)}
                className="w-24 h-7 px-2 text-center text-xs font-black bg-white border border-slate-300 text-amber-800 rounded focus:border-blue-600 focus:outline-none shadow-xs"
              />
            </div>

            <div className="w-24 text-right">
              <span className="text-xs font-black text-slate-800">
                {formatINR(denoms.coins || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Summary & Controls */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col gap-2.5">
          <div className="flex flex-col bg-blue-50 border border-blue-200 p-2.5 rounded-2xl text-left shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-blue-900 font-bold">
                <IndianRupee className="w-4 h-4 text-blue-700" /> Total Cash:
              </div>
              <div className="text-xl font-black text-blue-900">
                {formatINR(grandTotal)}
              </div>
            </div>
            <div className="text-[10px] text-blue-800/80 font-medium italic mt-0.5 truncate">
              {words}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="px-3 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs active:scale-95 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>

            {onPreviewReceipt && (
              <button
                type="button"
                onClick={() => {
                  onPreviewReceipt(grandTotal, denoms);
                }}
                className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" /> Receipt
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Check className="w-4 h-4" /> Save Denominations & Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
