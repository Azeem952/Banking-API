const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase17-test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/digital-banking-phase17-test';

const app = require('../../app');
const { connectDatabase, disconnectDatabase } = require('../../config/db');
const User = require('../../models/user.model');
const Customer = require('../../models/customer.model');
const Account = require('../../models/account.model');

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
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: response.statusCode, body: data }); }
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

test('Security: unauthorized requests and IDOR protections are enforced', async (t) => {
  await setup();
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await teardown();
  });

  const customerAUser = await User.create({ email: `idor-a-${Date.now()}@example.com`, passwordHash: bcrypt.hashSync('Password123', 10) });
  const customerA = await Customer.create({ user: customerAUser._id, onboardingStatus: 'VERIFIED', verificationType: 'BVN', verificationResult: true, verifiedAt: new Date() });
  const accountA = await Account.create({ accountNumber: '7030000001', accountName: 'Customer A', bankCode: '703', customer: customerA._id, balance: 15000, status: 'ACTIVE', currency: 'NGN' });

  const customerBUser = await User.create({ email: `idor-b-${Date.now()}@example.com`, passwordHash: bcrypt.hashSync('Password123', 10) });
  const customerB = await Customer.create({ user: customerBUser._id, onboardingStatus: 'VERIFIED', verificationType: 'BVN', verificationResult: true, verifiedAt: new Date() });
  const accountB = await Account.create({ accountNumber: '7030000002', accountName: 'Customer B', bankCode: '703', customer: customerB._id, balance: 20000, status: 'ACTIVE', currency: 'NGN' });

  const tokenA = jwt.sign({ sub: customerAUser._id.toString(), email: customerAUser.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const unauthorized = await request(server, 'GET', `/api/account/${accountB._id}`, undefined, { authorization: `Bearer ${tokenA}` });
  assert.equal(unauthorized.status, 403);
  assert.equal(unauthorized.body.message, 'You do not have access to this account');

  const unauthenticated = await request(server, 'GET', `/api/account/${accountA._id}`);
  assert.equal(unauthenticated.status, 401);
});

test('Security: oversized payloads are rejected by the app limit', async (t) => {
  await setup();
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await teardown();
  });

  const bigPayload = { name: 'x'.repeat(150000) };
  const response = await request(server, 'POST', '/api/auth/register', bigPayload);
  assert.equal(response.status, 413);
});
