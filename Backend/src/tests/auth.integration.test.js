const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');
const env = require('../config/env');
const User = require('../models/user.model');
const authService = require('../services/auth.service');
const { authenticate } = require('../middleware/auth.middleware');
const { disconnectDatabase, connectDatabase } = require('../config/db');

function request(server, method, path, body = undefined, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request({
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
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: JSON.parse(responseBody),
      }));
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function middlewareResult(token) {
  return new Promise((resolve) => {
    const request = { get: () => (token ? `Bearer ${token}` : '') };
    authenticate(request, {}, (error) => resolve({ error, user: request.user }));
  });
}

async function run() {
  assert.ok(env.jwtSecret && env.jwtSecret !== 'YOUR_JWT_SECRET_HERE', 'JWT_SECRET must be supplied for this test');
  await connectDatabase();
  const server = app.listen(0);

  try {
    const email = `phase3-${Date.now()}@example.com`;
    const password = 'correct horse battery';
    const registration = await request(server, 'POST', '/api/auth/register', { email, password });
    assert.equal(registration.status, 201);
    assert.equal(registration.body.data.user.email, email);
    assert.equal(registration.body.data.user.passwordHash, undefined);
    const stored = await User.findOne({ email }).select('+passwordHash');
    assert.ok(stored.passwordHash);
    assert.notEqual(stored.passwordHash, password);

    const duplicate = await request(server, 'POST', '/api/auth/register', { email, password });
    assert.equal(duplicate.status, 409);
    assert.match(duplicate.body.message, /already exists/);

    const invalid = await request(server, 'POST', '/api/auth/register', { email: 'bad', password: 'short' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.success, false);

    const login = await request(server, 'POST', '/api/auth/login', { email, password });
    assert.equal(login.status, 200);
    assert.ok(login.body.data.token);
    assert.ok(login.body.data.refreshToken);
    assert.equal(login.body.data.user.passwordHash, undefined);

    const refresh = await request(server, 'POST', '/api/auth/refresh', { refreshToken: login.body.data.refreshToken });
    assert.equal(refresh.status, 200);
    assert.ok(refresh.body.data.token);
    assert.notEqual(refresh.body.data.token, login.body.data.token);

    const logout = await request(server, 'POST', '/api/auth/logout', { refreshToken: refresh.body.data.refreshToken });
    assert.equal(logout.status, 200);
    const reusedRefresh = await request(server, 'POST', '/api/auth/refresh', { refreshToken: refresh.body.data.refreshToken });
    assert.equal(reusedRefresh.status, 401);

    const forgot = await request(server, 'POST', '/api/auth/forgot-password', { email });
    assert.equal(forgot.status, 200);
    assert.match(forgot.body.message, /If an account/i);
    assert.equal(forgot.body.data, null);

    const resetFlow = await authService.forgotPassword({ email });
    const resetToken = resetFlow.resetToken;
    assert.ok(resetToken);

    const resetPassword = await request(server, 'POST', '/api/auth/reset-password', {
      token: resetToken,
      password: 'new password 123',
    });
    assert.equal(resetPassword.status, 200);

    const oldRefreshAfterReset = await request(server, 'POST', '/api/auth/refresh', { refreshToken: refresh.body.data.refreshToken });
    assert.equal(oldRefreshAfterReset.status, 401);

    const wrongPassword = await request(server, 'POST', '/api/auth/login', { email, password: 'wrong password' });
    const unknownEmail = await request(server, 'POST', '/api/auth/login', { email: 'unknown@example.com', password });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);

    assert.equal((await middlewareResult()).error.statusCode, 401);
    assert.equal((await middlewareResult('malformed')).error.statusCode, 401);
    assert.equal((await middlewareResult('eyJhbGciOiJIUzI1NiJ9.invalid.signature')).error.statusCode, 401);
    const expired = jwt.sign({ sub: stored._id.toString() }, env.jwtSecret, { expiresIn: -1 });
    assert.equal((await middlewareResult(expired)).error.statusCode, 401);
    const valid = await middlewareResult(login.body.data.token);
    assert.equal(valid.error, undefined);
    assert.equal(valid.user.sub, stored._id.toString());

    const lockEmail = `lock-${Date.now()}@example.com`;
    const lockPassword = 'CorrectHorseBattery!';
    const lockRegistration = await request(server, 'POST', '/api/auth/register', { email: lockEmail, password: lockPassword });
    assert.equal(lockRegistration.status, 201);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedAttempt = await request(server, 'POST', '/api/auth/login', { email: lockEmail, password: 'wrong password' });
      assert.equal(failedAttempt.status, 401);
    }

    const lockedAttempt = await request(server, 'POST', '/api/auth/login', { email: lockEmail, password: 'wrong password' });
    assert.equal(lockedAttempt.status, 401);
    assert.equal(lockedAttempt.body.message, 'Invalid email or password');

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const limitedAttempt = await request(server, 'POST', '/api/auth/login', { email, password: 'wrong password' });
      assert.ok([401, 429].includes(limitedAttempt.status));
    }
    const rateLimited = await request(server, 'POST', '/api/auth/login', { email, password: 'wrong password' });
    assert.ok([401, 429].includes(rateLimited.status));
    console.log('Phase 3 authentication integration validation passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 3 database cleaned up');
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
