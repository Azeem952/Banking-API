const Joi = require('joi');
const ApiError = require('../utils/api-error');

function normalizeSchema(schema) {
  if (schema && typeof schema.validate === 'function') {
    return schema;
  }

  if (schema && typeof schema === 'object') {
    return Joi.object(schema).required();
  }

  return Joi.object({}).required();
}

function validateRequest(schema, source, errorMessage) {
  const joiSchema = normalizeSchema(schema);

  return (request, response, next) => {
    const payload = source === 'body'
      ? request.body
      : source === 'query'
        ? request.query
        : request.params;

    const { error, value } = joiSchema.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const fields = error.details.map((detail) => detail.path.join('.'));
      return next(new ApiError(400, errorMessage, fields));
    }

    if (source === 'body') {
      request.body = value;
    } else if (source === 'query') {
      request.query = value;
    } else {
      request.params = value;
    }

    return next();
  };
}

function validateBody(schema) {
  return validateRequest(schema, 'body', 'Invalid request body');
}

function validateQuery(schema) {
  return validateRequest(schema, 'query', 'Invalid query parameters');
}

function validateParams(schema) {
  return validateRequest(schema, 'params', 'Invalid route parameters');
}

module.exports = { validateBody, validateQuery, validateParams };