import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Share2, Copy, Check, Edit2, Plus, Trash2, Landmark } from 'lucide-react';
import { numberToIndianWords } from '../utils/numberToWords';

export default function CashStatementReceipt({ 
  isOpen, 
  onClose, 
  dateStr = '', 
  timeStr = '',
  accountName = 'Cash Calculation',
  denominations = {}, 
  totalCash = 0, 
  onlineAmount = 0,
  bankAccounts = null,
  kioskTitle = 'SBI Kiosk'
}) {
  const [account, setAccount] = useState(accountName || 'Cash Calculation');
  const [editingAccount, setEditingAccount] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingAccId, setEditingAccId] = useState(null);
  const [editingBalanceId, setEditingBalanceId] = useState(null);

  // Helper to parse initial accounts
  const parseInitialAccounts = () => {
    if (Array.isArray(bankAccounts) && bankAccounts.length > 0) {
      return bankAccounts.map((a, i) => ({
        id: a.id || a._id || `acc_${i}`,
        name: a.name || a.bankName || `Account ${i + 1}`,
        balance: Number(a.balance !== undefined ? a.balance : a.currentBalance) || 0
      }));
    }
    if (bankAccounts && typeof bankAccounts === 'object' && Object.keys(bankAccounts).length > 0) {
      return Object.entries(bankAccounts).map(([name, bal], i) => ({
        id: `acc_${i}`,
        name: name,
        balance: Number(bal) || 0
      }));
    }
    // Fallback to localStorage accounts
    try {
      const stored = JSON.parse(localStorage.getItem('kiosk_accounts') || '[]');
      if (stored.length > 0) {
        return stored.map((a, i) => ({
          id: a._id || `acc_${i}`,
          name: a.bankName || `Account ${i + 1}`,
          balance: Number(a.currentBalance) || 0
        }));
      }
    } catch (e) {}

    // Fallback if only onlineAmount is provided
    if (Number(onlineAmount) > 0) {
      return [{ id: 'online_default', name: 'UPI / Online', balance: Number(onlineAmount) }];
    }

    // Default sample accounts if nothing configured
    return [
      { id: 'sbi_default', name: 'SBI', balance: 0 },
      { id: 'icici_default', name: 'ICICI', balance: 0 }
    ];
  };

  const [accountsList, setAccountsList] = useState(parseInitialAccounts);

  useEffect(() => {
    if (bankAccounts || onlineAmount !== undefined) {
      setAccountsList(parseInitialAccounts());
    }
  }, [bankAccounts, onlineAmount]);

  useEffect(() => {
    if (accountName) {
      setAccount(accountName);
    }
  }, [accountName]);

  const receiptRef = useRef(null);

  if (!isOpen) return null;

  const denoms = denominations || {};

  // Formatted date & time
  const now = new Date();
  const displayDate = dateStr 
    ? new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const displayTime = timeStr || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');

  // Breakdown of notes
  const notesList = [
    { label: '₹500', value: 500, count: Number(denoms.n500) || 0 },
    { label: '₹200', value: 200, count: Number(denoms.n200) || 0 },
    { label: '₹100', value: 100, count: Number(denoms.n100) || 0 },
    { label: '₹50',  value: 50,  count: Number(denoms.n50) || 0 },
    { label: '₹20',  value: 20,  count: Number(denoms.n20) || 0 },
    { label: '₹10',  value: 10,  count: Number(denoms.n10) || 0 },
  ];

  // Coins list
  const coinsList = [
    { label: '₹20 Coin', value: 20, count: Number(denoms.c20) || 0 },
    { label: '₹10 Coin', value: 10, count: Number(denoms.c10) || 0 },
    { label: '₹5 Coin',  value: 5,  count: Number(denoms.c5) || 0 },
    { label: '₹2 Coin',  value: 2,  count: Number(denoms.c2) || 0 },
    { label: '₹1 Coin',  value: 1,  count: Number(denoms.c1) || 0 },
  ];

  // Filter items with quantity > 0
  const activeNotes = notesList.filter(n => n.count > 0);
  const activeCoins = coinsList.filter(c => c.count > 0);
  const looseCoins = Number(denoms.coins) || 0;

  // Calculate paper notes count
  const totalPaperNotes = notesList.reduce((sum, n) => sum + n.count, 0);

  // Compute calculated physical cash if not provided directly
  const calculatedNotesCash = notesList.reduce((sum, n) => sum + (n.count * n.value), 0);
  const calculatedCoinsCash = coinsList.reduce((sum, c) => sum + (c.count * c.value), 0) + looseCoins;
  const computedCash = (activeNotes.length > 0 || activeCoins.length > 0 || looseCoins > 0)
    ? (calculatedNotesCash + calculatedCoinsCash)
    : (Number(totalCash) || 0);

  const finalCash = totalCash > 0 ? Number(totalCash) : computedCash;

  // Total Account Money (SBI, ICICI, etc.)
  const totalAccountsMoney = accountsList.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const grandTotal = finalCash + totalAccountsMoney;

  const words = numberToIndianWords(grandTotal);

  // Manage accounts list
  const handleAddAccountRow = () => {
    const newId = 'acc_' + Date.now();
    setAccountsList(prev => [...prev, { id: newId, name: 'New Account', balance: 0 }]);
    setEditingAccId(newId);
  };

  const handleRemoveAccount = (id) => {
    setAccountsList(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateAccountName = (id, newName) => {
    setAccountsList(prev => prev.map(a => a.id === id ? { ...a, name: newName } : a));
  };

  const handleUpdateAccountBalance = (id, newBal) => {
    const num = Number(newBal) || 0;
    setAccountsList(prev => prev.map(a => a.id === id ? { ...a, balance: num } : a));
  };

  // Build text receipt for clipboard & WhatsApp
  const generatePlainTextReceipt = () => {
    let lines = [];
    lines.push('================================');
    lines.push('     CASH STATEMENT RECEIPT     ');
    lines.push(`Date: ${displayDate}, ${displayTime}`);
    lines.push(`Account: ${account}`);
    lines.push('--------------------------------');
    lines.push('Denom        Qty       Total Amount');
    lines.push('--------------------------------');

    activeNotes.forEach(n => {
      const denomPad = n.label.padEnd(8, ' ');
      const qtyPad = `x ${n.count}`.padEnd(8, ' ');
      const totalPad = `= ${formatINR(n.count * n.value)}`;
      lines.push(`${denomPad}${qtyPad}${totalPad}`);
    });

    activeCoins.forEach(c => {
      const denomPad = c.label.padEnd(8, ' ');
      const qtyPad = `x ${c.count}`.padEnd(8, ' ');
      const totalPad = `= ${formatINR(c.count * c.value)}`;
      lines.push(`${denomPad}${qtyPad}${totalPad}`);
    });

    if (looseCoins > 0) {
      lines.push(`Loose Coins          = ${formatINR(looseCoins)}`);
    }

    lines.push('--------------------------------');
    lines.push(`Total Cash             ${formatINR(finalCash)}`);
    lines.push('--------------------------------');

    if (accountsList.length > 0) {
      lines.push('Bank / Online Accounts:');
      accountsList.forEach(a => {
        const namePad = `  ${a.name}`.padEnd(18, ' ');
        const amtPad = `+ ${formatINR(a.balance)}`;
        lines.push(`${namePad}${amtPad}`);
      });
      lines.push(`Total Online Added     + ${formatINR(totalAccountsMoney)}`);
      lines.push('--------------------------------');
    }

    lines.push(`GRAND TOTAL            ${formatINR(grandTotal)}`);
    lines.push(`Total Paper Notes: ${totalPaperNotes}`);
    lines.push('Amount in words:');
    lines.push(`${words}`);
    lines.push('--------------------------------');
    lines.push('Thank you for using Cash Calculator');
    lines.push(`${kioskTitle} Cash & Online Management`);
    lines.push('================================');
    return lines.join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatePlainTextReceipt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(generatePlainTextReceipt());
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-slate-100 border border-slate-200 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Modal Top Bar */}
        <div className="px-4 py-3 bg-white border-b border-slate-200 flex justify-between items-center no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              📄 Daily Cash & Online Receipt
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Container */}
        <div className="p-4 overflow-y-auto no-scrollbar flex flex-col items-center">
          <div 
            ref={receiptRef}
            id="printable-receipt"
            className="w-full bg-white text-slate-900 rounded-2xl p-5 shadow-md flex flex-col font-sans select-text border border-slate-200"
            style={{ minHeight: '400px' }}
          >
            {/* Header */}
            <div className="text-left pb-2">
              <h2 className="text-xl font-extrabold text-blue-600 tracking-tight uppercase">
                CASH STATEMENT RECEIPT
              </h2>
              <div className="mt-1 text-xs text-slate-600 font-medium">
                Date: {displayDate}, {displayTime}
              </div>
              <div className="text-xs text-slate-700 font-semibold flex items-center gap-1 mt-0.5">
                <span>Account:</span>
                {editingAccount ? (
                  <input
                    type="text"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    onBlur={() => setEditingAccount(false)}
                    autoFocus
                    className="border border-slate-300 rounded px-1 text-xs text-slate-800 font-bold"
                  />
                ) : (
                  <span 
                    onClick={() => setEditingAccount(true)}
                    className="cursor-pointer hover:underline text-slate-900 font-bold"
                    title="Click to edit account name"
                  >
                    {account} ✏️
                  </span>
                )}
              </div>
            </div>

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-slate-300 my-2.5"></div>

            {/* Denomination Table Header */}
            <div className="grid grid-cols-3 text-xs font-bold text-slate-900 pb-1">
              <span className="text-left">Denom</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Total Amount</span>
            </div>

            <div className="border-b border-dashed border-slate-300 mb-2"></div>

            {/* Denomination Rows */}
            <div className="flex flex-col gap-2.5 text-xs font-medium text-slate-850">
              {activeNotes.length === 0 && activeCoins.length === 0 && looseCoins === 0 ? (
                <div className="text-center py-2 text-slate-400 italic text-[11px]">
                  No individual notes recorded. Total cash in drawer: {formatINR(finalCash)}
                </div>
              ) : (
                <>
                  {activeNotes.map((note) => (
                    <div key={note.label} className="grid grid-cols-3 items-center">
                      <span className="text-left font-bold text-slate-900">{note.label}</span>
                      <span className="text-center text-slate-700 font-bold">x {note.count}</span>
                      <span className="text-right font-extrabold text-slate-900">
                        = {formatINR(note.count * note.value)}
                      </span>
                    </div>
                  ))}

                  {activeCoins.map((coin) => (
                    <div key={coin.label} className="grid grid-cols-3 items-center">
                      <span className="text-left font-bold text-slate-900">{coin.label}</span>
                      <span className="text-center text-slate-700 font-bold">x {coin.count}</span>
                      <span className="text-right font-extrabold text-slate-900">
                        = {formatINR(coin.count * coin.value)}
                      </span>
                    </div>
                  ))}

                  {looseCoins > 0 && (
                    <div className="grid grid-cols-3 items-center">
                      <span className="text-left font-bold text-slate-900">Loose Coins</span>
                      <span className="text-center text-slate-700 font-bold">—</span>
                      <span className="text-right font-extrabold text-slate-900">
                        = {formatINR(looseCoins)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-slate-300 my-2.5"></div>

            {/* Total Cash */}
            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
              <span>Total Cash</span>
              <span className="text-slate-900 font-extrabold">{formatINR(finalCash)}</span>
            </div>

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-slate-300 my-2.5"></div>

            {/* BANK ACCOUNTS MONEY SEPARATELY (SBI, ICICI, etc.) */}
            <div className="flex flex-col gap-1.5 py-0.5">
              <div className="flex justify-between items-center text-[11px] font-extrabold text-blue-800 uppercase tracking-wide">
                <span className="flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5 text-blue-600 inline" /> Bank Accounts Money
                </span>
                <button
                  type="button"
                  onClick={handleAddAccountRow}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 no-print flex items-center gap-0.5"
                  title="Add account line"
                >
                  <Plus className="w-2.5 h-2.5" /> Add Bank
                </button>
              </div>

              {accountsList.length === 0 ? (
                <div className="text-[10px] text-slate-400 italic py-1 text-center">
                  No bank accounts added.
                </div>
              ) : (
                accountsList.map((acc) => (
                  <div key={acc.id} className="flex justify-between items-center text-xs font-semibold text-slate-700 pl-1 py-0.5">
                    {/* Account Name (SBI, ICICI, etc.) */}
                    <div className="flex items-center gap-1 max-w-[150px]">
                      {editingAccId === acc.id ? (
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) => handleUpdateAccountName(acc.id, e.target.value)}
                          onBlur={() => setEditingAccId(null)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setEditingAccId(null); }}
                          autoFocus
                          className="w-24 px-1 py-0.5 text-xs font-bold border border-blue-400 rounded bg-white text-slate-900"
                        />
                      ) : (
                        <span
                          onClick={() => setEditingAccId(acc.id)}
                          className="cursor-pointer hover:underline text-slate-900 font-bold truncate flex items-center gap-1"
                          title="Click to edit account name"
                        >
                          {acc.name}
                          <Edit2 className="w-2.5 h-2.5 text-slate-400 no-print" />
                        </span>
                      )}
                    </div>

                    {/* Account Balance */}
                    <div className="flex items-center gap-1">
                      {editingBalanceId === acc.id ? (
                        <div className="flex items-center gap-1 no-print">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={acc.balance === 0 ? '' : acc.balance}
                            placeholder="0"
                            onChange={(e) => handleUpdateAccountBalance(acc.id, e.target.value.replace(/[^0-9]/g, ''))}
                            onBlur={() => setEditingBalanceId(null)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingBalanceId(null); }}
                            className="w-20 px-1 py-0.5 text-xs text-right font-bold border border-blue-400 rounded bg-white text-slate-900"
                            autoFocus
                          />
                          <button 
                            type="button"
                            onClick={() => setEditingBalanceId(null)}
                            className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => setEditingBalanceId(acc.id)}
                          className="text-slate-900 font-extrabold cursor-pointer hover:underline flex items-center gap-1"
                          title="Click to edit account money"
                        >
                          + {formatINR(acc.balance)}
                          <Edit2 className="w-2.5 h-2.5 text-slate-400 no-print" />
                        </span>
                      )}

                      {/* Remove Account Row */}
                      <button
                        type="button"
                        onClick={() => handleRemoveAccount(acc.id)}
                        className="p-0.5 text-slate-300 hover:text-red-500 rounded no-print ml-1"
                        title="Remove from receipt"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Total Online / Account Money Subtotal */}
              <div className="flex justify-between items-center text-xs font-bold text-slate-700 pt-1 border-t border-dotted border-slate-200">
                <span className="text-slate-600">Total Online (Added)</span>
                <span className="text-blue-900 font-extrabold">+ {formatINR(totalAccountsMoney)}</span>
              </div>
            </div>

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-slate-300 my-2.5"></div>

            {/* Grand Total */}
            <div className="flex justify-between items-center text-sm font-extrabold text-emerald-600">
              <span className="tracking-wide">GRAND TOTAL</span>
              <span className="text-base text-emerald-600 tracking-tight">{formatINR(grandTotal)}</span>
            </div>

            {/* Paper notes count */}
            <div className="text-left text-xs font-extrabold text-slate-900 mt-2">
              Total Paper Notes: {totalPaperNotes}
            </div>

            {/* Amount in words */}
            <div className="text-left mt-2">
              <span className="text-xs font-extrabold text-slate-900 block">Amount in words:</span>
              <span className="text-[11px] text-slate-600 italic font-medium block leading-tight mt-0.5">
                {words}
              </span>
            </div>

            {/* Dashed Separator */}
            <div className="border-b border-dashed border-slate-300 my-3"></div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-500 font-medium pb-1">
              Thank you for using Cash Calculator
              <div className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">
                {kioskTitle} Cash & Online Management
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 no-print shadow-xs">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all border border-slate-200 shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Text'}
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex-1 py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            WhatsApp
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 transition-all shadow-md"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}
