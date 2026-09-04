const authService = require('../services/auth.service');
const { successResponse } = require('../utils/api-response');

async function register(request, response, next) {
  try {
    const user = await authService.register(request.body);
    return response.status(201).json(successResponse({ user }, 'Registration successful'));
  } catch (error) {
    return next(error);
  }
}

async function login(request, response, next) {
  try {
    const authentication = await authService.login(request.body);
    return response.json(successResponse(authentication, 'Login successful'));
  } catch (error) {
    return next(error);
  }
}

async function refresh(request, response, next) {
  try {
    const authentication = await authService.refresh(request.body);
    return response.json(successResponse(authentication, 'Token refreshed successfully'));
  } catch (error) {
    return next(error);
  }
}

async function logout(request, response, next) {
  try {
    const result = await authService.logout(request.body);
    return response.json(successResponse(result, 'Logout successful'));
  } catch (error) {
    return next(error);
  }
}

async function forgotPassword(request, response, next) {
  try {
    await authService.forgotPassword(request.body);
    const safeMessage = 'If an account exists for that email, a password reset link has been sent.';
    return response.json(successResponse(null, safeMessage));
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(request, response, next) {
  try {
    const result = await authService.resetPassword(request.body);
    return response.json(successResponse(result, 'Password reset successful'));
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword };