const express = require('express');
const authController = require('../controllers/auth.controller');
const {
  credentialsSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validator');
const { validateBody } = require('../middleware/validation.middleware');
const { loginRateLimit } = require('../middleware/rate-limit.middleware');

const router = express.Router();

router.post('/register', validateBody(credentialsSchema), authController.register);
router.post('/login', loginRateLimit, validateBody(credentialsSchema), authController.login);
router.post('/refresh', validateBody(refreshTokenSchema), authController.refresh);
router.post('/logout', validateBody(refreshTokenSchema), authController.logout);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);

module.exports = router;