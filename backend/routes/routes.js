const express = require('express');
const router = express.Router();
const {
  getBankAccounts,
  createBankAccount,
  getActiveDay,
  openDay,
  closeDay,
  getDayHistory,
  createTransaction,
  getTransactions,
  exportBackup,
  exportBackupCSV,
  importBackup,
  bulkUpdateAccounts,
  adjustPhysicalCash,
  updateTransactionCustomerName,
  emailTodayBackupEndpoint,
  emailRangeBackupEndpoint,
  reopenDay,
  triggerCronBackup
} = require('../controllers/controllers');

// Bank Accounts
router.get('/accounts', getBankAccounts);
router.post('/accounts', createBankAccount);
router.put('/accounts/bulk-update', bulkUpdateAccounts);

// Day Summary
router.get('/day/active', getActiveDay);
router.post('/day/open', openDay);
router.post('/day/close', closeDay);
router.post('/day/reopen', reopenDay);
router.get('/day/history', getDayHistory);
router.put('/day/adjust-cash', adjustPhysicalCash);

// Transactions
router.get('/transactions', getTransactions);
router.post('/transactions', createTransaction);
router.put('/transactions/:id/name', updateTransactionCustomerName);

// Backup and Exports
router.get('/backup/export', exportBackup);
router.get('/backup/export-csv', exportBackupCSV);
router.post('/backup/import', importBackup);
router.post('/backup/email-today', emailTodayBackupEndpoint);
router.post('/backup/email-range', emailRangeBackupEndpoint);
router.get('/cron-backup', triggerCronBackup);

module.exports = router;


