const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  serializers: {
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'token',
      'refreshToken',
      'accessToken',
      'jwt',
      'apiKey',
      'apiSecret',
      'bvn',
      'nin',
      'secret',
      'authorization',
      'session',
    ],
    censor: '[Redacted]',
  },
});