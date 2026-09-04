const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateBody } = require('../middleware/validation.middleware');
const { bvnSchema, ninSchema } = require('../validators/onboarding.validator');
const onboardingController = require('../controllers/onboarding.controller');

const router = express.Router();

router.post('/bvn', authenticate, validateBody(bvnSchema), onboardingController.verifyBvn);
router.post('/nin', authenticate, validateBody(ninSchema), onboardingController.verifyNin);

module.exports = router;