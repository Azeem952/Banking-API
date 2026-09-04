const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/api-error');
const Account = require('../models/account.model');
const Customer = require('../models/customer.model');
const Transaction = require('../models/transaction.model');
const nibssAuth = require('../integrations/nibss/nibss.auth');
const nibssNameEnquiry = require('../integrations/nibss/nibss.name-enquiry');
const nibssTransfer = require('../integrations/nibss/nibss.transfer');
const nibssTransactionStatus = require('../integrations/nibss/nibss.transaction-status');
const { NIBSSIntegrationError } = require('../integrations/nibss/nibss.client');
const generateReference = require('../utils/generate-reference');
const { assertTransactionsSupported } = require('../config/db');

const SUPPORTED_BANKS = Object.freeze({
  '000001': 'Test Bank',
  '260': 'PHC Bank',
  '703': 'Test Bank',
});

function normalizeAccountName(accountName) {
  return String(accountName || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizeTransferAmount(rawAmount) {
  let amount = rawAmount;

  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new ApiError(400, 'Transfer amount must be a positive integer');
    }
    amount = Number(trimmed);
  }

  if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
    throw new ApiError(400, 'Transfer amount must be a positive integer');
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ApiError(400, 'Transfer amount must be a positive integer');
  }

  return amount;
}

function mapNIBSSStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(normalized)) {
    return Transaction.STATUSES.SUCCESS;
  }
  if (['FAILED', 'REJECTED', 'DECLINED'].includes(normalized)) {
    return Transaction.STATUSES.FAILED;
  }
  if (['PENDING', 'PROCESSING', 'IN_PROGRESS'].includes(normalized)) {
    return Transaction.STATUSES.PENDING;
  }
  return Transaction.STATUSES.UNKNOWN;
}

async function getRecipientNameEnquiry({ bankCode, accountNumber, isInterBank = false }, dependencies = {}) {
  const normalizedBankCode = String(bankCode || '').trim();
  const normalizedAccountNumber = String(accountNumber || '').trim();

  if (!/^\d{3,6}$/.test(normalizedBankCode)) {
    throw new ApiError(400, 'Invalid bank code');
  }

  if (!/^\d{10}$/.test(normalizedAccountNumber)) {
    throw new ApiError(400, 'Invalid account number');
  }

  if (!SUPPORTED_BANKS[normalizedBankCode]) {
    throw new ApiError(400, 'Unsupported destination bank');
  }

  if (env.testMode) {
    // For inter-bank transfers, return mock response (recipient is from another bank, not in our DB)
    if (isInterBank) {
      return {
        accountNumber: normalizedAccountNumber,
        bankCode: normalizedBankCode,
        accountName: normalizeAccountName(`TEST RECIPIENT ${normalizedAccountNumber.slice(-4)}`),
      };
    }

    // For intra-bank, check if account actually exists in the database
    const existingAccount = await Account.findOne({ 
      accountNumber: normalizedAccountNumber,
      bankCode: normalizedBankCode
    }).lean();
    
    if (!existingAccount) {
      throw new ApiError(404, 'Recipient account not found');
    }
    
    return {
      accountNumber: normalizedAccountNumber,
      bankCode: normalizedBankCode,
      accountName: normalizeAccountName(existingAccount.accountName || `TEST RECIPIENT ${normalizedAccountNumber.slice(-4)}`),
    };
  }

  const authFn = dependencies.authenticateFintech || nibssAuth.authenticateFintech;
  const enquiryFn = dependencies.nameEnquiry || nibssNameEnquiry.nameEnquiry;

  let token;
  try {
    const authResult = await authFn();
    token = authResult.token;
  } catch (error) {
    throw new ApiError(503, 'NIBSS authentication is unavailable');
  }

  try {
    const result = await enquiryFn(normalizedAccountNumber, token);

    if (!result || !result.accountName || !result.accountNumber || !result.bankCode) {
      throw new ApiError(502, 'NIBSS returned incomplete recipient information');
    }

    if (String(result.accountNumber) !== normalizedAccountNumber) {
      throw new ApiError(502, 'Recipient account number mismatch');
    }

    if (String(result.bankCode) !== normalizedBankCode) {
      throw new ApiError(502, 'Recipient bank mismatch');
    }

    return {
      accountNumber: result.accountNumber,
      bankCode: result.bankCode,
      accountName: normalizeAccountName(result.accountName),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof NIBSSIntegrationError) {
      if (error.statusCode === 401) {
        throw new ApiError(503, 'NIBSS authentication failed');
      }
      if (error.statusCode === 404) {
        throw new ApiError(404, 'Recipient account not found');
      }
      if (error.statusCode === 409) {
        throw new ApiError(400, 'Destination bank is unavailable');
      }
      throw new ApiError(502, 'Recipient name enquiry failed');
    }

    if (error && error.message && /not found|invalid/i.test(error.message)) {
      throw new ApiError(404, 'Recipient account not found');
    }

    throw new ApiError(502, 'Recipient name enquiry failed');
  }
}

async function createIntraBankTransfer({ userId, recipientAccountId, recipientAccountNumber, amount }) {
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const normalizedAmount = normalizeTransferAmount(amount);
  
  // Support both ObjectId (for admin/testing) and account number (for frontend)
  let recipientAccount;
  
  if (recipientAccountId && mongoose.Types.ObjectId.isValid(recipientAccountId)) {
    logger.info({ event: 'transfer_attempt', userId, recipientAccountId, amount: normalizedAmount, transferType: 'INTRA_BANK' }, 'Intra-bank transfer attempt started');
    recipientAccount = await Account.findOne({ _id: recipientAccountId }).lean();
  } else if (recipientAccountNumber) {
    const normalizedAccountNumber = String(recipientAccountNumber || '').trim();
    logger.info({ event: 'transfer_attempt', userId, recipientAccountNumber: normalizedAccountNumber, amount: normalizedAmount, transferType: 'INTRA_BANK' }, 'Intra-bank transfer attempt started');
    recipientAccount = await Account.findOne({ accountNumber: normalizedAccountNumber }).lean();
  } else {
    throw new ApiError(400, 'Recipient account ID or account number is required');
  }

  try {
    await assertTransactionsSupported();
  } catch (error) {
    throw new ApiError(503, 'Transfer service is temporarily unavailable');
  }

  const customer = await Customer.findOne({ user: userId }).lean();
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const senderAccount = await Account.findOne({ customer: customer._id }).lean();
  if (!senderAccount) {
    throw new ApiError(404, 'Sender account not found');
  }

  if (senderAccount.status !== 'ACTIVE') {
    throw new ApiError(400, 'Sender account is not active');
  }

  if (!recipientAccount) {
    throw new ApiError(404, 'Recipient account not found');
  }

  if (recipientAccount.status !== 'ACTIVE') {
    throw new ApiError(400, 'Recipient account is not active');
  }

  if (senderAccount._id.toString() === recipientAccount._id.toString()) {
    throw new ApiError(400, 'Self-transfer is not allowed');
  }

  if (senderAccount.bankCode !== recipientAccount.bankCode) {
    throw new ApiError(400, 'Recipient account is not in the same bank');
  }

  if (senderAccount.currency !== recipientAccount.currency) {
    throw new ApiError(400, 'Transfer currency mismatch');
  }

  const recipientName = normalizeAccountName(recipientAccount.accountName);
  const reference = generateReference('TRF');
  const session = await mongoose.startSession();

  try {
    let createdTransaction;

    await session.withTransaction(async () => {
      const debitResult = await Account.updateOne(
        {
          _id: senderAccount._id,
          status: 'ACTIVE',
          balance: { $gte: normalizedAmount },
        },
        { $inc: { balance: -normalizedAmount } },
        { session },
      );

      if (debitResult.matchedCount === 0) {
        throw new ApiError(400, 'Insufficient available balance');
      }

      const creditResult = await Account.updateOne(
        {
          _id: recipientAccount._id,
          status: 'ACTIVE',
        },
        { $inc: { balance: normalizedAmount } },
        { session },
      );

      if (creditResult.matchedCount === 0) {
        throw new ApiError(409, 'Recipient account is not available for credit');
      }

      const [transaction] = await Transaction.create([{
        reference,
        fromAccount: senderAccount._id,
        toAccount: recipientAccount._id,
        amount: normalizedAmount,
        currency: senderAccount.currency || 'NGN',
        status: Transaction.STATUSES.SUCCESS,
        type: Transaction.TYPES.DEBIT,
        transferType: Transaction.TRANSFER_TYPES.INTRA_BANK,
      }], { session });

      createdTransaction = transaction;
    });

    logger.info({ event: 'transfer_success', userId, reference: createdTransaction.reference, amount: normalizedAmount, transferType: 'INTRA_BANK' }, 'Intra-bank transfer completed');
    return {
      reference: createdTransaction.reference,
      senderAccountId: senderAccount._id,
      recipientAccountId: recipientAccount._id,
      recipientName,
      amount: normalizedAmount,
      currency: senderAccount.currency || 'NGN',
      status: createdTransaction.status,
      createdAt: createdTransaction.createdAt,
    };
  } catch (error) {
    logger.error({ event: 'transfer_failed', userId, amount: normalizedAmount, recipientAccountId, errorName: error.name, errorMessage: error.message }, 'Intra-bank transfer failed');
    if (error instanceof ApiError) {
      throw error;
    }

    if (error && error.code === 11000) {
      throw new ApiError(409, 'Duplicate transfer reference');
    }

    throw new ApiError(500, 'Transfer failed');
  } finally {
    await session.endSession();
  }
}

async function createInterBankTransfer({ userId, recipientBank, recipientAccountNumber, amount, idempotencyKey }) {
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const normalizedAmount = normalizeTransferAmount(amount);
  logger.info({ event: 'interbank_transfer_attempt', userId, recipientBank, recipientAccountNumber, amount: normalizedAmount }, 'Inter-bank transfer attempt started');
  const normalizedBankCode = String(recipientBank || '').trim();
  const normalizedAccountNumber = String(recipientAccountNumber || '').trim();

  if (!/^\d{3,6}$/.test(normalizedBankCode)) {
    throw new ApiError(400, 'Invalid recipient bank');
  }

  if (!/^\d{10}$/.test(normalizedAccountNumber)) {
    throw new ApiError(400, 'Invalid recipient account number');
  }

  if (!SUPPORTED_BANKS[normalizedBankCode]) {
    throw new ApiError(400, 'Unsupported recipient bank');
  }

  try {
    await assertTransactionsSupported();
  } catch (error) {
    throw new ApiError(503, 'Transfer service is temporarily unavailable');
  }

  const customer = await Customer.findOne({ user: userId }).lean();
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const senderAccount = await Account.findOne({ customer: customer._id }).lean();
  if (!senderAccount) {
    throw new ApiError(404, 'Sender account not found');
  }

  if (senderAccount.status !== 'ACTIVE') {
    throw new ApiError(400, 'Sender account is not active');
  }

  if (senderAccount.balance < normalizedAmount) {
    throw new ApiError(400, 'Insufficient available balance');
  }

  if (idempotencyKey) {
    const existing = await Transaction.findOne({ idempotencyKey }).lean();
    if (existing) {
      return {
        reference: existing.reference,
        senderAccountId: senderAccount._id,
        recipientBankCode: existing.recipientBankCode,
        recipientAccountNumber: existing.recipientAccountNumber,
        amount: existing.amount,
        currency: existing.currency,
        status: existing.status,
        externalReference: existing.externalTransactionId,
      };
    }
  }

  const recipient = await getRecipientNameEnquiry({
    bankCode: normalizedBankCode,
    accountNumber: normalizedAccountNumber,
    isInterBank: true,
  });

  const reference = generateReference('TRF');
  const transaction = await Transaction.create({
    reference,
    fromAccount: senderAccount._id,
    toAccount: senderAccount._id,
    amount: normalizedAmount,
    currency: senderAccount.currency || 'NGN',
    status: env.testMode ? Transaction.STATUSES.SUCCESS : Transaction.STATUSES.PENDING,
    type: Transaction.TYPES.DEBIT,
    transferType: Transaction.TRANSFER_TYPES.INTER_BANK,
    recipientBankCode: normalizedBankCode,
    recipientAccountNumber: normalizedAccountNumber,
    provider: 'NIBSS',
    idempotencyKey: idempotencyKey || undefined,
  });

  try {
    if (env.testMode) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const debitResult = await Account.updateOne(
            {
              _id: senderAccount._id,
              status: 'ACTIVE',
              balance: { $gte: normalizedAmount },
            },
            { $inc: { balance: -normalizedAmount } },
            { session },
          );

          if (debitResult.matchedCount === 0) {
            throw new ApiError(400, 'Insufficient available balance');
          }

          await Transaction.updateOne({ _id: transaction._id }, {
            status: Transaction.STATUSES.SUCCESS,
            externalTransactionId: reference,
            failureReason: undefined,
          }, { session });
        });
      } finally {
        await session.endSession();
      }

      return {
        reference: transaction.reference,
        senderAccountId: senderAccount._id,
        recipientBankCode: normalizedBankCode,
        recipientAccountNumber: normalizedAccountNumber,
        recipientName: recipient.accountName,
        amount: normalizedAmount,
        currency: senderAccount.currency || 'NGN',
        status: Transaction.STATUSES.SUCCESS,
        externalReference: reference,
      };
    }

    const authResult = await nibssAuth.authenticateFintech();
    const providerResponse = await nibssTransfer.transfer({
      from: senderAccount.accountNumber,
      to: {
        bankCode: normalizedBankCode,
        accountNumber: normalizedAccountNumber,
      },
      amount: normalizedAmount,
    }, authResult.token);

    const nextStatus = mapNIBSSStatus(providerResponse.status);
    const externalRef = providerResponse.transactionId || providerResponse.externalReference || providerResponse.id;

    if (nextStatus === Transaction.STATUSES.SUCCESS) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const debitResult = await Account.updateOne(
            {
              _id: senderAccount._id,
              status: 'ACTIVE',
              balance: { $gte: normalizedAmount },
            },
            { $inc: { balance: -normalizedAmount } },
            { session },
          );

          if (debitResult.matchedCount === 0) {
            throw new ApiError(400, 'Insufficient available balance');
          }

          await Transaction.updateOne({ _id: transaction._id }, {
            status: Transaction.STATUSES.SUCCESS,
            externalTransactionId: externalRef,
            failureReason: undefined,
          }, { session });
        });
      } finally {
        await session.endSession();
      }

      return {
        reference: transaction.reference,
        senderAccountId: senderAccount._id,
        recipientBankCode: normalizedBankCode,
        recipientAccountNumber: normalizedAccountNumber,
        recipientName: recipient.accountName,
        amount: normalizedAmount,
        currency: senderAccount.currency || 'NGN',
        status: Transaction.STATUSES.SUCCESS,
        externalReference: externalRef,
      };
    }

    if (nextStatus === Transaction.STATUSES.FAILED) {
      await Transaction.updateOne({ _id: transaction._id }, {
        status: Transaction.STATUSES.FAILED,
        externalTransactionId: externalRef,
        failureReason: providerResponse.message || providerResponse.reason || 'Transfer rejected by provider',
      });
      throw new ApiError(400, 'Inter-bank transfer was rejected');
    }

    await Transaction.updateOne({ _id: transaction._id }, {
      status: nextStatus,
      externalTransactionId: externalRef,
      failureReason: providerResponse.message || providerResponse.reason || 'Transfer is pending review',
    });

    logger.info({ event: 'interbank_transfer_pending', userId, reference: transaction.reference, amount: normalizedAmount, status: nextStatus }, 'Inter-bank transfer status updated');
    return {
      reference: transaction.reference,
      senderAccountId: senderAccount._id,
      recipientBankCode: normalizedBankCode,
      recipientAccountNumber: normalizedAccountNumber,
      recipientName: recipient.accountName,
      amount: normalizedAmount,
      currency: senderAccount.currency || 'NGN',
      status: nextStatus,
      externalReference: externalRef,
    };
  } catch (error) {
    logger.error({ event: 'interbank_transfer_failed', userId, reference: transaction.reference, amount: normalizedAmount, errorName: error.name, errorMessage: error.message }, 'Inter-bank transfer failed');
    if (error instanceof ApiError) {
      if (error.statusCode === 400 && error.message === 'Inter-bank transfer was rejected') {
        throw error;
      }
      throw error;
    }

    if (error instanceof NIBSSIntegrationError) {
      await Transaction.updateOne({ _id: transaction._id }, {
        status: Transaction.STATUSES.UNKNOWN,
        failureReason: error.message || 'NIBSS response could not be verified',
      });
      throw new ApiError(502, 'Inter-bank transfer could not be confirmed');
    }

    if (error && error.code === 11000) {
      throw new ApiError(409, 'Duplicate inter-bank transfer');
    }

    throw new ApiError(500, 'Inter-bank transfer failed');
  }
}

async function getTransactionStatus({ userId, transactionId, includeExternalStatus = false }) {
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!transactionId || typeof transactionId !== 'string' || !transactionId.trim()) {
    throw new ApiError(400, 'Invalid transaction ID');
  }

  const lookup = mongoose.Types.ObjectId.isValid(transactionId)
    ? { _id: transactionId }
    : { reference: transactionId };

  const transaction = await Transaction.findOne(lookup).lean();
  if (!transaction) {
    throw new ApiError(404, 'Transaction not found');
  }

  const senderAccount = await Account.findById(transaction.fromAccount).lean();
  if (!senderAccount) {
    throw new ApiError(404, 'Transaction sender account not found');
  }

  const senderCustomer = await Customer.findById(senderAccount.customer).lean();
  if (!senderCustomer || senderCustomer.user.toString() !== userId) {
    throw new ApiError(403, 'Unauthorized transaction access');
  }

  let currentStatus = transaction.status;
  let externalStatus = null;

  if (includeExternalStatus && transaction.externalTransactionId && transaction.transferType === Transaction.TRANSFER_TYPES.INTER_BANK) {
    try {
      const statusResult = await checkExternalTransactionStatus({
        transactionId: transaction._id,
        externalTransactionId: transaction.externalTransactionId,
        currentStatus: transaction.status,
      });
      currentStatus = statusResult.updatedStatus;
      externalStatus = statusResult.externalStatus;
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 503) {
        throw error;
      }
    }
  }

  return {
    id: transaction._id,
    reference: transaction.reference,
    status: currentStatus,
    externalStatus,
    externalTransactionId: transaction.externalTransactionId,
    type: transaction.type,
    transferType: transaction.transferType,
    amount: transaction.amount,
    currency: transaction.currency,
    fromAccountId: transaction.fromAccount,
    toAccountId: transaction.toAccount,
    recipientBankCode: transaction.recipientBankCode,
    recipientAccountNumber: transaction.recipientAccountNumber,
    idempotencyKey: transaction.idempotencyKey,
    failureReason: transaction.failureReason,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

async function checkExternalTransactionStatus({ transactionId, externalTransactionId, currentStatus }) {
  if (!externalTransactionId) {
    throw new ApiError(400, 'No external transaction ID to check');
  }

  const isTerminalStatus = [Transaction.STATUSES.SUCCESS, Transaction.STATUSES.FAILED].includes(currentStatus);
  if (isTerminalStatus) {
    return {
      updatedStatus: currentStatus,
      externalStatus: currentStatus,
    };
  }

  let token;
  try {
    const authResult = await nibssAuth.authenticateFintech();
    token = authResult.token;
  } catch (error) {
    throw new ApiError(503, 'NIBSS authentication is unavailable');
  }

  let externalResult;
  try {
    externalResult = await nibssTransactionStatus.transactionStatus(externalTransactionId, token);
  } catch (error) {
    if (error instanceof NIBSSIntegrationError) {
      if (error.statusCode === 404) {
        throw new ApiError(404, 'External transaction not found');
      }
      if (error.statusCode === 401 || error.statusCode === 403) {
        throw new ApiError(503, 'NIBSS authentication failed');
      }
      throw new ApiError(502, 'NIBSS status check failed');
    }
    throw new ApiError(502, 'External transaction status check failed');
  }

  const mappedExternalStatus = mapNIBSSStatus(externalResult.status);

  if (mappedExternalStatus !== currentStatus && [Transaction.STATUSES.SUCCESS, Transaction.STATUSES.FAILED].includes(mappedExternalStatus)) {
    await Transaction.findByIdAndUpdate(transactionId, {
      status: mappedExternalStatus,
      failureReason: mappedExternalStatus === Transaction.STATUSES.FAILED ? (externalResult.message || 'Status synchronized from external provider') : undefined,
    });

    return {
      updatedStatus: mappedExternalStatus,
      externalStatus: mappedExternalStatus,
    };
  }

  return {
    updatedStatus: currentStatus,
    externalStatus: mappedExternalStatus,
  };
}

module.exports = {
  getRecipientNameEnquiry,
  createIntraBankTransfer,
  createInterBankTransfer,
  getTransactionStatus,
  checkExternalTransactionStatus,
  SUPPORTED_BANKS,
};
