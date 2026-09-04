const env = require('../../config/env');
const { createNIBSSClient, requireObjectResponse, NIBSSIntegrationError } = require('./nibss.client');

async function transactionStatus(transactionId, token, client = createNIBSSClient()) {
  if (env.testMode) {
    return {
      transactionId,
      status: 'SUCCESS',
    };
  }

  const response = await client.request({
    method: 'GET',
    url: `/api/transaction/${encodeURIComponent(transactionId)}`,
    token,
  });
  const result = requireObjectResponse(response, 'transaction status');

  if (!result.transactionId || !result.status) {
    throw new NIBSSIntegrationError(502, 'NIBSS returned a malformed transaction status response');
  }

  return result;
}

module.exports = { transactionStatus };