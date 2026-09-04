const axios = require('axios');
const ApiError = require('../../utils/api-error');
const env = require('../../config/env');
const logger = require('../../config/logger');

class NIBSSIntegrationError extends ApiError {
  constructor(statusCode, message) {
    super(statusCode, message);
    this.name = 'NIBSSIntegrationError';
  }
}

function createNIBSSClient(overrides = {}) {
  if (!overrides.baseURL && !env.nibssBaseUrl) {
    throw new NIBSSIntegrationError(500, 'NIBSS integration is not configured');
  }

  const client = axios.create({
    baseURL: overrides.baseURL || env.nibssBaseUrl,
    timeout: overrides.timeout || env.nibssTimeoutMs,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  async function request({ method, url, data, token }) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    logger.info({ method, path: url }, 'NIBSS request');

    try {
      const response = await client.request({ method, url, data, headers });
      logger.info({ method, path: url, status: response.status }, 'NIBSS response');
      return response.data;
    } catch (error) {
      if (error instanceof NIBSSIntegrationError) {
        throw error;
      }

      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        logger.error({ method, path: url, errorCode: error.code, timeoutMs: client.defaults.timeout }, 'NIBSS request timed out');
        throw new NIBSSIntegrationError(504, 'NIBSS request timed out');
      }

      if (!error.response) {
        logger.error({ method, path: url, errorCode: error.code, errorMessage: error.message }, 'NIBSS is unavailable');
        throw new NIBSSIntegrationError(503, 'NIBSS is unavailable');
      }

      const statusCode = [400, 401, 404, 409, 500].includes(error.response.status)
        ? error.response.status
        : 502;
      logger.error({ method, path: url, statusCode, errorStatus: error.response.status }, 'NIBSS request failed');
      throw new NIBSSIntegrationError(statusCode, 'NIBSS request failed');
    }
  }

  return { request };
}

function requireObjectResponse(response, operation) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new NIBSSIntegrationError(502, `NIBSS returned a malformed ${operation} response`);
  }
  return response;
}

module.exports = { createNIBSSClient, requireObjectResponse, NIBSSIntegrationError };