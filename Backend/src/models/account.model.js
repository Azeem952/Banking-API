const mongoose = require('mongoose');
const { validateMoneyValue, validateCurrency, CURRENCY_CODES } = require('../utils/money');

const ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
});

const accountSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      enum: Object.values(CURRENCY_CODES),
      required: true,
      default: CURRENCY_CODES.NGN,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{10}$/,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    bankCode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{3}$/,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      validate: {
        validator(value) {
          return validateMoneyValue(value, { allowZero: true });
        },
        message: 'Balance must be a non-negative safe integer in minor currency units',
      },
    },
    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUSES),
      required: true,
      default: ACCOUNT_STATUSES.ACTIVE,
    },
  },
  { timestamps: true },
);

accountSchema.index({ accountNumber: 1 }, { unique: true });
accountSchema.index({ customer: 1 }, { unique: true });
accountSchema.index({ bankCode: 1 });

module.exports = mongoose.model('Account', accountSchema);
module.exports.STATUSES = ACCOUNT_STATUSES;