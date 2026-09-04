const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateBody, validateParams } = require('../middleware/validation.middleware');
const { createAccountSchema, objectIdSchema } = require('../validators/account.validator');
const accountController = require('../controllers/account.controller');

const router = express.Router();

router.post('/create', authenticate, validateBody(createAccountSchema), accountController.createAccount);
router.get('/me', authenticate, accountController.getMyAccount);
router.get('/balance/:accountId', authenticate, validateParams({ accountId: objectIdSchema }), accountController.getBalance);
router.get('/:accountId/balance', authenticate, validateParams({ accountId: objectIdSchema }), accountController.getBalance);
router.get('/:accountId', authenticate, validateParams({ accountId: objectIdSchema }), accountController.getAccount);

module.exports = router;