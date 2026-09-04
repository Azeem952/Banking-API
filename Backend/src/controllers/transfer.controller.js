const transferService = require('../services/transfer.service');
const { successResponse } = require('../utils/api-response');

async function nameEnquiry(request, response, next) {
  try {
    const result = await transferService.getRecipientNameEnquiry({
      bankCode: request.body.bankCode,
      accountNumber: request.body.accountNumber,
      isInterBank: request.body.isInterBank,
    });
    return response.json(successResponse({ ...result }, 'Recipient name retrieved successfully'));
  } catch (error) {
    return next(error);
  }
}

async function createTransfer(request, response, next) {
  try {
    const result = await transferService.createIntraBankTransfer({
      userId: request.user.sub,
      recipientAccountNumber: request.body.recipientAccountNumber,
      recipientAccountId: request.body.recipientAccountId,
      amount: request.body.amount,
    });

    return response.status(200).json(successResponse({ transfer: result }, 'Transfer completed successfully'));
  } catch (error) {
    return next(error);
  }
}

async function createInterBankTransfer(request, response, next) {
  try {
    const result = await transferService.createInterBankTransfer({
      userId: request.user.sub,
      recipientBank: request.body.recipientBank,
      recipientAccountNumber: request.body.recipientAccountNumber,
      amount: request.body.amount,
      idempotencyKey: request.body.idempotencyKey,
    });

    return response.status(200).json(successResponse({ transfer: result }, 'Inter-bank transfer processed successfully'));
  } catch (error) {
    return next(error);
  }
}

async function getTransactionStatus(request, response, next) {
  try {
    const result = await transferService.getTransactionStatus({
      userId: request.user.sub,
      transactionId: request.params.transactionId,
      includeExternalStatus: request.query.includeExternalStatus === 'true',
    });

    return response.status(200).json(successResponse({ transaction: result }, 'Transaction status retrieved successfully'));
  } catch (error) {
    return next(error);
  }
}

module.exports = { nameEnquiry, createTransfer, createInterBankTransfer, getTransactionStatus };
