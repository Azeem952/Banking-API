const { createNIBSSClient, requireObjectResponse, NIBSSIntegrationError } = require('./nibss.client');

async function nameEnquiry(accountNumber, token, client = createNIBSSClient()) {
  const response = await client.request({
    method: 'GET',
    url: `/api/account/name-enquiry/${encodeURIComponent(accountNumber)}`,
    token,
  });
  const result = requireObjectResponse(response, 'Name Enquiry');

  if (!result.accountName || !result.accountNumber || !result.bankCode) {
    throw new NIBSSIntegrationError(502, 'NIBSS returned a malformed Name Enquiry response');
  }

  return result;
}

module.exports = { nameEnquiry };