const express = require('express');
const { randomUUID } = require('node:crypto');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const { errorResponse } = require('./utils/api-response');
const ApiError = require('./utils/api-error');
const env = require('./config/env');
const logger = require('./config/logger');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/auth.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const accountRoutes = require('./routes/account.routes');
const transferRoutes = require('./routes/transfer.routes');
const transactionRoutes = require('./routes/transaction.routes');

const app = express();
const allowedOrigins = env.corsOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use((request, response, next) => {
  const requestId = request.get('x-request-id') || randomUUID();
  request.id = requestId;
  response.setHeader('x-request-id', requestId);

  const startedAt = Date.now();
  logger.info({ requestId, method: request.method, url: request.originalUrl }, 'Request received');

  response.on('finish', () => {
    logger.info({
      requestId,
      method: request.method,
      url: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
    }, 'Request completed');
  });

  return next();
});
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new ApiError(403, 'Not allowed by CORS policy'));
  },
  credentials: true,
}));
app.use(express.json({ limit: env.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

// Swagger UI setup - create a router for docs
const docsRouter = express.Router();
docsRouter.use(swaggerUi.serve);
docsRouter.get('/', swaggerUi.setup(swaggerSpec));
docsRouter.get('/swagger.json', (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.json(swaggerSpec);
});
app.use('/api-docs', docsRouter);

app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/transactions', transactionRoutes);

app.use((request, response, next) => {
  response.apiSuccess = (data, message) => {
    response.json({ success: true, message: message || 'Request successful', data });
  };
  next();
});

app.use((request, response, next) => {
  next(new ApiError(404, `Route not found: ${request.method} ${request.originalUrl}`));
});

app.use((error, request, response, next) => {
  let statusCode = error.statusCode || 500;
  let message = statusCode >= 500 ? 'Internal server error' : error.message;
  let details = error.details;

  if (error && error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid request data';
    details = Object.keys(error.errors || {}).map((field) => field);
  } else if (error && error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier';
    details = [error.path];
  } else if (error && error.code === 11000) {
    statusCode = 409;
    message = 'A duplicate record already exists';
    details = undefined;
  } else if (error && error.name === 'MongoServerError' && error.code === 11000) {
    statusCode = 409;
    message = 'A duplicate record already exists';
    details = undefined;
  } else if (error && error.name === 'MongooseError') {
    statusCode = 400;
    message = 'Invalid request data';
    details = undefined;
  }

  const logDetails = {
    requestId: request.id,
    method: request.method,
    url: request.originalUrl,
    statusCode,
    errorName: error.name,
    errorMessage: error.message,
  };

  if (statusCode >= 500) {
    if (error.name === 'ApiError' || error.name === 'NIBSSIntegrationError') {
      logger.error(logDetails, 'Application error');
    } else {
      logger.error({ ...logDetails, err: error }, 'Unhandled application error');
    }
  } else {
    logger.warn(logDetails, 'Client error handled');
  }

  response.status(statusCode).json(errorResponse(message, statusCode >= 500 ? undefined : details));
});

module.exports = app;