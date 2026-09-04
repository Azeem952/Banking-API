const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDatabase, disconnectDatabase, setDisconnectedHandler } = require('./config/db');

let server;
let shuttingDown = false;

setDisconnectedHandler(() => { void shutdown('MONGODB_DISCONNECTED'); });

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, 'Shutdown signal received');

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    await disconnectDatabase();
    logger.info('Server and database closed cleanly');
  } catch (error) {
    logger.error({ err: error }, 'Shutdown failed');
    process.exitCode = 1;
  }
}

async function start() {
  try {
    await connectDatabase();
    server = app.listen(env.port, () => {
      logger.info({ port: env.port, environment: env.nodeEnv, testMode: env.testMode }, 'Digital banking server started');
    });
    return server;
  } catch (error) {
    logger.error({ errorName: error.name }, 'MongoDB startup failed');
    await disconnectDatabase();
    process.exitCode = 1;
    return undefined;
  }
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });

if (require.main === module) {
  void start();
}

module.exports = { start, shutdown };