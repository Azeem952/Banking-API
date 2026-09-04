const env = require('../config/env');
const ApiError = require('../utils/api-error');
const Customer = require('../models/customer.model');
const nibssOnboarding = require('../integrations/nibss/nibss.onboarding');

async function verifyIdentity({ userId, type, identifier }, integration = nibssOnboarding) {
  const customer = await Customer.findOne({ user: userId });

  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  if (customer.onboardingStatus === 'VERIFIED') {
    throw new ApiError(409, 'Customer is already verified');
  }

  if (customer.onboardingStatus === 'PENDING' && customer.verificationType) {
    throw new ApiError(409, 'Customer already has an onboarding request in progress');
  }

  if (env.testMode) {
    if (!/^\d{11}$/.test(String(identifier).trim())) {
      throw new ApiError(400, `${type} verification failed`);
    }

    customer.onboardingStatus = 'VERIFIED';
    customer.verificationType = type;
    customer.verificationResult = true;
    customer.verifiedAt = new Date();
    await customer.save();

    return {
      verificationType: customer.verificationType,
      onboardingStatus: customer.onboardingStatus,
      verifiedAt: customer.verifiedAt,
    };
  }

  customer.onboardingStatus = 'PENDING';
  customer.verificationType = type;
  customer.verificationResult = undefined;
  customer.verifiedAt = undefined;
  await customer.save();

  try {
    const logger = require('../config/logger');
    logger.info({ event: 'nibss_request_start', type }, 'About to call NIBSS');
    const response = type === 'BVN'
      ? await integration.validateBvn(identifier)
      : await integration.validateNin(identifier);

    logger.info({ event: 'nibss_response_received', type, valid: response?.valid }, 'NIBSS response received');

    if (response?.valid !== true || !response?.data || typeof response.data !== 'object') {
      logger.warn({ event: 'verification_check_failed', valid: response?.valid, hasData: !!response?.data, dataType: typeof response?.data }, 'Verification check failed');
      customer.onboardingStatus = 'FAILED';
      customer.verificationResult = false;
      await customer.save();
      throw new ApiError(400, `${type} verification failed`);
    }
    logger.info({ event: 'verification_accepted' }, 'Verification passed');

    customer.onboardingStatus = 'VERIFIED';
    customer.verificationResult = true;
    customer.verifiedAt = new Date();
    await customer.save();

    return {
      verificationType: customer.verificationType,
      onboardingStatus: customer.onboardingStatus,
      verifiedAt: customer.verifiedAt,
    };
  } catch (error) {
    customer.onboardingStatus = 'FAILED';
    customer.verificationResult = false;
    await customer.save();
    throw error;
  }
}

module.exports = { verifyIdentity };