const mongoose = require('mongoose');
const ApiError = require('../utils/api-error');
const Customer = require('../models/customer.model');
const Account = require('../models/account.model');
const Transaction = require('../models/transaction.model');

async function getTransactionHistory({
  userId,
  page = 1,
  limit = 20,
  type = null,
  status = null,
  from = null,
  to = null,
  sort = 'createdAt',
  direction = 'desc',
}) {
  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  // Validate pagination
  if (page < 1) {
    throw new ApiError(400, 'Page must be at least 1');
  }
  if (limit < 1 || limit > 100) {
    throw new ApiError(400, 'Limit must be between 1 and 100');
  }

  // Validate sort field
  const validSortFields = ['createdAt', 'amount'];
  if (!validSortFields.includes(sort)) {
    throw new ApiError(400, `Invalid sort field. Allowed: ${validSortFields.join(', ')}`);
  }

  // Validate sort direction
  const validDirections = ['asc', 'desc'];
  if (!validDirections.includes(direction)) {
    throw new ApiError(400, `Invalid sort direction. Allowed: ${validDirections.join(', ')}`);
  }

  // Validate type
  const validTypes = ['CREDIT', 'DEBIT', 'INITIAL_FUNDING'];
  if (type && !validTypes.includes(type)) {
    throw new ApiError(400, `Invalid transaction type. Allowed: ${validTypes.join(', ')}`);
  }

  // Validate status
  const validStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'UNKNOWN'];
  if (status && !validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid transaction status. Allowed: ${validStatuses.join(', ')}`);
  }

  // Validate date range
  if (from && to && new Date(from) > new Date(to)) {
    throw new ApiError(400, 'From date must be before to date');
  }

  // Get customer and account
  const customer = await Customer.findOne({ user: userId }).lean();
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const account = await Account.findOne({ customer: customer._id }).lean();
  if (!account) {
    throw new ApiError(404, 'Account not found');
  }

  // Build query: transactions where account is sender OR receiver
  const query = {
    $or: [
      { fromAccount: account._id },
      { toAccount: account._id },
    ],
  };

  // Add type filter if provided
  if (type) {
    query.type = type;
  }

  // Add status filter if provided
  if (status) {
    query.status = status;
  }

  // Add date range filter if provided
  if (from || to) {
    query.createdAt = {};
    if (from) {
      query.createdAt.$gte = new Date(from);
    }
    if (to) {
      query.createdAt.$lte = new Date(to);
    }
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Build sort object
  const sortObj = {};
  sortObj[sort] = direction === 'asc' ? 1 : -1;

  // Execute query for data
  const transactions = await Transaction.find(query)
    .select('reference status type transferType amount currency fromAccount toAccount createdAt updatedAt externalTransactionId recipientBankCode recipientAccountNumber idempotencyKey failureReason')
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count for pagination metadata
  const totalTransactions = await Transaction.countDocuments(query);
  const totalPages = Math.ceil(totalTransactions / limit);

  return {
    transactions: transactions.map(tx => ({
      id: tx._id,
      reference: tx.reference,
      status: tx.status,
      type: tx.type,
      transferType: tx.transferType,
      amount: tx.amount,
      currency: tx.currency,
      fromAccountId: tx.fromAccount,
      toAccountId: tx.toAccount,
      externalTransactionId: tx.externalTransactionId,
      recipientBankCode: tx.recipientBankCode,
      recipientAccountNumber: tx.recipientAccountNumber,
      idempotencyKey: tx.idempotencyKey,
      failureReason: tx.failureReason,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    })),
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalTransactions,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

module.exports = {
  getTransactionHistory,
};
