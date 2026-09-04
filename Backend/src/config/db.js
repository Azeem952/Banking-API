const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

let listenersRegistered = false;
let disconnectedHandler;

function registerConnectionListeners() {
  if (listenersRegistered) {
    return;
  }

  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connection established');
  });

  mongoose.connection.on('error', () => {
    logger.error('MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection disconnected');
    if (disconnectedHandler) {
      disconnectedHandler();
    }
  });

  listenersRegistered = true;
}

function setDisconnectedHandler(handler) {
  disconnectedHandler = handler;
}

async function assertTransactionsSupported() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error('MongoDB transactions require a replica set or sharded deployment');
  }
}

async function connectDatabase() {
  if (!env.mongoUri || env.mongoUri === 'YOUR_MONGODB_CONNECTION_STRING') {
    throw new Error('MONGODB_URI is not configured');
  }

  registerConnectionListeners();
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
  });
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  setDisconnectedHandler,
  assertTransactionsSupported,
};