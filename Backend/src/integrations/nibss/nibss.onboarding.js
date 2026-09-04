const env = require('../../config/env');
const { createNIBSSClient, requireObjectResponse, NIBSSIntegrationError } = require('./nibss.client');
const logger = require('../../config/logger');

function normalizeVerificationResponse(response, operation) {
  const payload = requireObjectResponse(response, operation);

  if (payload.success === false) {
    return { valid: false, data: payload.data || null };
  }

  const data = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : payload;

  if (payload.success !== true || !data || typeof data !== 'object' || Array.isArray(data)) {
    throw new NIBSSIntegrationError(502, `NIBSS returned a malformed ${operation} response`);
  }

  return { valid: true, data, raw: payload };
}

async function insertBvn(data, client = createNIBSSClient()) {
  const response = await client.request({ method: 'POST', url: '/api/insertBvn', data });
  return requireObjectResponse(response, 'BVN creation');
}

async function insertNin(data, client = createNIBSSClient()) {
  const response = await client.request({ method: 'POST', url: '/api/insertNin', data });
  return requireObjectResponse(response, 'NIN creation');
}

async function validateBvn(bvn, client = createNIBSSClient()) {
  if (env.testMode) {
    if (!/^\d{11}$/.test(String(bvn))) {
      return { valid: false, data: null };
    }
    return {
      valid: true,
      data: { bvn, firstName: 'Test', lastName: 'Customer' },
      raw: { success: true, data: { bvn, firstName: 'Test', lastName: 'Customer' } },
    };
  }

  const response = await client.request({ method: 'POST', url: '/api/validateBvn', data: { bvn } });
  return normalizeVerificationResponse(response, 'BVN validation');
}

async function validateNin(nin, client = createNIBSSClient()) {
  if (env.testMode) {
    if (!/^\d{11}$/.test(String(nin))) {
      return { valid: false, data: null };
    }
    return {
      valid: true,
      data: { nin, firstName: 'Test', lastName: 'Customer' },
      raw: { success: true, data: { nin, firstName: 'Test', lastName: 'Customer' } },
    };
  }

  const response = await client.request({ method: 'POST', url: '/api/validateNin', data: { nin } });
  return normalizeVerificationResponse(response, 'NIN validation');
}

module.exports = { insertBvn, insertNin, validateBvn, validateNin };