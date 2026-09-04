const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../app');
const env = require('../config/env');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const Account = require('../models/account.model');
const Transaction = require('../models/transaction.model');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const nibssAuth = require('../integrations/nibss/nibss.auth');
const nibssNameEnquiry = require('../integrations/nibss/nibss.name-enquiry');
const nibssTransfer = require('../integrations/nibss/nibss.transfer');

function request(server, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      port: server.address().port,
      method: 'POST',
      path: '/api/transfers/interbank',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (response) => {
      let responseBody = '';
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({
        status: response.statusCode,
        body: responseBody ? JSON.parse(responseBody) : {},
      }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

(async () => {
  assert.ok(env.jwtSecret && env.jwtSecret !== 'YOUR_JWT_SECRET_HERE');
  await connectDatabase();
  const server = app.listen(0);
  const originalAuthenticateFintech = nibssAuth.authenticateFintech;
  const originalNameEnquiry = nibssNameEnquiry.nameEnquiry;
  const originalTransfer = nibssTransfer.transfer;

  try {
    nibssAuth.authenticateFintech = async () => ({ token: 'fake-nibss-token' });
    nibssNameEnquiry.nameEnquiry = async (accountNumber, token) => {
      assert.equal(token, 'fake-nibss-token');
      assert.equal(accountNumber, '0123456789');
      return { accountName: 'PHASE 10 RECIPIENT', accountNumber: '0123456789', bankCode: '260' };
    };
    nibssTransfer.transfer = async ({ from, to, amount }, token) => {
      assert.equal(token, 'fake-nibss-token');
      assert.equal(from, '7031234567');
      assert.equal(to.bankCode, '260');
      assert.equal(to.accountNumber, '0123456789');
      assert.equal(amount, 5000);
      return { status: 'SUCCESS', transactionId: 'EXT-1001' };
    };

    const senderUser = await User.create({
      email: `phase10-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const senderCustomer = await Customer.create({
      user: senderUser._id,
      onboardingStatus: 'VERIFIED',
      verificationType: 'BVN',
      verificationResult: true,
      verifiedAt: new Date(),
    });
    const senderAccount = await Account.create({
      accountNumber: '7031234567',
      accountName: 'Phase 10 Sender',
      bankCode: '703',
      customer: senderCustomer._id,
      balance: 25000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const senderToken = jwt.sign({ sub: senderUser._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    const success = await request(server, {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 5000,
      idempotencyKey: 'phase10-1',
    }, senderToken);
    assert.equal(success.status, 200);
    assert.equal(success.body.success, true);
    assert.equal(success.body.data.transfer.status, 'SUCCESS');
    assert.equal(success.body.data.transfer.amount, 5000);
    assert.equal(success.body.data.transfer.externalReference, 'EXT-1001');

    const senderAfterSuccess = await Account.findById(senderAccount._id);
    assert.equal(senderAfterSuccess.balance, 20000);

    const tx = await Transaction.findOne({ reference: success.body.data.transfer.reference });
    assert.ok(tx);
    assert.equal(tx.externalTransactionId, 'EXT-1001');
    assert.equal(tx.recipientBankCode, '260');
    assert.equal(tx.recipientAccountNumber, '0123456789');
    assert.equal(tx.idempotencyKey, 'phase10-1');

    const invalidAmount = await request(server, {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 0,
    }, senderToken);
    assert.equal(invalidAmount.status, 400);

    const insufficient = await request(server, {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 999999,
    }, senderToken);
    assert.equal(insufficient.status, 400);

    const duplicate = await request(server, {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 1000,
      idempotencyKey: 'phase10-1',
    }, senderToken);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.data.transfer.reference, tx.reference);

    const unauthenticated = await request(server, {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 1000,
    });
    assert.equal(unauthenticated.status, 401);

    console.log('Phase 10 inter-bank transfer validation passed');
  } finally {
    nibssAuth.authenticateFintech = originalAuthenticateFintech;
    nibssNameEnquiry.nameEnquiry = originalNameEnquiry;
    nibssTransfer.transfer = originalTransfer;
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 10 database cleaned up');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
