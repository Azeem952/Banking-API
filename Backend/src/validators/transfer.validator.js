const Joi = require('joi');

const objectIdSchema = Joi.string().pattern(/^[a-fA-F0-9]{24}$/).required();

const nameEnquirySchema = Joi.object({
  bankCode: Joi.string().trim().pattern(/^\d{3,6}$/).required(),
  accountNumber: Joi.string().trim().pattern(/^\d{10}$/).required(),
  isInterBank: Joi.boolean().optional().default(false),
}).required();

const transferSchema = Joi.object({
  recipientAccountId: objectIdSchema.optional(),
  recipientAccountNumber: Joi.string().trim().pattern(/^\d{10}$/).optional(),
  amount: Joi.alternatives().try(
    Joi.number().integer().positive().required(),
    Joi.string().trim().pattern(/^\d+$/).required(),
  ).required(),
}).required();

const interBankTransferSchema = Joi.object({
  recipientBank: Joi.string().trim().pattern(/^\d{3,6}$/).required(),
  recipientAccountNumber: Joi.string().trim().pattern(/^\d{10}$/).required(),
  amount: Joi.alternatives().try(
    Joi.number().integer().positive().required(),
    Joi.string().trim().pattern(/^\d+$/).required(),
  ).required(),
  idempotencyKey: Joi.string().trim().min(1).max(120).optional(),
}).required();

const transactionStatusSchema = Joi.object({
  includeExternalStatus: Joi.boolean().optional().default(false),
}).optional();

const transactionIdSchema = Joi.alternatives()
  .try(objectIdSchema, Joi.string().trim().min(1).max(120).pattern(/^[A-Za-z0-9\-]+$/))
  .required();

module.exports = {
  nameEnquirySchema,
  transferSchema,
  interBankTransferSchema,
  transactionStatusSchema,
  transactionIdSchema,
};
