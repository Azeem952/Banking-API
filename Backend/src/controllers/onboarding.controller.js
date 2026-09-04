const onboardingService = require('../services/onboarding.service');
const { successResponse } = require('../utils/api-response');

async function verifyBvn(request, response, next) {
  try {
    const result = await onboardingService.verifyIdentity({
      userId: request.user.sub,
      type: 'BVN',
      identifier: request.body.bvn,
    });
    return response.json(successResponse(result, 'BVN verification successful'));
  } catch (error) {
    return next(error);
  }
}

async function verifyNin(request, response, next) {
  try {
    const result = await onboardingService.verifyIdentity({
      userId: request.user.sub,
      type: 'NIN',
      identifier: request.body.nin,
    });
    return response.json(successResponse(result, 'NIN verification successful'));
  } catch (error) {
    return next(error);
  }
}

module.exports = { verifyBvn, verifyNin };