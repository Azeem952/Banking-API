const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const app = require('../app');
const env = require('../config/env');
const User = require('../models/user.model');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const nibssAuth = require('../integrations/nibss/nibss.auth');
const nibssNameEnquiry = require('../integrations/nibss/nibss.name-enquiry');

function request(server, method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request({
      port: server.address().port,
      method,
      path,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
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
  const originalAuthenticateFintech = nibssAuth.authenticateFintech;
  const originalNameEnquiry = nibssNameEnquiry.nameEnquiry;

  try {
    nibssAuth.authenticateFintech = async () => ({ token: 'fake-nibss-token' });
    nibssNameEnquiry.nameEnquiry = async (accountNumber, token) => {
      assert.equal(token, 'fake-nibss-token');
      if (accountNumber === '0123456789') {
        return { accountNumber: '0123456789', bankCode: '000001', accountName: 'JOHN DOE' };
      }
      throw new Error('unexpected account number');
    };

    const user = await User.create({
      email: `phase8-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const token = jwt.sign({ sub: user._id.toString(), email: user.email }, env.jwtSecret, { expiresIn: '1h' });

    const success = await request(server, 'POST', '/api/transfers/name-enquiry', { bankCode: '000001', accountNumber: '0123456789' }, token);
    assert.equal(success.status, 200);
    assert.equal(success.body.data.accountName, 'JOHN DOE');
    assert.equal(success.body.data.accountNumber, '0123456789');
    assert.equal(success.body.data.bankCode, '000001');

    const missingAuth = await request(server, 'POST', '/api/transfers/name-enquiry', { bankCode: '000001', accountNumber: '0123456789' });
    assert.equal(missingAuth.status, 401);

    const invalidAccount = await request(server, 'POST', '/api/transfers/name-enquiry', { bankCode: '000001', accountNumber: 'abc' }, token);
    assert.equal(invalidAccount.status, 400);

    const invalidBank = await request(server, 'POST', '/api/transfers/name-enquiry', { bankCode: '9999999', accountNumber: '0123456789' }, token);
    assert.equal(invalidBank.status, 400);

    const unsupportedBank = await request(server, 'POST', '/api/transfers/name-enquiry', { bankCode: '999', accountNumber: '0123456789' }, token);
    assert.equal(unsupportedBank.status, 400);

    const invalidToken = await request(server, 'POST', '/api/transfers/name-enquiry', { bankCode: '000001', accountNumber: '0123456789' }, 'invalid.token.value');
    assert.equal(invalidToken.status, 401);

    for (let i = 0; i < 5; i += 1) {
      const attempt = await request(server, 'POST', '/api/transfers/name-enquiry', { bankCode: '000001', accountNumber: '0123456789' }, token);
      assert.notEqual(attempt.status, 429);
    }
    const rateLimited = await request(server, 'POST', '/api/transfers/name-enquiry', { bankCode: '000001', accountNumber: '0123456789' }, token);
    assert.equal(rateLimited.status, 429);

    console.log('Phase 8 name enquiry validation passed');
  } finally {
    nibssAuth.authenticateFintech = originalAuthenticateFintech;
    nibssNameEnquiry.nameEnquiry = originalNameEnquiry;
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 8 database cleaned up');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
