const mongoose = require('mongoose');
const env = require('../config/env');
const ApiError = require('../utils/api-error');
const Account = require('../models/account.model');
const Customer = require('../models/customer.model');
const Transaction = require('../models/transaction.model');
const nibssAuth = require('../integrations/nibss/nibss.auth');
const nibssAccount = require('../integrations/nibss/nibss.account');
const generateReference = require('../utils/generate-reference');
const { assertTransactionsSupported } = require('../config/db');

const INITIAL_FUNDING_AMOUNT = 15000;

function serializeAccount(account) {
  return {
    id: account._id,
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    bankCode: account.bankCode,
    currency: account.currency || 'NGN',
    status: account.status,
    balance: account.balance,
    customerId: account.customer ? account.customer.toString() : undefined,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

async function getAuthenticatedCustomerAccount(userId) {
  const customer = await Customer.findOne({ user: userId }).select('_id');
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const account = await Account.findOne({ customer: customer._id }).lean();
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }

  if (account.status !== Account.STATUSES.ACTIVE) {
    throw new ApiError(403, 'Account is not active');
  }

  return serializeAccount(account);
}

async function getAccountForCustomer(userId, accountId) {
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    throw new ApiError(400, 'Invalid account ID');
  }

  const customer = await Customer.findOne({ user: userId }).select('_id');
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const account = await Account.findOne({ _id: accountId }).lean();
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }

  if (account.customer.toString() !== customer._id.toString()) {
    throw new ApiError(403, 'You do not have access to this account');
  }

  if (account.status !== Account.STATUSES.ACTIVE) {
    throw new ApiError(403, 'Account is not active');
  }

  return serializeAccount(account);
}

async function getAccountBalanceForCustomer(userId, accountId) {
  if (!mongoose.Types.ObjectId.isValid(accountId)) {
    throw new ApiError(400, 'Invalid account ID');
  }

  const customer = await Customer.findOne({ user: userId }).select('_id');
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const account = await Account.findOne({ _id: accountId }).lean();
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }

  if (account.customer.toString() !== customer._id.toString()) {
    throw new ApiError(403, 'You do not have access to this account');
  }

  if (account.status !== Account.STATUSES.ACTIVE) {
    throw new ApiError(403, 'Account is not active');
  }

  return {
    accountId: account._id,
    accountNumber: account.accountNumber,
    balance: account.balance,
    currency: account.currency || 'NGN',
  };
}

async function createAccount({ userId, kycType, kycID, dob }, dependencies = {}) {
  const auth = dependencies.nibssAuth || nibssAuth;
  const accountIntegration = dependencies.nibssAccount || nibssAccount;
  const customer = await Customer.findOne({ user: userId });

  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }
  if (customer.status !== 'ACTIVE' || customer.onboardingStatus !== 'VERIFIED') {
    throw new ApiError(403, 'Customer is not eligible to create an account');
  }

  try {
    await assertTransactionsSupported();
  } catch (error) {
    throw new ApiError(503, 'Account creation is temporarily unavailable');
  }

  const session = await mongoose.startSession();
  try {
    let createdAccount;
    await session.withTransaction(async () => {
      const existingAccount = await Account.findOne({ customer: customer._id }).session(session);
      if (existingAccount) {
        throw new ApiError(409, 'Customer already has an account');
      }

      let remoteAccount;
      if (env.testMode) {
        // Keep the mock realistic so it matches the Account schema used by the app.
        const generatedAccountNumber = String(Date.now() + Math.floor(Math.random() * 10000000)).slice(-10).padStart(10, '0');
        remoteAccount = {
          accountNumber: generatedAccountNumber,
          accountName: 'Test Account',
          bankCode: '703',
        };
      } else {
        const nibssToken = await auth.authenticateFintech();
        remoteAccount = await accountIntegration.createAccount(
          { kycType, kycID, dob },
          nibssToken.token,
        );
      }

      try {
        const [account] = await Account.create([{
          accountNumber: remoteAccount.accountNumber,
          accountName: remoteAccount.accountName,
          bankCode: remoteAccount.bankCode,
          customer: customer._id,
          balance: INITIAL_FUNDING_AMOUNT,
          status: 'ACTIVE',
          currency: 'NGN',
        }], { session });

        await Transaction.create([{
          reference: generateReference('FUND'),
          toAccount: account._id,
          amount: INITIAL_FUNDING_AMOUNT,
          status: 'SUCCESS',
          type: 'INITIAL_FUNDING',
          transferType: 'INITIAL_FUNDING',
          currency: 'NGN',
        }], { session });
        createdAccount = account;
      } catch (createError) {
        // Handle unique index violation for customer field
        if (createError.code === 11000 && createError.message && createError.message.includes('customer')) {
          throw new ApiError(409, 'Customer already has an account');
        }
        throw createError;
      }
    });

    return {
      id: createdAccount._id,
      accountNumber: createdAccount.accountNumber,
      accountName: createdAccount.accountName,
      bankCode: createdAccount.bankCode,
      balance: createdAccount.balance,
      status: createdAccount.status,
    };
  } catch (error) {
    if (error.code === 11000 || error.statusCode === 409) {
      throw new ApiError(409, 'Account already exists or account creation was duplicated');
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  createAccount,
  INITIAL_FUNDING_AMOUNT,
  getAuthenticatedCustomerAccount,
  getAccountForCustomer,
  getAccountBalanceForCustomer,
};