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
const Transaction = require('../../models/transaction.model');

function request(server, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      port: server.address().port,
      method: 'POST',
      path,
      headers: {
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: response.statusCode, body: data });
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

test('Banking: initial funding and transfer rules are enforced', async (t) => {
  await setup();
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await teardown();
  });

  const senderUser = await User.create({ email: `bank-sender-${Date.now()}@example.com`, passwordHash: bcrypt.hashSync('Password123', 10) });
  const senderCustomer = await Customer.create({ user: senderUser._id, onboardingStatus: 'VERIFIED', verificationType: 'BVN', verificationResult: true, verifiedAt: new Date() });
  const senderAccount = await Account.create({ accountNumber: '7031111111', accountName: 'Sender', bankCode: '703', customer: senderCustomer._id, balance: 15000, status: 'ACTIVE', currency: 'NGN' });
  const recipientUser = await User.create({ email: `bank-recipient-${Date.now()}@example.com`, passwordHash: bcrypt.hashSync('Password123', 10) });
  const recipientCustomer = await Customer.create({ user: recipientUser._id, onboardingStatus: 'VERIFIED', verificationType: 'BVN', verificationResult: true, verifiedAt: new Date() });
  const recipientAccount = await Account.create({ accountNumber: '7031111112', accountName: 'Recipient', bankCode: '703', customer: recipientCustomer._id, balance: 10000, status: 'ACTIVE', currency: 'NGN' });

  const senderToken = jwt.sign({ sub: senderUser._id.toString(), email: senderUser.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const success = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: 5000 }, senderToken);
  assert.equal(success.status, 200);
  assert.equal(success.body.data.transfer.amount, 5000);

  const updatedSender = await Account.findById(senderAccount._id);
  const updatedRecipient = await Account.findById(recipientAccount._id);
  assert.equal(updatedSender.balance, 10000);
  assert.equal(updatedRecipient.balance, 15000);

  const insufficient = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: 999999 }, senderToken);
  assert.equal(insufficient.status, 400);
  assert.equal(insufficient.body.message, 'Insufficient available balance');

  const txCount = await Transaction.countDocuments({ fromAccount: senderAccount._id, toAccount: recipientAccount._id });
  assert.ok(txCount >= 1);
});

test('Banking: concurrent transfers do not allow double-spending', async (t) => {
  await setup();
  const server = app.listen(0);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await teardown();
  });

  const user = await User.create({ email: `bank-concurrent-${Date.now()}@example.com`, passwordHash: bcrypt.hashSync('Password123', 10) });
  const customer = await Customer.create({ user: user._id, onboardingStatus: 'VERIFIED', verificationType: 'BVN', verificationResult: true, verifiedAt: new Date() });
  const senderAccount = await Account.create({ accountNumber: '7032222222', accountName: 'Concurrent', bankCode: '703', customer: customer._id, balance: 20000, status: 'ACTIVE', currency: 'NGN' });
  const recipient = await Account.create({ accountNumber: '7032222223', accountName: 'Recipient', bankCode: '703', customer: new mongoose.Types.ObjectId(), balance: 0, status: 'ACTIVE', currency: 'NGN' });

  const token = jwt.sign({ sub: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const [first, second] = await Promise.allSettled([
    request(server, '/api/transfers', { recipientAccountId: recipient._id.toString(), amount: 15000 }, token),
    request(server, '/api/transfers', { recipientAccountId: recipient._id.toString(), amount: 15000 }, token),
  ]);

  const successCount = [first, second].filter((result) => result.status === 'fulfilled' && result.value.status === 200).length;
  const failureCount = [first, second].filter((result) => result.status === 'fulfilled' && result.value.status === 400).length;

  assert.equal(successCount, 1);
  assert.equal(failureCount, 1);

  const finalSender = await Account.findById(senderAccount._id);
  const finalRecipient = await Account.findById(recipient._id);
  assert.ok(finalSender.balance >= 0);
  assert.ok(finalRecipient.balance >= 0);
  assert.equal(finalSender.balance + finalRecipient.balance, 20000);
});
