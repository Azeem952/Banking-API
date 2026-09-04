const mongoose = require('mongoose');
const { validateMoneyValue, validateCurrency, CURRENCY_CODES } = require('../utils/money');

const TRANSACTION_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
});
const TRANSACTION_TYPES = Object.freeze({
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
  INITIAL_FUNDING: 'INITIAL_FUNDING',
});
const TRANSFER_TYPES = Object.freeze({
  INTRA_BANK: 'INTRA_BANK',
  INTER_BANK: 'INTER_BANK',
  INITIAL_FUNDING: 'INITIAL_FUNDING',
});

const transactionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    fromAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
    },
    toAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator(value) {
          return validateMoneyValue(value, { allowZero: false, allowNegative: false });
        },
        message: 'Amount must be a positive safe integer amount in minor currency units',
      },
    },
    currency: {
      type: String,
      enum: Object.values(CURRENCY_CODES),
      required: true,
      default: CURRENCY_CODES.NGN,
      validate: {
        validator(value) {
          return validateCurrency(value);
        },
        message: 'Unsupported currency',
      },
    },
    status: {
      type: String,
      enum: Object.values(TRANSACTION_STATUSES),
      required: true,
      default: TRANSACTION_STATUSES.PENDING,
    },
    type: {
      type: String,
      enum: Object.values(TRANSACTION_TYPES),
      required: true,
    },
    transferType: {
      type: String,
      enum: Object.values(TRANSFER_TYPES),
      required: true,
    },
    externalTransactionId: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    recipientBankCode: {
      type: String,
      trim: true,
      match: /^\d{3,6}$/,
    },
    recipientAccountNumber: {
      type: String,
      trim: true,
      match: /^\d{10}$/,
    },
    provider: {
      type: String,
      enum: ['NIBSS'],
      default: 'NIBSS',
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 120,
      sparse: true,
      unique: true,
    },
  },
  { timestamps: true },
);

transactionSchema.index({ reference: 1 }, { unique: true });
transactionSchema.index({ fromAccount: 1, createdAt: -1 });
transactionSchema.index({ toAccount: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ externalTransactionId: 1 }, { sparse: true });
transactionSchema.index(
  { toAccount: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: TRANSACTION_TYPES.INITIAL_FUNDING } },
);

transactionSchema.pre('validate', function validateTransactionShape() {
  if (this.type === TRANSACTION_TYPES.INITIAL_FUNDING) {
    if (this.fromAccount) {
      this.invalidate('fromAccount', 'Initial funding cannot have a source account');
    }
    if (this.transferType !== TRANSFER_TYPES.INITIAL_FUNDING) {
      this.invalidate('transferType', 'Initial funding requires the INITIAL_FUNDING transfer type');
    }
  } else if (!this.fromAccount) {
    this.invalidate('fromAccount', 'A source account is required for this transaction type');
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.STATUSES = TRANSACTION_STATUSES;
module.exports.TYPES = TRANSACTION_TYPES;
module.exports.TRANSFER_TYPES = TRANSFER_TYPES;