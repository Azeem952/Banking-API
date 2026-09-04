const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase17-test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/digital-banking-phase17-test';

const { connectDatabase, disconnectDatabase } = require('../../config/db');
const User = require('../../models/user.model');
const { register, login, INVALID_CREDENTIALS_MESSAGE } = require('../../services/auth.service');
const { validateBody } = require('../../middleware/validation.middleware');
const { credentialsSchema } = require('../../validators/auth.validator');

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

test('Unit: registration hashes password, login verifies credentials, and invalid credentials remain safe', async (t) => {
  await setup();
  t.after(async () => teardown());

  const email = `unit-${Date.now()}@example.com`;
  const password = 'CorrectHorseBattery!';

  const registered = await register({ email, password });
  assert.equal(registered.email, email);

  const storedUser = await User.findOne({ email }).select('+passwordHash');
  assert.ok(storedUser.passwordHash);
  assert.notEqual(storedUser.passwordHash, password);
  assert.ok(await bcrypt.compare(password, storedUser.passwordHash));

  const authResult = await login({ email, password });
  assert.ok(authResult.token);
  assert.ok(authResult.refreshToken);

  await assert.rejects(() => login({ email, password: 'wrong-password' }), (error) => {
    assert.equal(error.statusCode, 401);
    assert.equal(error.message, INVALID_CREDENTIALS_MESSAGE);
    return true;
  });

  const noSuchUser = await User.findOne({ email: 'missing@example.com' });
  assert.equal(noSuchUser, null);
});

test('Unit: request validation rejects malformed auth payloads before business logic', async (t) => {
  await setup();
  t.after(async () => teardown());

  const badRequest = { body: { email: 'bad', password: 'short' } };
  const next = (error) => error;
  const middleware = validateBody(credentialsSchema);

  const result = middleware(badRequest, {}, next);
  assert.ok(result instanceof Error);
  assert.equal(result.statusCode, 400);
  assert.equal(result.message, 'Invalid request body');
});
