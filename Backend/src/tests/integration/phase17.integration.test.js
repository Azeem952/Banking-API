const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase17-test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/digital-banking-phase17-test';

const app = require('../../app');
const { connectDatabase, disconnectDatabase } = require('../../config/db');
const User = require('../../models/user.model');

function request(server, method, path, body = undefined, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      port: server.address().port,
      method,
      path,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (response) => {
      let responseBody = '';
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, body: responseBody ? JSON.parse(responseBody) : {} });
        } catch (error) {
          resolve({ status: response.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function setup() {
  await connectDatabase();
  await mongoose.connection.db.dropDatabase();
}

async function teardown() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.db.dropDatabase();
    await disconnectDatabase();
  }
}

test('Integration: auth flow registers, logs in, and protects routes with JWTs', async (t) => {
  await setup();
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await teardown();
  });

  const email = `phase17-${Date.now()}@example.com`;
  const password = 'CorrectHorseBattery!';

  const registerResponse = await request(server, 'POST', '/api/auth/register', { email, password });
  assert.equal(registerResponse.status, 201);
  assert.equal(registerResponse.body.data.user.email, email);
  assert.ok(await User.findOne({ email }));

  const loginResponse = await request(server, 'POST', '/api/auth/login', { email, password });
  assert.equal(loginResponse.status, 200);
  assert.ok(loginResponse.body.data.token);
  assert.ok(loginResponse.body.data.refreshToken);

  const protectedResponse = await request(server, 'GET', '/api/account/me', undefined, {
    authorization: `Bearer ${loginResponse.body.data.token}`,
  });
  assert.equal(protectedResponse.status, 404);
  assert.equal(protectedResponse.body.message, 'Account not found');

  const badJwt = await request(server, 'GET', '/api/account/me', undefined, { authorization: 'Bearer invalid.token.value' });
  assert.equal(badJwt.status, 401);

  const expired = jwt.sign({ sub: '507f1f77bcf86cd799439011', email }, process.env.JWT_SECRET, { expiresIn: -1 });
  const expiredJwtResponse = await request(server, 'GET', '/api/account/me', undefined, { authorization: `Bearer ${expired}` });
  assert.equal(expiredJwtResponse.status, 401);
});
