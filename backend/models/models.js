const mongoose = require('mongoose');

// Bank Account Schema
const BankAccountSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  currentBalance: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: true });

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  bankAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    required: true
  },
  type: {
    type: String,
    enum: ['Credit'],
    default: 'Credit',
    required: true
  },
  customerAmount: {
    type: Number,
    required: true,
    min: 0
  },
  cashOut: {
    type: Number,
    required: true,
    min: 0
  },
  profit: {
    type: Number,
    required: true,
    min: 0
  }
}, { timestamps: true });

// Day Summary Schema
const DaySummarySchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    unique: true
  },
  openingCash: {
    type: Number,
    required: true,
    default: 0
  },
  closingCash: {
    type: Number,
    required: true,
    default: 0
  },
  totalProfit: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['Open', 'Closed'],
    default: 'Open',
    required: true
  }
}, { timestamps: true });

const BankAccount = mongoose.model('BankAccount', BankAccountSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const DaySummary = mongoose.model('DaySummary', DaySummarySchema);

module.exports = {
  BankAccount,
  Transaction,
  DaySummary
};
