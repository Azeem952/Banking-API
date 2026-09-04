const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../app');
const env = require('../config/env');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const nibssOnboarding = require('../integrations/nibss/nibss.onboarding');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const ApiError = require('../utils/api-error');

function request(server, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      port: server.address().port,
      method,
      path,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (response) => {
      let responseBody = '';
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(responseBody) }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

(async () => {
  assert.ok(env.jwtSecret && env.jwtSecret !== 'YOUR_JWT_SECRET_HERE');
  await connectDatabase();
  const server = app.listen(0);
  const originalValidateBvn = nibssOnboarding.validateBvn;
  const originalValidateNin = nibssOnboarding.validateNin;
  let bvnCalls = 0;
  let ninCalls = 0;

  try {
    nibssOnboarding.validateBvn = async () => {
      bvnCalls += 1;
      return {
        valid: true,
        data: {
          bvn: '12345678901',
          firstName: 'Jane',
          lastName: 'Doe',
          dob: '1990-01-01T00:00:00.000Z',
          phone: '08012345678',
        },
      };
    };
    nibssOnboarding.validateNin = async () => {
      ninCalls += 1;
      return {
        valid: false,
        data: null,
      };
    };

    const email = `onboarding-${Date.now()}@example.com`;
    const password = 'correct horse battery';
    const registration = await request(server, 'POST', '/api/auth/register', { email, password });
    assert.equal(registration.status, 201);
    const user = await User.findOne({ email });
    const token = jwt.sign({ sub: user._id.toString(), email }, env.jwtSecret, { expiresIn: '1h' });

    const missingAuth = await request(server, 'POST', '/api/onboarding/bvn', { bvn: '12345678901' });
    assert.equal(missingAuth.status, 401);

    const invalidBvn = await request(server, 'POST', '/api/onboarding/bvn', { bvn: '123' }, token);
    assert.equal(invalidBvn.status, 400);
    assert.equal(JSON.stringify(invalidBvn.body).includes('123'), false);

    const successfulBvn = await request(server, 'POST', '/api/onboarding/bvn', { bvn: '12345678901' }, token);
    assert.equal(successfulBvn.status, 200);
    assert.deepEqual(successfulBvn.body.data.verificationType, 'BVN');
    assert.equal(JSON.stringify(successfulBvn.body).includes('12345678901'), false);
    assert.equal(bvnCalls, 1);

    const customer = await Customer.findOne({ user: user._id });
    assert.equal(customer.onboardingStatus, 'VERIFIED');
    assert.equal(customer.verificationResult, true);
    assert.ok(customer.verifiedAt);

    const alreadyVerified = await request(server, 'POST', '/api/onboarding/nin', { nin: '10987654321' }, token);
    assert.equal(alreadyVerified.status, 409);
    assert.equal(JSON.stringify(alreadyVerified.body).includes('10987654321'), false);

    await Customer.updateOne(
      { _id: customer._id },
      { $set: { onboardingStatus: 'PENDING' }, $unset: { verificationType: 1, verificationResult: 1, verifiedAt: 1 } },
    );
    const failedNin = await request(server, 'POST', '/api/onboarding/nin', { nin: '10987654321' }, token);
    assert.equal(failedNin.status, 400);
    assert.equal(JSON.stringify(failedNin.body).includes('10987654321'), false);
    assert.equal(ninCalls, 1);
    const failedCustomer = await Customer.findById(customer._id);
    assert.equal(failedCustomer.onboardingStatus, 'FAILED');
    assert.equal(failedCustomer.verificationResult, false);

    await Customer.updateOne({ _id: customer._id }, {
      $set: { onboardingStatus: 'PENDING', verificationType: 'BVN' },
      $unset: { verificationResult: 1, verifiedAt: 1 },
    });
    const pendingRequest = await request(server, 'POST', '/api/onboarding/bvn', { bvn: '12345678901' }, token);
    assert.equal(pendingRequest.status, 409);
    assert.equal(bvnCalls, 1);

    await Customer.updateOne({ _id: customer._id }, {
      $set: { onboardingStatus: 'FAILED', verificationType: 'BVN' },
      $unset: { verificationResult: 1, verifiedAt: 1 },
    });
    nibssOnboarding.validateBvn = async () => {
      throw new ApiError(503, 'NIBSS is unavailable');
    };
    const unavailable = await request(server, 'POST', '/api/onboarding/bvn', { bvn: '12345678901' }, token);
    assert.equal(unavailable.status, 503);
    assert.equal(JSON.stringify(unavailable.body).includes('12345678901'), false);
    assert.equal((await Customer.findById(customer._id)).onboardingStatus, 'FAILED');
    nibssOnboarding.validateBvn = originalValidateBvn;

    const customerlessUser = await User.create({
      email: `customerless-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const customerlessToken = jwt.sign({ sub: customerlessUser._id.toString() }, env.jwtSecret, { expiresIn: '1h' });
    const missingCustomer = await request(server, 'POST', '/api/onboarding/bvn', { bvn: '12345678901' }, customerlessToken);
    assert.equal(missingCustomer.status, 404);
    assert.equal(JSON.stringify(missingCustomer.body).includes('12345678901'), false);

    const invalidToken = await request(server, 'POST', '/api/onboarding/bvn', { bvn: '12345678901' }, 'invalid.token.value');
    assert.equal(invalidToken.status, 401);
    console.log('Phase 5 onboarding integration validation passed');
  } finally {
    nibssOnboarding.validateBvn = originalValidateBvn;
    nibssOnboarding.validateNin = originalValidateNin;
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 5 database cleaned up');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
