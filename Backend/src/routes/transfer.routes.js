const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { nameEnquiryRateLimit } = require('../middleware/rate-limit.middleware');
const { validateBody, validateParams } = require('../middleware/validation.middleware');
const { nameEnquirySchema, transferSchema, interBankTransferSchema, transactionIdSchema } = require('../validators/transfer.validator');
const transferController = require('../controllers/transfer.controller');

const router = express.Router();

router.post('/', authenticate, validateBody(transferSchema), transferController.createTransfer);
router.post('/interbank', authenticate, validateBody(interBankTransferSchema), transferController.createInterBankTransfer);
router.post('/name-enquiry', authenticate, validateBody(nameEnquirySchema), nameEnquiryRateLimit, transferController.nameEnquiry);
router.get('/status/:transactionId', authenticate, validateParams({ transactionId: transactionIdSchema }), transferController.getTransactionStatus);

module.exports = router;
