import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  Landmark, 
  Coins, 
  Calendar, 
  Clock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  TrendingUp, 
  ShieldCheck, 
  History, 
  FileText 
} from 'lucide-react';
import { numberToIndianWords } from '../utils/numberToWords';

export default function DetailedStatementReportModal({
  isOpen,
  onClose,
  day = {},
  transactions = [],
  accounts = [],
  kioskTitle = 'SBI Kiosk Banking Point'
}) {
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const reportRef = useRef(null);

  if (!isOpen || !day) return null;

  const formatINR = (val) => '₹' + Number(val || 0).toLocaleString('en-IN');
  const formatRawINR = (val) => Number(val || 0).toLocaleString('en-IN');

  const dateStr = day.date || new Date().toLocaleDateString('en-CA');
  const displayDate = new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const isClosed = day.status === 'Closed';
  const dayTxs = (transactions || []).filter(t => (t.timestamp || '').split('T')[0] === dateStr);

  // Reconstruct bank balances if missing
  const closingBankBalances = day.closingBankBalances || day.bankBalances || {};
  
  // Calculate net changes per bank from transactions
  const netTxByBank = {};
  const bankInflow = {};
  const bankOutflow = {};
  let totalCashIn = 0;
  let totalCashOut = 0;
  let totalOnlineIn = 0;
  let totalOnlineOut = 0;
  let totalTxProfit = 0;

  dayTxs.forEach(tx => {
    const bName = tx.bankAccountId?.bankName || 'Online Account';
    const custAmt = Number(tx.customerAmount) || 0;
    const cOut = Number(tx.cashOut) || 0;
    const profit = Number(tx.profit) || 0;

    netTxByBank[bName] = (netTxByBank[bName] || 0) + custAmt;
    if (custAmt > 0) {
      bankInflow[bName] = (bankInflow[bName] || 0) + custAmt;
      totalOnlineIn += custAmt;
    } else if (custAmt < 0) {
      bankOutflow[bName] = (bankOutflow[bName] || 0) + Math.abs(custAmt);
      totalOnlineOut += Math.abs(custAmt);
    }

    if (cOut < 0) {
      totalCashIn += Math.abs(cOut);
    } else if (cOut > 0) {
      totalCashOut += cOut;
    }

    totalTxProfit += profit;
  });

  // Calculate opening bank balances
  const openingBankBalances = day.openingBankBalances || {};
  const allBankNames = Array.from(new Set([
    ...Object.keys(closingBankBalances),
    ...Object.keys(openingBankBalances),
    ...accounts.map(a => a.bankName),
    ...Object.keys(netTxByBank)
  ])).filter(Boolean);

  const bankModes = allBankNames.map(name => {
    const closeBal = closingBankBalances[name] !== undefined 
      ? Number(closingBankBalances[name]) 
      : (accounts.find(a => a.bankName === name)?.currentBalance || 0);

    const openBal = openingBankBalances[name] !== undefined
      ? Number(openingBankBalances[name])
      : Math.max(0, closeBal - (netTxByBank[name] || 0));

    const inflow = bankInflow[name] || 0;
    const outflow = bankOutflow[name] || 0;
    const netDiff = closeBal - openBal;

    return {
      name,
      openBal,
      inflow,
      outflow,
      closeBal,
      netDiff
    };
  });

  // Drawer Cash
  const openingCash = Number(day.openingCash) || 0;
  const closingCash = Number(day.closingCash) || 0;
  const cashNetDiff = closingCash - openingCash;

  // Totals across all modes
  const totalOpeningOnline = bankModes.reduce((sum, b) => sum + b.openBal, 0);
  const totalClosingOnline = bankModes.reduce((sum, b) => sum + b.closeBal, 0);

  const grandTotalOpening = openingCash + totalOpeningOnline;
  const grandTotalClosing = closingCash + totalClosingOnline;
  const grandTotalNetDiff = grandTotalClosing - grandTotalOpening;

  // Open / Close events & counts
  const rawEvents = Array.isArray(day.openCloseEvents) && day.openCloseEvents.length > 0
    ? day.openCloseEvents
    : [
        {
          id: 'evt_open_def',
          type: 'OPEN',
          timestamp: day.openedAt || `${dateStr}T09:00:00.000Z`,
          cash: openingCash,
          bankBalances: openingBankBalances,
          note: 'Initial Open'
        },
        ...(isClosed ? [{
          id: 'evt_close_def',
          type: 'CLOSE',
          timestamp: day.closedAt || `${dateStr}T21:00:00.000Z`,
          cash: closingCash,
          bankBalances: closingBankBalances,
          note: 'Ledger Closed'
        }] : [])
      ];

  const openCount = Number(day.openCount) || rawEvents.filter(e => e.type === 'OPEN' || e.type === 'REOPEN').length || 1;
  const closeCount = Number(day.closeCount) || rawEvents.filter(e => e.type === 'CLOSE').length || (isClosed ? 1 : 0);

  const dayFinalProfit = day.totalProfit !== undefined ? Number(day.totalProfit) : totalTxProfit;

  // Denominations
  const denoms = day.cashDenominations || {};
  const notesList = [
    { label: '₹500', value: 500, count: Number(denoms.n500) || 0 },
    { label: '₹200', value: 200, count: Number(denoms.n200) || 0 },
    { label: '₹100', value: 100, count: Number(denoms.n100) || 0 },
    { label: '₹50',  value: 50,  count: Number(denoms.n50) || 0 },
    { label: '₹20',  value: 20,  count: Number(denoms.n20) || 0 },
    { label: '₹10',  value: 10,  count: Number(denoms.n10) || 0 },
  ];
  const coinsTotal = (Number(denoms.c20) || 0) * 20 + 
                     (Number(denoms.c10) || 0) * 10 + 
                     (Number(denoms.c5) || 0) * 5 + 
                     (Number(denoms.c2) || 0) * 2 + 
                     (Number(denoms.c1) || 0) * 1 + 
                     (Number(denoms.coins) || 0);

  // Generate Formatted Text for WhatsApp & Copy
  const generateReportText = () => {
    let t = `🏛️ *${kioskTitle.toUpperCase()}*\n`;
    t += `📋 *DAILY LEDGER & AUDIT STATEMENT*\n`;
    t += `📅 *Date:* ${displayDate} | *Status:* ${day.status.toUpperCase()}\n`;
    t += `⏰ *Generated:* ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    t += `------------------------------------\n`;
    t += `🔄 *LEDGER SESSIONS:*\n`;
    t += `• Total Times Opened: ${openCount}\n`;
    t += `• Total Times Closed: ${closeCount}\n`;
    if (rawEvents.length > 0) {
      t += `*Timeline Log:*\n`;
      rawEvents.forEach((ev, i) => {
        const time = new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        t += `  ${i + 1}. [${ev.type}] at ${time} - Cash: ${formatINR(ev.cash)}\n`;
      });
    }
    t += `------------------------------------\n`;
    t += `💰 *OPENING BALANCES (ALL MODES):*\n`;
    t += `• Drawer Physical Cash: ${formatINR(openingCash)}\n`;
    bankModes.forEach(b => {
      t += `• ${b.name}: ${formatINR(b.openBal)}\n`;
    });
    t += `💎 *Total Opening Liquidity:* ${formatINR(grandTotalOpening)}\n`;
    t += `------------------------------------\n`;
    t += `🏁 *CLOSING BALANCES (ALL MODES):*\n`;
    t += `• Drawer Physical Cash: ${formatINR(closingCash)}\n`;
    bankModes.forEach(b => {
      t += `• ${b.name}: ${formatINR(b.closeBal)} (${b.netDiff >= 0 ? '+' : ''}${formatINR(b.netDiff)})\n`;
    });
    t += `💎 *Total Closing Liquidity:* ${formatINR(grandTotalClosing)}\n`;
    t += `📊 *Net Asset Change:* ${grandTotalNetDiff >= 0 ? '+' : ''}${formatINR(grandTotalNetDiff)}\n`;
    t += `------------------------------------\n`;
    t += `📈 *DAY FLOW & PROFIT SUMMARY:*\n`;
    t += `• Transactions Logged: ${dayTxs.length}\n`;
    t += `• Cash In: ${formatINR(totalCashIn)} | Cash Out: ${formatINR(totalCashOut)}\n`;
    t += `• Online In: ${formatINR(totalOnlineIn)} | Online Out: ${formatINR(totalOnlineOut)}\n`;
    t += `🏆 *TOTAL DAY NET PROFIT: +${formatINR(dayFinalProfit)}*\n`;
    t += `------------------------------------\n`;
    t += `💵 *Closing Drawer Cash In Words:*\n`;
    t += `_${numberToIndianWords(closingCash)}_\n`;
    t += `------------------------------------\n`;
    t += `*Verified & Generated by SBI Kiosk System*`;
    return t;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateReportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      console.error(e);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateReportText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  // Download Standalone Self-Contained HTML Report File
  const handleDownloadReport = () => {
    try {
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Statement_${dateStr}_${kioskTitle.replace(/\s+/g, '_')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20px; color: #1e293b; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #1d4ed8; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin: 0; }
    .sub { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 600; }
    .meta { display: flex; justify-content: space-between; font-size: 11px; margin-top: 8px; color: #334155; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; text-transform: uppercase; }
    .badge-open { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-closed { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 18px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
    th { background: #f1f5f9; color: #334155; font-weight: bold; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; }
    td { padding: 6px 8px; border: 1px solid #cbd5e1; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .highlight-profit { background: #ecfdf5; color: #047857; font-weight: 800; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #94a3b8; font-size: 10px; color: #64748b; text-align: center; }
    @media print {
      body { margin: 0; padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${kioskTitle}</h1>
    <div class="sub">Official Daily Comprehensive Ledger & Audit Statement</div>
    <div class="meta">
      <div><b>Date:</b> ${displayDate} (${dateStr})</div>
      <div><b>Status:</b> <span class="badge ${isClosed ? 'badge-closed' : 'badge-open'}">${day.status}</span></div>
      <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
    </div>
  </div>

  <div class="section-title">1. Ledger Session & Lifecycle Audit</div>
  <table>
    <tr>
      <th>Total Times Opened</th>
      <td><b>${openCount} times</b></td>
      <th>Total Times Closed</th>
      <td><b>${closeCount} times</b></td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Event</th>
        <th>Date & Time</th>
        <th class="text-right">Cash In Drawer</th>
        <th class="text-right">Total Assets Recorded</th>
        <th>Audit Note</th>
      </tr>
    </thead>
    <tbody>
      ${rawEvents.map((ev, i) => {
        const time = new Date(ev.timestamp).toLocaleString();
        const evBankTotal = Object.values(ev.bankBalances || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        const evAssets = (Number(ev.cash) || 0) + evBankTotal;
        return `
          <tr>
            <td>${i + 1}</td>
            <td><b>${ev.type}</b></td>
            <td>${time}</td>
            <td class="text-right font-bold">₹${Number(ev.cash || 0).toLocaleString('en-IN')}</td>
            <td class="text-right font-bold">₹${evAssets.toLocaleString('en-IN')}</td>
            <td>${ev.note || '-'}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="section-title">2. Complete Balance Sheet Across All Modes (Cash & Online)</div>
  <table>
    <thead>
      <tr>
        <th>Mode / Account Name</th>
        <th class="text-right">Opening Balance</th>
        <th class="text-right">Inflow (+)</th>
        <th class="text-right">Outflow (-)</th>
        <th class="text-right">Closing Balance</th>
        <th class="text-right">Net Change</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>💵 Drawer Physical Cash</b></td>
        <td class="text-right">₹${openingCash.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${totalCashIn.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${totalCashOut.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold">₹${closingCash.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold">${cashNetDiff >= 0 ? '+' : ''}₹${cashNetDiff.toLocaleString('en-IN')}</td>
      </tr>
      ${bankModes.map(b => `
        <tr>
          <td>🏦 ${b.name} (Online)</td>
          <td class="text-right">₹${b.openBal.toLocaleString('en-IN')}</td>
          <td class="text-right">₹${b.inflow.toLocaleString('en-IN')}</td>
          <td class="text-right">₹${b.outflow.toLocaleString('en-IN')}</td>
          <td class="text-right font-bold">₹${b.closeBal.toLocaleString('en-IN')}</td>
          <td class="text-right font-bold">${b.netDiff >= 0 ? '+' : ''}₹${b.netDiff.toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
      <tr style="background: #eff6ff; font-weight: bold; border-top: 2px solid #2563eb;">
        <td>💎 GRAND TOTAL ALL MODES</td>
        <td class="text-right">₹${grandTotalOpening.toLocaleString('en-IN')}</td>
        <td class="text-right">₹${(totalCashIn + totalOnlineIn).toLocaleString('en-IN')}</td>
        <td class="text-right">₹${(totalCashOut + totalOnlineOut).toLocaleString('en-IN')}</td>
        <td class="text-right" style="color: #1e3a8a; font-size: 13px;">₹${grandTotalClosing.toLocaleString('en-IN')}</td>
        <td class="text-right">${grandTotalNetDiff >= 0 ? '+' : ''}₹${grandTotalNetDiff.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">3. Physical Cash Denominations at Close</div>
  <table>
    <thead>
      <tr>
        <th class="text-center">₹500</th>
        <th class="text-center">₹200</th>
        <th class="text-center">₹100</th>
        <th class="text-center">₹50</th>
        <th class="text-center">₹20</th>
        <th class="text-center">₹10</th>
        <th class="text-center">Coins</th>
        <th class="text-right">Total Cash</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center">${denoms.n500 || 0} (₹${(Number(denoms.n500 || 0) * 500).toLocaleString('en-IN')})</td>
        <td class="text-center">${denoms.n200 || 0} (₹${(Number(denoms.n200 || 0) * 200).toLocaleString('en-IN')})</td>
        <td class="text-center">${denoms.n100 || 0} (₹${(Number(denoms.n100 || 0) * 100).toLocaleString('en-IN')})</td>
        <td class="text-center">${denoms.n50 || 0} (₹${(Number(denoms.n50 || 0) * 50).toLocaleString('en-IN')})</td>
        <td class="text-center">${denoms.n20 || 0} (₹${(Number(denoms.n20 || 0) * 20).toLocaleString('en-IN')})</td>
        <td class="text-center">${denoms.n10 || 0} (₹${(Number(denoms.n10 || 0) * 10).toLocaleString('en-IN')})</td>
        <td class="text-center">₹${coinsTotal.toLocaleString('en-IN')}</td>
        <td class="text-right font-bold" style="color: #b45309;">₹${closingCash.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>
  <div style="font-size: 11px; margin-bottom: 12px; color: #475569; font-style: italic;">
    <b>Amount in Words:</b> ${numberToIndianWords(closingCash)}
  </div>

  <div class="section-title">4. Day Financial Performance & Total Profit</div>
  <table>
    <tr>
      <th>Total Transactions Logged</th>
      <td class="font-bold">${dayTxs.length} entries</td>
      <th>Total Drawer Flow</th>
      <td>In: ₹${totalCashIn.toLocaleString('en-IN')} | Out: ₹${totalCashOut.toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <th>Online Bank Flow</th>
      <td>In: ₹${totalOnlineIn.toLocaleString('en-IN')} | Out: ₹${totalOnlineOut.toLocaleString('en-IN')}</td>
      <th class="highlight-profit">🏆 TOTAL DAY NET PROFIT</th>
      <td class="highlight-profit text-right" style="font-size: 14px;">+₹${dayFinalProfit.toLocaleString('en-IN')}</td>
    </tr>
  </table>

  <div class="section-title">5. Date & Time Wise Transactions Register (${dayTxs.length} Transactions)</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Time</th>
        <th>Customer</th>
        <th>Type / Mode</th>
        <th class="text-right">Online (In/Out)</th>
        <th class="text-right">Cash (In/Out)</th>
        <th>Notes Used</th>
        <th class="text-right">Tx Profit</th>
      </tr>
    </thead>
    <tbody>
      ${dayTxs.length === 0 ? '<tr><td colspan="8" class="text-center">No individual transactions recorded on this date.</td></tr>' : ''}
      ${dayTxs.map((tx, idx) => {
        const time = new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const bName = tx.bankAccountId?.bankName || 'Bank';
        return `
          <tr>
            <td>${idx + 1}</td>
            <td>${time}</td>
            <td><b>${tx.customerName || 'Walk-in'}</b></td>
            <td>${tx.type === 'Credit' ? 'Withdrawal' : 'Deposit'} (${tx.commissionMode || 'Direct'})</td>
            <td class="text-right">${tx.customerAmount >= 0 ? '+' : ''}₹${Number(tx.customerAmount || 0).toLocaleString('en-IN')} <small>(${bName})</small></td>
            <td class="text-right">${tx.cashOut > 0 ? '-' : '+'}₹${Math.abs(Number(tx.cashOut || 0)).toLocaleString('en-IN')}</td>
            <td><small>${tx.noteDetails || '-'}</small></td>
            <td class="text-right font-bold" style="color: #047857;">+₹${Number(tx.profit || 0).toLocaleString('en-IN')}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    This is a computer-generated official daily statement issued by ${kioskTitle}. All rights reserved.
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `SBI_Kiosk_Statement_${dateStr}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
      <div 
        ref={reportRef}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-800 print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none"
      >
        {/* Top Header & Actions Bar (Hidden on print) */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-tight">Detailed Statement & Audit Report</h2>
              <p className="text-[10px] text-slate-500 font-medium">{displayDate} • Complete Ledger Record</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all shadow-2xs active:scale-95"
              title="Print Statement"
            >
              <Printer className="w-4 h-4 text-slate-600" />
            </button>
            <button
              type="button"
              onClick={handleDownloadReport}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all shadow-2xs active:scale-95"
              title="Download Statement HTML"
            >
              {downloadSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5 text-blue-600" />}
              <span className="hidden sm:inline">{downloadSuccess ? 'Downloaded' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-all shadow-2xs active:scale-95"
              title="Share via WhatsApp"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Statement Content */}
        <div className="overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 text-left print:p-2 print:overflow-visible">
          
          {/* Statement Header */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-bold tracking-widest text-blue-200 uppercase">State Bank of India</span>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">{kioskTitle}</h1>
                <p className="text-[10px] text-blue-100/90 font-medium">Daily Comprehensive Ledger & Transaction Audit Statement</p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-xs ${
                isClosed ? 'bg-red-500/20 text-red-200 border border-red-400/30' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
              }`}>
                {day.status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-blue-800/60 text-[10px]">
              <div>
                <span className="text-blue-300 text-[8px] font-bold uppercase block">Statement Date</span>
                <span className="font-extrabold text-white">{displayDate}</span>
              </div>
              <div>
                <span className="text-blue-300 text-[8px] font-bold uppercase block">Ledger Cycle</span>
                <span className="font-extrabold text-white">Open {openCount}x • Close {closeCount}x</span>
              </div>
              <div>
                <span className="text-blue-300 text-[8px] font-bold uppercase block">Total Net Profit</span>
                <span className="font-black text-emerald-300">+{formatINR(dayFinalProfit)}</span>
              </div>
              <div>
                <span className="text-blue-300 text-[8px] font-bold uppercase block">Report Printed</span>
                <span className="font-extrabold text-white">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {/* Section 1: 🕒 Date & Time Wise Open / Close Lifecycle Audit */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Date & Time-Wise Ledger Open & Close Audit
              </span>
              <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                {rawEvents.length} Recorded Lifecycle Events
              </span>
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {rawEvents.map((ev, evIdx) => {
                const dateObj = new Date(ev.timestamp);
                const evTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const evDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const isOp = ev.type === 'OPEN';
                const isRe = ev.type === 'REOPEN';
                const isCl = ev.type === 'CLOSE';

                const evCash = Number(ev.cash) || 0;
                const evBankObj = ev.bankBalances || {};
                const evBankTotal = Object.values(evBankObj).reduce((s, v) => s + (Number(v) || 0), 0);
                const evTotalAssets = evCash + evBankTotal;

                return (
                  <div key={ev.id || evIdx} className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1.5 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          isOp ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                          isRe ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                          'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {isOp ? '🟢 OPENED' : isRe ? '🟡 REOPENED' : '🔴 CLOSED'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-700">
                          {evDate} at {evTime}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 italic">
                        {ev.note || (isOp ? 'Session Start' : isRe ? 'Session Resume' : 'EOD Close')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 text-[10px]">
                      <div className="flex flex-col">
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase">Cash In Drawer</span>
                        <span className="font-extrabold text-amber-900">{formatINR(evCash)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase">Online Bank Total</span>
                        <span className="font-extrabold text-blue-900">{formatINR(evBankTotal)}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase">Total Liquid Capital</span>
                        <span className="font-black text-slate-900">{formatINR(evTotalAssets)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: 📊 All Modes Opening & Closing Balance Sheet */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-blue-600" />
                Ledger Balance Sheet Across All Modes (Cash & Online)
              </span>
              <span className="text-[9px] font-bold text-slate-500">
                Opening vs Closing Comparison
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-[8.5px] uppercase">
                    <th className="py-2 px-2">Mode / Account</th>
                    <th className="py-2 px-2 text-right">Opening</th>
                    <th className="py-2 px-2 text-right">Inflow (+)</th>
                    <th className="py-2 px-2 text-right">Outflow (-)</th>
                    <th className="py-2 px-2 text-right">Closing</th>
                    <th className="py-2 px-2 text-right">Net Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Physical Cash Drawer */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2 px-2 font-bold text-slate-800 flex items-center gap-1">
                      <Coins className="w-3 h-3 text-amber-600 shrink-0" />
                      Drawer Physical Cash
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-slate-600">{formatINR(openingCash)}</td>
                    <td className="py-2 px-2 text-right font-medium text-emerald-700">+{formatINR(totalCashIn)}</td>
                    <td className="py-2 px-2 text-right font-medium text-rose-700">-{formatINR(totalCashOut)}</td>
                    <td className="py-2 px-2 text-right font-black text-amber-950">{formatINR(closingCash)}</td>
                    <td className={`py-2 px-2 text-right font-bold ${cashNetDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {cashNetDiff >= 0 ? '+' : ''}{formatINR(cashNetDiff)}
                    </td>
                  </tr>

                  {/* Each Online Bank Account */}
                  {bankModes.map((b) => (
                    <tr key={b.name} className="hover:bg-slate-50/50">
                      <td className="py-2 px-2 font-bold text-slate-700 flex items-center gap-1">
                        <Landmark className="w-3 h-3 text-blue-600 shrink-0" />
                        {b.name} <span className="text-[7.5px] text-blue-600 bg-blue-50 px-1 py-0.2 rounded font-semibold">Online</span>
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-600">{formatINR(b.openBal)}</td>
                      <td className="py-2 px-2 text-right font-medium text-emerald-700">+{formatINR(b.inflow)}</td>
                      <td className="py-2 px-2 text-right font-medium text-rose-700">-{formatINR(b.outflow)}</td>
                      <td className="py-2 px-2 text-right font-black text-blue-950">{formatINR(b.closeBal)}</td>
                      <td className={`py-2 px-2 text-right font-bold ${b.netDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {b.netDiff >= 0 ? '+' : ''}{formatINR(b.netDiff)}
                      </td>
                    </tr>
                  ))}

                  {/* GRAND TOTAL ROW */}
                  <tr className="bg-blue-50/70 border-t-2 border-blue-400 font-extrabold text-blue-950 text-[10.5px]">
                    <td className="py-2.5 px-2">💎 GRAND TOTAL (ALL MODES)</td>
                    <td className="py-2.5 px-2 text-right">{formatINR(grandTotalOpening)}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-700">+{formatINR(totalCashIn + totalOnlineIn)}</td>
                    <td className="py-2.5 px-2 text-right text-rose-700">-{formatINR(totalCashOut + totalOnlineOut)}</td>
                    <td className="py-2.5 px-2 text-right text-blue-900 text-xs font-black">{formatINR(grandTotalClosing)}</td>
                    <td className={`py-2.5 px-2 text-right font-black ${grandTotalNetDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {grandTotalNetDiff >= 0 ? '+' : ''}{formatINR(grandTotalNetDiff)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: 💵 Physical Cash Denominations at Close */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                Physical Drawer Cash Denomination Breakdown
              </span>
              <span className="text-[10px] font-black text-amber-900">
                Closing Cash: {formatINR(closingCash)}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center text-[10px]">
              {notesList.map(n => (
                <div key={n.label} className="bg-white border border-slate-200 rounded-xl p-1.5 flex flex-col items-center shadow-2xs">
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{n.label} Notes</span>
                  <span className="font-extrabold text-slate-800">{n.count} pcs</span>
                  <span className="text-[8.5px] font-black text-amber-800 mt-0.5">{formatINR(n.count * n.value)}</span>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-2 flex justify-between items-center text-[10px]">
              <span className="text-slate-500 font-bold">Coins Total: {formatINR(coinsTotal)}</span>
              <span className="text-slate-800 font-black text-[9px] italic text-right max-w-[70%]">
                "{numberToIndianWords(closingCash)}"
              </span>
            </div>
          </div>

          {/* Section 4: 🏆 Day Net Profit & Flow Summary */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-4 shadow-md flex flex-col gap-2.5">
            <div className="flex justify-between items-center border-b border-emerald-400/40 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-100 flex items-center gap-1.5">
                🏆 Total Day Net Profit
              </span>
              <span className="text-xl font-black tracking-tight text-white drop-shadow-xs">
                +{formatINR(dayFinalProfit)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
              <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
                <span className="text-emerald-100 text-[8px] uppercase">Drawer Cash Flow</span>
                <span>Cash In: {formatINR(totalCashIn)}</span>
                <span>Cash Out: {formatINR(totalCashOut)}</span>
              </div>
              <div className="bg-white/10 rounded-xl p-2 flex flex-col gap-0.5">
                <span className="text-emerald-100 text-[8px] uppercase">Online Bank Flow</span>
                <span>Online In: {formatINR(totalOnlineIn)}</span>
                <span>Online Out: {formatINR(totalOnlineOut)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] border-t border-emerald-400/40 pt-2 text-emerald-100 font-semibold">
              <span>Opening Cash: {formatINR(openingCash)}</span>
              <span className="text-white font-black">Closing Drawer Cash: {formatINR(closingCash)}</span>
            </div>
          </div>

          {/* Section 5: 🧾 Detailed Transactions Register */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-col gap-2 shadow-2xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-blue-600" />
                Time-Wise Transaction Register ({dayTxs.length} Logged)
              </span>
              <span className="text-[9px] font-bold text-slate-500">
                Single Tx Profit & Mode Details
              </span>
            </div>

            {dayTxs.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                No individual transactions logged on this day.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {dayTxs.map((tx, idx) => {
                  const dateObj = new Date(tx.timestamp);
                  const tStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const bName = tx.bankAccountId?.bankName || 'Bank';
                  const isCredit = tx.type === 'Credit';

                  return (
                    <div key={tx._id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-1.5 text-[10px]">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-400 text-[9px]">#{idx + 1}</span>
                          <span className="font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[8.5px]">
                            ⏰ {tStr}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            isCredit ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isCredit ? 'Withdrawal' : 'Deposit'}
                          </span>
                          <span className="font-extrabold text-slate-900 ml-1">
                            {tx.customerName || 'Walk-in Customer'}
                          </span>
                        </div>

                        <span className="font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[9px]">
                          +{formatINR(tx.profit)} Tx Profit
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9px] pt-1 border-t border-slate-200/60">
                        <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-200">
                          <span className="text-slate-500 font-bold">{bName} Online:</span>
                          <span className={`font-black ${tx.customerAmount >= 0 ? 'text-blue-900' : 'text-rose-700'}`}>
                            {tx.customerAmount >= 0 ? '+' : ''}{formatINR(tx.customerAmount)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-200">
                          <span className="text-slate-500 font-bold">Drawer Cash:</span>
                          <span className={`font-black ${tx.cashOut > 0 ? 'text-amber-900' : 'text-emerald-700'}`}>
                            {tx.cashOut > 0 ? '-' : '+'}{formatINR(Math.abs(tx.cashOut))}
                          </span>
                        </div>
                      </div>

                      {tx.noteDetails && (
                        <div className="text-[8px] text-slate-500 font-semibold flex items-center justify-between">
                          <span>Notes: {tx.noteDetails}</span>
                          <span className="text-slate-400">{tx.commissionMode || 'Direct'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Notice */}
          <div className="text-center py-2 text-[9px] text-slate-400 font-medium border-t border-slate-200">
            Official Daily Comprehensive Audit Statement • {kioskTitle}
          </div>
        </div>

        {/* Bottom Action Footer (Hidden on print) */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Statement'}
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              Share WhatsApp
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            >
              <Download className="w-4 h-4" />
              {downloadSuccess ? 'Downloaded!' : 'Download Report'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
