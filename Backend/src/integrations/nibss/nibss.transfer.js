const env = require('../../config/env');
const { createNIBSSClient, requireObjectResponse, NIBSSIntegrationError } = require('./nibss.client');

async function transfer({ from, to, amount }, token, client = createNIBSSClient()) {
  if (env.testMode) {
    return {
      transactionId: `TEST-EXT-${Date.now()}`,
      status: 'SUCCESS',
    };
  }

  const response = await client.request({
    method: 'POST',
    url: '/api/transfer',
    data: { from, to, amount },
    token,
  });
  const result = requireObjectResponse(response, 'transfer');

  if (!result.transactionId || !result.status) {
    throw new NIBSSIntegrationError(502, 'NIBSS returned a malformed transfer response');
  }

  return result;
}

module.exports = { transfer };