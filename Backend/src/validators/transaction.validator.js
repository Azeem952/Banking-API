const Joi = require('joi');

const historyQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(20),
  type: Joi.string()
    .trim()
    .pattern(/^(CREDIT|DEBIT|INITIAL_FUNDING)$/)
    .optional(),
  status: Joi.string()
    .trim()
    .pattern(/^(PENDING|SUCCESS|FAILED|UNKNOWN)$/)
    .optional(),
  from: Joi.date()
    .iso()
    .optional(),
  to: Joi.date()
    .iso()
    .optional(),
  sort: Joi.string()
    .trim()
    .pattern(/^(createdAt|amount)$/)
    .optional()
    .default('createdAt'),
  direction: Joi.string()
    .trim()
    .pattern(/^(asc|desc)$/)
    .optional()
    .default('desc'),
}).optional();

module.exports = { historyQuerySchema };
