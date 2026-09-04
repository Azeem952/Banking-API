const Joi = require('joi');

const objectIdSchema = Joi.string().pattern(/^[a-fA-F0-9]{24}$/).required();

const createAccountSchema = Joi.object({
  kycType: Joi.string().valid('bvn', 'nin', 'BVN', 'NIN').required(),
  kycID: Joi.string().pattern(/^\d{11}$/).required(),
  dob: Joi.string().isoDate().required(),
}).required();

module.exports = { createAccountSchema, objectIdSchema };