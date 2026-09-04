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
const accountService = require('../services/account.service');
const nibssAccount = require('../integrations/nibss/nibss.account');
const { connectDatabase, disconnectDatabase } = require('../config/db');

function request(server, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      port: server.address().port,
      method: 'POST',
      path: '/api/account/create',
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

function requestGet(server, path, token) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      port: server.address().port,
      method: 'GET',
      path,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }, (response) => {
      let responseBody = '';
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: responseBody ? JSON.parse(responseBody) : {} }));
    });
    request.on('error', reject);
    request.end();
  });
}

(async () => {
  assert.ok(env.jwtSecret && env.jwtSecret !== 'YOUR_JWT_SECRET_HERE');
  await connectDatabase();
  const server = app.listen(0);
  let accountCalls = 0;

  try {
    await Promise.all([Account.syncIndexes(), Transaction.syncIndexes()]);
    const accountIndexes = await Account.collection.indexes();
    const transactionIndexes = await Transaction.collection.indexes();
    assert.ok(accountIndexes.some((index) => index.name === 'customer_1' && index.unique));
    assert.ok(accountIndexes.some((index) => index.name === 'accountNumber_1' && index.unique));
    assert.ok(transactionIndexes.some((index) => index.name === 'toAccount_1_type_1' && index.unique));

    const unauthenticated = await request(server, { kycType: 'bvn', kycID: '12345678901', dob: '2005-04-04' });
    assert.equal(unauthenticated.status, 401);

    const user = await User.create({
      email: `account-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const token = jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: '1h' });
    await Customer.create({ user: user._id });
    const ineligible = await request(server, { kycType: 'bvn', kycID: '12345678901', dob: '2005-04-04' }, token);
    assert.equal(ineligible.status, 403);
    assert.equal(accountCalls, 0);

    const customer = await Customer.findOneAndUpdate(
      { user: user._id },
      {
        onboardingStatus: 'VERIFIED',
        verificationType: 'BVN',
        verificationResult: true,
        verifiedAt: new Date(),
      },
      { returnDocument: 'after' },
    );
    const createDependencies = {
      nibssAuth: { authenticateFintech: async () => ({ token: 'test-token' }) },
      nibssAccount: { createAccount: async () => {
        accountCalls += 1;
        return { accountNumber: '7037709866', accountName: 'Test User', bankCode: '703' };
      } },
    };
    const created = await accountService.createAccount({
      userId: user._id,
      kycType: 'bvn',
      kycID: '12345678901',
      dob: '2005-04-04',
    }, createDependencies);
    assert.deepEqual(created, {
      accountNumber: '7037709866',
      accountName: 'Test User',
      bankCode: '703',
      balance: 15000,
      status: 'ACTIVE',
    });
    assert.equal(accountCalls, 1);
    assert.equal(await Account.countDocuments({ customer: customer._id }), 1);
    assert.equal(await Transaction.countDocuments({ toAccount: created._id, type: 'INITIAL_FUNDING' }), 0);
    const storedAccount = await Account.findOne({ customer: customer._id });
    const funding = await Transaction.findOne({ toAccount: storedAccount._id, type: 'INITIAL_FUNDING' });
    assert.equal(storedAccount.balance, 15000);
    assert.equal(funding.amount, 15000);
    assert.equal(funding.transferType, 'INITIAL_FUNDING');

    const ownerAccountResponse = await requestGet(server, `/api/account/me`, token);
    assert.equal(ownerAccountResponse.status, 200);
    assert.equal(ownerAccountResponse.body.data.account.accountNumber, '7037709866');
    assert.equal(ownerAccountResponse.body.data.account.balance, 15000);
    assert.equal(ownerAccountResponse.body.data.account.status, 'ACTIVE');

    const balanceResponse = await requestGet(server, `/api/account/${storedAccount._id}/balance`, token);
    assert.equal(balanceResponse.status, 200);
    assert.equal(balanceResponse.body.data.account.balance, 15000);
    assert.equal(balanceResponse.body.data.account.currency, 'NGN');

    const otherUser = await User.create({
      email: `other-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const otherCustomer = await Customer.create({
      user: otherUser._id,
      onboardingStatus: 'VERIFIED',
      verificationType: 'BVN',
      verificationResult: true,
      verifiedAt: new Date(),
    });
    const otherToken = jwt.sign({ sub: otherUser._id.toString() }, env.jwtSecret, { expiresIn: '1h' });
    const forbiddenResponse = await requestGet(server, `/api/account/${storedAccount._id}`, otherToken);
    assert.equal(forbiddenResponse.status, 403);
    const balanceForbiddenResponse = await requestGet(server, `/api/account/${storedAccount._id}/balance`, otherToken);
    assert.equal(balanceForbiddenResponse.status, 403);

    const unauthenticatedResponse = await requestGet(server, `/api/account/${storedAccount._id}`);
    assert.equal(unauthenticatedResponse.status, 401);
    const unauthenticatedBalanceResponse = await requestGet(server, `/api/account/${storedAccount._id}/balance`);
    assert.equal(unauthenticatedBalanceResponse.status, 401);

    const missingResponse = await requestGet(server, `/api/account/${new mongoose.Types.ObjectId()}`, token);
    assert.equal(missingResponse.status, 404);

    await assert.rejects(() => Transaction.create({
      reference: `invalid-amount-${Date.now()}`,
      fromAccount: storedAccount._id,
      toAccount: storedAccount._id,
      amount: 0,
      status: 'PENDING',
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
    }));
    await assert.rejects(() => Transaction.create({
      reference: `invalid-amount-negative-${Date.now()}`,
      fromAccount: storedAccount._id,
      toAccount: storedAccount._id,
      amount: -100,
      status: 'PENDING',
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
    }));
    await assert.rejects(() => Transaction.create({
      reference: `invalid-amount-nan-${Date.now()}`,
      fromAccount: storedAccount._id,
      toAccount: storedAccount._id,
      amount: Number.NaN,
      status: 'PENDING',
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
    }));
    await assert.rejects(() => Transaction.create({
      reference: `invalid-amount-infinity-${Date.now()}`,
      fromAccount: storedAccount._id,
      toAccount: storedAccount._id,
      amount: Number.POSITIVE_INFINITY,
      status: 'PENDING',
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
    }));

    const duplicate = await request(server, {
      kycType: 'bvn', kycID: '12345678901', dob: '2005-04-04', balance: 1,
    }, token);
    assert.equal(duplicate.status, 409);

    const secondUser = await User.create({
      email: `concurrent-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    await Customer.create({ user: secondUser._id, onboardingStatus: 'VERIFIED', verificationType: 'BVN', verificationResult: true, verifiedAt: new Date() });
    let nextNumber = 0;
    const concurrentDependencies = {
      nibssAuth: { authenticateFintech: async () => ({ token: 'test-token' }) },
      nibssAccount: { createAccount: async () => {
        nextNumber += 1;
        return { accountNumber: `703000000${nextNumber}`, accountName: 'Concurrent User', bankCode: '703' };
      } },
    };
    const concurrentResults = await Promise.allSettled([
      accountService.createAccount({ userId: secondUser._id, kycType: 'bvn', kycID: '12345678901', dob: '2005-04-04' }, concurrentDependencies),
      accountService.createAccount({ userId: secondUser._id, kycType: 'bvn', kycID: '12345678901', dob: '2005-04-04' }, concurrentDependencies),
    ]);
    assert.equal(concurrentResults.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(concurrentResults.filter((result) => result.status === 'rejected' && result.reason.statusCode === 409).length, 1);

    const rollbackUser = await User.create({
      email: `rollback-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const rollbackCustomer = await Customer.create({ user: rollbackUser._id, onboardingStatus: 'VERIFIED', verificationType: 'BVN', verificationResult: true, verifiedAt: new Date() });
    const originalCreate = Transaction.create;
    Transaction.create = async () => { throw new Error('simulated funding failure'); };
    await assert.rejects(() => accountService.createAccount({ userId: rollbackUser._id, kycType: 'bvn', kycID: '12345678901', dob: '2005-04-04' }, {
      nibssAuth: { authenticateFintech: async () => ({ token: 'test-token' }) },
      nibssAccount: { createAccount: async () => ({ accountNumber: '7031111111', accountName: 'Rollback User', bankCode: '703' }) },
    }));
    Transaction.create = originalCreate;
    assert.equal(await Account.countDocuments({ customer: rollbackCustomer._id }), 0);

    const calls = [];
    const fakeClient = {
      request: async (options) => {
        calls.push(options);
        return {
          message: 'Account created successfully',
          account: {
            accountNumber: '7037709866',
            accountName: 'Test User',
            bankCode: '703',
          },
        };
      },
    };
    const remote = await nibssAccount.createAccount({ kycType: 'bvn', kycID: '12345678901', dob: '2005-04-04' }, 'jwt-token', fakeClient);
    assert.deepEqual(remote, { accountNumber: '7037709866', accountName: 'Test User', bankCode: '703' });
    assert.equal(calls[0].url, '/api/account/create');
    assert.equal(calls[0].token, 'jwt-token');
    assert.deepEqual(calls[0].data, { kycType: 'bvn', kycID: '12345678901', dob: '2005-04-04' });

    const account = await Account.create({ accountNumber: '7037709867', accountName: 'Test User', bankCode: '703', customer: new mongoose.Types.ObjectId(), balance: 15000 });
    const fundingRecord = await Transaction.create({ toAccount: account._id, amount: 15000, status: 'SUCCESS', type: 'INITIAL_FUNDING', transferType: 'INITIAL_FUNDING', reference: `FUND-${Date.now()}` });
    assert.equal(fundingRecord.amount, 15000);
    await assert.rejects(() => Transaction.create({ toAccount: account._id, amount: 15000, status: 'SUCCESS', type: 'INITIAL_FUNDING', transferType: 'INITIAL_FUNDING', reference: `FUND-${Date.now()}-duplicate` }), (error) => error.code === 11000);
    console.log('Phase 6 account creation validation passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 6 database cleaned up');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
