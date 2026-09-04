const jwt = require('jsonwebtoken');
const ApiError = require('../utils/api-error');
const env = require('../config/env');

function authenticate(request, response, next) {
  const authorization = request.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token || token.split('.').length !== 3) {
    return next(new ApiError(401, 'Authentication required'));
  }

  if (!env.jwtSecret || env.jwtSecret === 'YOUR_JWT_SECRET_HERE') {
    return next(new ApiError(500, 'Authentication is not configured'));
  }

  try {
    request.user = jwt.verify(token, env.jwtSecret, {
      algorithms: [env.jwtAlgorithm || 'HS256'],
    });
    return next();
  } catch (error) {
    return next(new ApiError(401, 'Invalid or expired authentication token'));
  }
}

module.exports = { authenticate };