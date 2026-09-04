const { createNIBSSClient, requireObjectResponse, NIBSSIntegrationError } = require('./nibss.client');

async function createAccount({ kycType, kycID, dob }, token, client = createNIBSSClient()) {
  const response = await client.request({
    method: 'POST',
    url: '/api/account/create',
    data: { kycType, kycID, dob },
    token,
  });
  const result = requireObjectResponse(response, 'account creation');

  if (!result.account || typeof result.account !== 'object'
    || !result.account.accountNumber || !result.account.accountName || !result.account.bankCode) {
    throw new NIBSSIntegrationError(502, 'NIBSS returned a malformed account creation response');
  }

  return result.account;
}

module.exports = { createAccount };