const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const User = require('../models/user.model');
const ApiError = require('../utils/api-error');
const env = require('../config/env');
const Customer = require('../models/customer.model');

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function safeUser(user) {
  return {
    id: user._id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function ensureJwtConfigured() {
  if (!env.jwtSecret || env.jwtSecret === 'YOUR_JWT_SECRET_HERE') {
    throw new Error('JWT_SECRET is not configured');
  }
}

function createAccessToken(user) {
  ensureJwtConfigured();
  return jwt.sign({ sub: user._id.toString(), email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

async function issueRefreshToken(user) {
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const refreshTokenHash = await bcrypt.hash(refreshToken, 12);

  user.refreshTokenHash = refreshTokenHash;
  user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await user.save();

  return refreshToken;
}

async function findUserByRefreshToken(refreshToken) {
  const users = await User.find({
    refreshTokenExpiresAt: { $gt: new Date() },
  }).select('+refreshTokenHash');

  for (const user of users) {
    if (user.refreshTokenHash && await bcrypt.compare(refreshToken, user.refreshTokenHash)) {
      return user;
    }
  }

  return null;
}

async function findUserByResetToken(resetToken) {
  const users = await User.find({
    passwordResetTokenExpiresAt: { $gt: new Date() },
  }).select('+passwordResetTokenHash');

  for (const user of users) {
    if (user.passwordResetTokenHash && await bcrypt.compare(resetToken, user.passwordResetTokenHash)) {
      return user;
    }
  }

  return null;
}

async function register({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  logger.info({ event: 'register_request', email: normalizedEmail }, 'Registration request received');
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({ email: normalizedEmail, passwordHash });
    try {
      await Customer.create({ user: user._id });
    } catch (customerError) {
      await User.deleteOne({ _id: user._id });
      throw customerError;
    }
    logger.info({ event: 'register_success', userId: user._id.toString() }, 'User registration completed');
    return safeUser(user);
  } catch (error) {
    if (error.code === 11000) {
      logger.warn({ event: 'register_conflict', email: normalizedEmail }, 'Duplicate registration attempt');
      throw new ApiError(409, 'An account with that email already exists');
    }
    logger.error({ event: 'register_failed', email: normalizedEmail, errorName: error.name }, 'Registration failed');
    throw error;
  }
}

async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  logger.info({ event: 'login_attempt', email: normalizedEmail }, 'Login attempt received');
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash +failedLoginAttempts +lockedUntil +refreshTokenHash');

  if (!user) {
    logger.warn({ event: 'login_failed', reason: 'user_not_found' }, 'Authentication failure');
    throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    logger.warn({ event: 'login_failed', userId: user._id.toString(), reason: 'account_locked' }, 'Authentication failure while account is locked');
    throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      logger.warn({ event: 'account_locked', userId: user._id.toString(), failedAttempts: user.failedLoginAttempts }, 'Account locked after repeated failures');
    } else {
      logger.warn({ event: 'login_failed', userId: user._id.toString(), failedAttempts: user.failedLoginAttempts }, 'Authentication failure');
    }
    await user.save();
    throw new ApiError(401, INVALID_CREDENTIALS_MESSAGE);
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  const token = createAccessToken(user);
  const refreshToken = await issueRefreshToken(user);
  logger.info({ event: 'login_success', userId: user._id.toString() }, 'Login succeeded');

  return { token, refreshToken, user: safeUser(user) };
}

async function refresh({ refreshToken }) {
  if (!refreshToken) {
    throw new ApiError(400, 'Refresh token is required');
  }

  const user = await findUserByRefreshToken(refreshToken);
  if (!user) {
    logger.warn({ event: 'refresh_failed', reason: 'invalid_refresh_token' }, 'Refresh token rejected');
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const token = createAccessToken(user);
  const rotatedRefreshToken = await issueRefreshToken(user);
  logger.info({ event: 'refresh_success', userId: user._id.toString() }, 'Refresh token rotated');

  return { token, refreshToken: rotatedRefreshToken, user: safeUser(user) };
}

async function logout({ refreshToken }) {
  if (!refreshToken) {
    throw new ApiError(400, 'Refresh token is required');
  }

  const user = await findUserByRefreshToken(refreshToken);
  if (!user) {
    logger.warn({ event: 'logout_failed', reason: 'invalid_refresh_token' }, 'Logout rejected');
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();
  logger.info({ event: 'logout_success', userId: user._id.toString() }, 'User logged out and refresh token revoked');

  return { revoked: true };
}

async function forgotPassword({ email }) {
  const normalizedEmail = normalizeEmail(email);
  logger.info({ event: 'password_reset_requested', email: normalizedEmail }, 'Password reset request received');
  const user = await User.findOne({ email: normalizedEmail });

  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenHash = await bcrypt.hash(resetToken, 12);

    user.passwordResetTokenHash = passwordResetTokenHash;
    user.passwordResetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    user.passwordResetUsedAt = null;
    await user.save();
    logger.info({ event: 'password_reset_token_issued', userId: user._id.toString() }, 'Password reset token issued');

    return {
      message: 'If an account exists for that email, a password reset link has been sent.',
      resetToken,
    };
  }

  logger.info({ event: 'password_reset_requested', email: normalizedEmail, status: 'no_account' }, 'Password reset request processed without revealing account existence');
  return {
    message: 'If an account exists for that email, a password reset link has been sent.',
  };
}

async function resetPassword({ token, password }) {
  if (!token) {
    throw new ApiError(400, 'Reset token is required');
  }

  const user = await findUserByResetToken(token);
  if (!user) {
    logger.warn({ event: 'password_reset_failed', reason: 'invalid_reset_token' }, 'Password reset rejected');
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  user.passwordHash = passwordHash;
  user.passwordResetTokenHash = null;
  user.passwordResetTokenExpiresAt = null;
  user.passwordResetUsedAt = new Date();
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();
  logger.info({ event: 'password_reset_success', userId: user._id.toString() }, 'Password reset completed and active sessions invalidated');

  return { passwordReset: true };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  safeUser,
  INVALID_CREDENTIALS_MESSAGE,
};