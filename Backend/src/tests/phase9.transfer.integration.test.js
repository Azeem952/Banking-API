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

function request(server, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request({
      port: server.address().port,
      method: 'POST',
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

  try {
    await Promise.all([Account.syncIndexes(), Customer.syncIndexes(), Transaction.syncIndexes()]);

    const senderUser = await User.create({
      email: `sender-${Date.now()}@example.com`,
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
      accountName: 'Sender User',
      bankCode: '703',
      customer: senderCustomer._id,
      balance: 25000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const senderToken = jwt.sign({ sub: senderUser._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    const recipientUser = await User.create({
      email: `recipient-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const recipientCustomer = await Customer.create({
      user: recipientUser._id,
      onboardingStatus: 'VERIFIED',
      verificationType: 'BVN',
      verificationResult: true,
      verifiedAt: new Date(),
    });
    const recipientAccount = await Account.create({
      accountNumber: '7037654321',
      accountName: 'Recipient User',
      bankCode: '703',
      customer: recipientCustomer._id,
      balance: 5000,
      status: 'ACTIVE',
      currency: 'NGN',
    });

    const success = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: 5000 }, senderToken);
    assert.equal(success.status, 200);
    assert.equal(success.body.success, true);
    assert.ok(success.body.data.transfer.reference);
    assert.equal(success.body.data.transfer.status, 'SUCCESS');
    assert.equal(success.body.data.transfer.amount, 5000);
    assert.equal(success.body.data.transfer.recipientName, 'RECIPIENT USER');

    const updatedSender = await Account.findById(senderAccount._id);
    const updatedRecipient = await Account.findById(recipientAccount._id);
    assert.equal(updatedSender.balance, 20000);
    assert.equal(updatedRecipient.balance, 10000);

    const transferTx = await Transaction.findOne({ reference: success.body.data.transfer.reference });
    assert.ok(transferTx);
    assert.equal(transferTx.fromAccount.toString(), senderAccount._id.toString());
    assert.equal(transferTx.toAccount.toString(), recipientAccount._id.toString());
    assert.equal(transferTx.amount, 5000);
    assert.equal(transferTx.status, 'SUCCESS');

    const unauthenticated = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: 1000 });
    assert.equal(unauthenticated.status, 401);

    const invalidAmount = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: 0 }, senderToken);
    assert.equal(invalidAmount.status, 400);

    const negativeAmount = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: -100 }, senderToken);
    assert.equal(negativeAmount.status, 400);

    const missingRecipient = await request(server, '/api/transfers', { recipientAccountId: new mongoose.Types.ObjectId().toString(), amount: 1000 }, senderToken);
    assert.equal(missingRecipient.status, 404);

    const insufficient = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: 999999 }, senderToken);
    assert.equal(insufficient.status, 400);
    assert.equal((await Account.findById(senderAccount._id)).balance, 20000);
    assert.equal((await Account.findById(recipientAccount._id)).balance, 10000);

    const selfTransfer = await request(server, '/api/transfers', { recipientAccountId: senderAccount._id.toString(), amount: 1000 }, senderToken);
    assert.equal(selfTransfer.status, 400);

    const blockedSenderUser = await User.create({
      email: `blocked-sender-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const blockedSenderCustomer = await Customer.create({
      user: blockedSenderUser._id,
      onboardingStatus: 'VERIFIED',
      verificationType: 'BVN',
      verificationResult: true,
      verifiedAt: new Date(),
    });
    const blockedSenderAccount = await Account.create({
      accountNumber: '7035555555',
      accountName: 'Blocked Sender',
      bankCode: '703',
      customer: blockedSenderCustomer._id,
      balance: 10000,
      status: 'BLOCKED',
      currency: 'NGN',
    });
    const blockedSenderToken = jwt.sign({ sub: blockedSenderUser._id.toString() }, env.jwtSecret, { expiresIn: '1h' });
    const blockedResponse = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: 1000 }, blockedSenderToken);
    assert.equal(blockedResponse.status, 400);

    const blockedRecipientAccount = await Account.findByIdAndUpdate(recipientAccount._id, { status: 'BLOCKED' }, { new: true });
    const blockedRecipientResponse = await request(server, '/api/transfers', { recipientAccountId: blockedRecipientAccount._id.toString(), amount: 1000 }, senderToken);
    assert.equal(blockedRecipientResponse.status, 400);
    await Account.findByIdAndUpdate(recipientAccount._id, { status: 'ACTIVE' });

    const originalCreate = Transaction.create.bind(Transaction);
    const originalUpdate = Account.updateOne.bind(Account);
    const originalReference = require('../utils/generate-reference');
    let rollbackTriggered = false;
    Transaction.create = async (...args) => {
      rollbackTriggered = true;
      throw new Error('simulated transaction failure');
    };
    try {
      const rollbackResponse = await request(server, '/api/transfers', { recipientAccountId: recipientAccount._id.toString(), amount: 1000 }, senderToken);
      assert.equal(rollbackResponse.status, 500);
      const senderAfterRollback = await Account.findById(senderAccount._id);
      const recipientAfterRollback = await Account.findById(recipientAccount._id);
      assert.equal(senderAfterRollback.balance, 20000);
      assert.equal(recipientAfterRollback.balance, 10000);
      assert.equal(await Transaction.countDocuments({ fromAccount: senderAccount._id, toAccount: recipientAccount._id, amount: 1000 }), 0);
    } finally {
      Transaction.create = originalCreate;
    }

    const concurrentSenderUser = await User.create({
      email: `concurrent-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const concurrentSenderCustomer = await Customer.create({
      user: concurrentSenderUser._id,
      onboardingStatus: 'VERIFIED',
      verificationType: 'BVN',
      verificationResult: true,
      verifiedAt: new Date(),
    });
    const concurrentSenderAccount = await Account.create({
      accountNumber: '7032222222',
      accountName: 'Concurrent Sender',
      bankCode: '703',
      customer: concurrentSenderCustomer._id,
      balance: 12000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const concurrentRecipient = await Account.create({
      accountNumber: '7032222223',
      accountName: 'Concurrent Recipient',
      bankCode: '703',
      customer: new mongoose.Types.ObjectId(),
      balance: 0,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const concurrentToken = jwt.sign({ sub: concurrentSenderUser._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    const concurrentResults = await Promise.allSettled([
      request(server, '/api/transfers', { recipientAccountId: concurrentRecipient._id.toString(), amount: 8000 }, concurrentToken),
      request(server, '/api/transfers', { recipientAccountId: concurrentRecipient._id.toString(), amount: 8000 }, concurrentToken),
    ]);
    const fulfilled = concurrentResults.filter((result) => result.status === 'fulfilled' && result.value.status === 200);
    const rejected = concurrentResults.filter((result) => result.status === 'fulfilled' && result.value.status === 400);
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const finalConcurrentSender = await Account.findById(concurrentSenderAccount._id);
    const finalConcurrentRecipient = await Account.findById(concurrentRecipient._id);
    assert.equal(finalConcurrentSender.balance, 4000);
    assert.equal(finalConcurrentRecipient.balance, 8000);

    console.log('Phase 9 intra-bank transfer validation passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 9 database cleaned up');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
