const accountService = require('../services/account.service');
const { successResponse } = require('../utils/api-response');

async function createAccount(request, response, next) {
  try {
    const account = await accountService.createAccount({
      userId: request.user.sub,
      kycType: request.body.kycType,
      kycID: request.body.kycID,
      dob: request.body.dob,
    });
    return response.status(201).json(successResponse({ account }, 'Account created successfully'));
  } catch (error) {
    return next(error);
  }
}

async function getMyAccount(request, response, next) {
  try {
    const account = await accountService.getAuthenticatedCustomerAccount(request.user.sub);
    return response.json(successResponse({ account }, 'Account retrieved successfully'));
  } catch (error) {
    return next(error);
  }
}

async function getAccount(request, response, next) {
  try {
    const account = await accountService.getAccountForCustomer(request.user.sub, request.params.accountId);
    return response.json(successResponse({ account }, 'Account retrieved successfully'));
  } catch (error) {
    return next(error);
  }
}

async function getBalance(request, response, next) {
  try {
    const account = await accountService.getAccountBalanceForCustomer(request.user.sub, request.params.accountId);
    return response.json(successResponse({ account }, 'Balance retrieved successfully'));
  } catch (error) {
    return next(error);
  }
}

module.exports = { createAccount, getMyAccount, getAccount, getBalance };