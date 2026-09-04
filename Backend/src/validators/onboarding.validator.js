const Joi = require('joi');

const identityNumber = Joi.string().pattern(/^\d{11}$/).required();

const bvnSchema = Joi.object({ bvn: identityNumber }).required();
const ninSchema = Joi.object({ nin: identityNumber }).required();

module.exports = { bvnSchema, ninSchema };