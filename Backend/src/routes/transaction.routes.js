const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validateQuery } = require('../middleware/validation.middleware');
const { historyQuerySchema } = require('../validators/transaction.validator');
const transactionController = require('../controllers/transaction.controller');

const router = express.Router();

router.get('/history', authenticate, validateQuery(historyQuerySchema), transactionController.getHistory);

module.exports = router;
