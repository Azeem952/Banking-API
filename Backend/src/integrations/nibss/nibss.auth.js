const env = require('../../config/env');
const { createNIBSSClient, requireObjectResponse, NIBSSIntegrationError } = require('./nibss.client');

async function onboardFintech({ name, email }, client = createNIBSSClient()) {
  const response = await client.request({
    method: 'POST',
    url: '/api/fintech/onboard',
    data: { name, email },
  });
  return requireObjectResponse(response, 'fintech onboarding');
}

async function authenticateFintech(
  { apiKey = env.nibssApiKey, apiSecret = env.nibssApiSecret } = {},
  client = createNIBSSClient(),
) {
  if (!apiKey || !apiSecret || apiKey.includes('YOUR_') || apiSecret.includes('YOUR_')) {
    throw new Error('NIBSS credentials are not configured');
  }

  const response = await client.request({
    method: 'POST',
    url: '/api/auth/token',
    data: { apiKey, apiSecret },
  });
  const result = requireObjectResponse(response, 'authentication');

  if (typeof result.token !== 'string' || !result.token) {
    throw new NIBSSIntegrationError(502, 'NIBSS returned a malformed authentication response');
  }

  return result;
}

module.exports = { onboardFintech, authenticateFintech };