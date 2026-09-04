const dotenv = require('dotenv');

dotenv.config();

const port = Number.parseInt(process.env.PORT || '3000', 10);
const mongoServerSelectionTimeoutMs = Number.parseInt(
  process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000',
  10,
);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

if (!Number.isInteger(mongoServerSelectionTimeoutMs) || mongoServerSelectionTimeoutMs < 1000) {
  throw new Error('MONGODB_SERVER_SELECTION_TIMEOUT_MS must be an integer of at least 1000');
}

const nibssTimeoutMs = Number.parseInt(process.env.NIBSS_TIMEOUT_MS || '10000', 10);

if (!Number.isInteger(nibssTimeoutMs) || nibssTimeoutMs < 1000) {
  throw new Error('NIBSS_TIMEOUT_MS must be an integer of at least 1000');
}

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const safeCorsOrigin = corsOrigin === '*' ? 'http://localhost:3000' : corsOrigin;

const nodeEnv = process.env.NODE_ENV || 'development';
const testMode = process.env.TEST_MODE === 'true' && nodeEnv !== 'production';

if (process.env.TEST_MODE === 'true' && nodeEnv === 'production') {
  throw new Error('TEST_MODE cannot be enabled in production environment');
}

module.exports = Object.freeze({
  nodeEnv,
  port,
  mongoUri: process.env.MONGODB_URI || '',
  mongoServerSelectionTimeoutMs,
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtAlgorithm: process.env.JWT_ALGORITHM || 'HS256',
  nibssBaseUrl: process.env.NIBSS_BASE_URL || '',
  nibssApiKey: process.env.NIBSS_API_KEY || '',
  nibssApiSecret: process.env.NIBSS_API_SECRET || '',
  nibssTimeoutMs,
  corsOrigin: safeCorsOrigin,
  bodyLimit: process.env.BODY_LIMIT || '100kb',
  testMode,
});