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
    console.log('\n=== Phase 13 Authorization & Data Privacy Tests ===');

    const user1 = await User.create({
      email: `phase13-user1-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const customer1 = await Customer.create({
      user: user1._id,
      onboardingStatus: 'VERIFIED',
      verificationType: 'BVN',
      verificationResult: true,
      verifiedAt: new Date(),
    });
    const account1 = await Account.create({
      accountNumber: '7031111111',
      accountName: 'Phase 13 User 1',
      bankCode: '703',
      customer: customer1._id,
      balance: 50000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const token1 = jwt.sign({ sub: user1._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    const user2 = await User.create({
      email: `phase13-user2-${Date.now()}@example.com`,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    const customer2 = await Customer.create({
      user: user2._id,
      onboardingStatus: 'VERIFIED',
      verificationType: 'BVN',
      verificationResult: true,
      verifiedAt: new Date(),
    });
    const account2 = await Account.create({
      accountNumber: '7032222222',
      accountName: 'Phase 13 User 2',
      bankCode: '703',
      customer: customer2._id,
      balance: 50000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const token2 = jwt.sign({ sub: user2._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    console.log('Test 1: User can access their own account and balance');
    const ownAccountResponse = await httpRequest(server, 'GET', `/api/account/${account1._id}`, null, token1);
    assert.equal(ownAccountResponse.status, 200);
    assert.equal(ownAccountResponse.body.data.account.accountNumber, account1.accountNumber);
    const ownBalanceResponse = await httpRequest(server, 'GET', `/api/account/${account1._id}/balance`, null, token1);
    assert.equal(ownBalanceResponse.status, 200);
    assert.equal(ownBalanceResponse.body.data.account.balance, 50000);
    console.log('✓ Own account access allowed');

    console.log('Test 2: Other user cannot access another customer account or balance');
    const otherAccountResponse = await httpRequest(server, 'GET', `/api/account/${account1._id}`, null, token2);
    assert.equal(otherAccountResponse.status, 403);
    const otherBalanceResponse = await httpRequest(server, 'GET', `/api/account/${account1._id}/balance`, null, token2);
    assert.equal(otherBalanceResponse.status, 403);
    console.log('✓ Other account access denied');

    console.log('Test 3: User can access their own transaction and other user cannot view it');
    const transferResponse = await httpRequest(server, 'POST', '/api/transfers', {
      recipientAccountId: account2._id.toString(),
      amount: 3000,
    }, token1);
    assert.equal(transferResponse.status, 200);
    const transaction = await Transaction.findOne({ reference: transferResponse.body.data.transfer.reference }).lean();
    assert.ok(transaction);
    const ownTxResponse = await httpRequest(server, 'GET', `/api/transfers/status/${transaction._id}`, null, token1);
    assert.equal(ownTxResponse.status, 200);
    assert.equal(ownTxResponse.body.data.transaction.id, transaction._id.toString());
    const otherTxResponse = await httpRequest(server, 'GET', `/api/transfers/status/${transaction._id}`, null, token2);
    assert.equal(otherTxResponse.status, 403);
    console.log('✓ Own transaction access allowed; other user access denied');

    const foreignTransaction = await Transaction.create({
      reference: `TX-FOREIGN-${Date.now()}`,
      fromAccount: account1._id,
      toAccount: account1._id,
      amount: 2500,
      status: 'SUCCESS',
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
      currency: 'NGN',
    });

    console.log('Test 4: IDOR attempts against transaction IDs are denied');
    const foreignTxIdResponse = await httpRequest(server, 'GET', `/api/transfers/status/${new mongoose.Types.ObjectId()}`, null, token2);
    assert.equal(foreignTxIdResponse.status, 404);
    const foreignTransactionResponse = await httpRequest(server, 'GET', `/api/transfers/status/${foreignTransaction._id}`, null, token2);
    assert.equal(foreignTransactionResponse.status, 403);
    console.log('✓ Transaction IDOR protections enforced');

    console.log('Test 5: IDOR attempts against account IDs are denied');
    const accountIdORResponse = await httpRequest(server, 'GET', `/api/account/${account1._id}`, null, token2);
    assert.equal(accountIdORResponse.status, 403);
    const balanceIdORResponse = await httpRequest(server, 'GET', `/api/account/${account1._id}/balance`, null, token2);
    assert.equal(balanceIdORResponse.status, 403);
    console.log('✓ Account IDOR attempt denied');

    console.log('Test 6: Legitimate history access remains intact');
    const historyResponse = await httpRequest(server, 'GET', '/api/transactions/history?page=1&limit=10', null, token1);
    assert.equal(historyResponse.status, 200);
    assert.ok(Array.isArray(historyResponse.body.data.transactions));
    const historyOwned = historyResponse.body.data.transactions.some((tx) => tx.id === transaction._id.toString());
    assert.equal(historyOwned, true);
    const otherHistoryResponse = await httpRequest(server, 'GET', '/api/transactions/history?page=1&limit=10', null, token2);
    assert.equal(otherHistoryResponse.status, 200);
    const otherHistoryOwned = otherHistoryResponse.body.data.transactions.some((tx) => tx.id === foreignTransaction._id.toString());
    assert.equal(otherHistoryOwned, false);
    console.log('✓ Transaction history remains authorized per customer');

    console.log('Phase 13 authorization checks passed');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 13 database cleaned up');
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
