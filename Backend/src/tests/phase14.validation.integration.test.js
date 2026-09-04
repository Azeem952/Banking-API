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
const { connectDatabase, disconnectDatabase } = require('../config/db');

function httpRequest(server, method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const request = http.request({
      port: server.address().port,
      method,
      path,
      headers: {
        'content-type': 'application/json',
        ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
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
    if (payload) request.write(payload);
    request.end();
  });
}

(async () => {
  assert.ok(env.jwtSecret && env.jwtSecret !== 'YOUR_JWT_SECRET_HERE');
  await connectDatabase();
  const server = app.listen(0);

  try {
    const user = await User.create({
      email: `phase14-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const customer = await Customer.create({
      user: user._id,
      onboardingStatus: 'VERIFIED',
      verificationType: 'BVN',
      verificationResult: true,
      verifiedAt: new Date(),
    });
    const account = await Account.create({
      accountNumber: '7031234567',
      accountName: 'Phase 14 User',
      bankCode: '703',
      customer: customer._id,
      balance: 25000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const token = jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    const invalidBody = await httpRequest(server, 'POST', '/api/auth/register', { email: 'bad-email', password: 'short' });
    assert.equal(invalidBody.status, 400);
    assert.equal(invalidBody.body.success, false);
    assert.ok(Array.isArray(invalidBody.body.details) || invalidBody.body.message.length > 0);

    const invalidAccountId = await httpRequest(server, 'GET', '/api/account/not-a-valid-id', null, token);
    assert.equal(invalidAccountId.status, 400);
    assert.equal(invalidAccountId.body.success, false);

    const invalidTransactionId = await httpRequest(server, 'GET', '/api/transfers/status/not-a-valid-id', null, token);
    assert.equal(invalidTransactionId.status, 400);
    assert.equal(invalidTransactionId.body.success, false);

    const invalidHistoryQuery = await httpRequest(server, 'GET', '/api/transactions/history?page=abc&limit=xyz&sort=bad', null, token);
    assert.equal(invalidHistoryQuery.status, 400);
    assert.equal(invalidHistoryQuery.body.success, false);

    const duplicateEmail = await httpRequest(server, 'POST', '/api/auth/register', { email: user.email, password: 'Password123' });
    assert.equal(duplicateEmail.status, 409);
    assert.equal(duplicateEmail.body.success, false);
    assert.ok(!/Mongo|E11000|duplicate/.test(duplicateEmail.body.message));

    console.log('Phase 14 validation and error handling checks passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 14 database cleaned up');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
