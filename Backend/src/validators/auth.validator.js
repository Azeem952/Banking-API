const Joi = require('joi');

const credentialsSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(254).required(),
  password: Joi.string().min(8).max(128).required(),
}).required();

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().min(20).max(512).required(),
}).required();

const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(254).required(),
}).required();

const resetPasswordSchema = Joi.object({
  token: Joi.string().min(20).max(512).required(),
  password: Joi.string().min(8).max(128).required(),
}).required();

module.exports = {
  credentialsSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};