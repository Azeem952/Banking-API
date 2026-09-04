const transactionService = require('../services/transaction.service');
const { successResponse } = require('../utils/api-response');

async function getHistory(request, response, next) {
  try {
    const result = await transactionService.getTransactionHistory({
      userId: request.user.sub,
      page: request.query.page ? parseInt(request.query.page, 10) : 1,
      limit: request.query.limit ? parseInt(request.query.limit, 10) : 20,
      type: request.query.type || null,
      status: request.query.status || null,
      from: request.query.from || null,
      to: request.query.to || null,
      sort: request.query.sort || 'createdAt',
      direction: request.query.direction || 'desc',
    });

    return response.status(200).json(successResponse(result, 'Transaction history retrieved successfully'));
  } catch (error) {
    return next(error);
  }
}

module.exports = { getHistory };
