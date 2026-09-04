const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../config/db');

const TEST_DB_NAME = 'digital-banking-phase17-test';

async function ensureTestEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase17-test-secret';
  process.env.MONGODB_URI = process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${TEST_DB_NAME}`;
  process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
}

async function resetTestDatabase() {
  await ensureTestEnvironment();
  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }
  await mongoose.connection.db.dropDatabase();
}

async function closeTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.db.dropDatabase();
    await disconnectDatabase();
  }
}

module.exports = {
  ensureTestEnvironment,
  resetTestDatabase,
  closeTestDatabase,
};
