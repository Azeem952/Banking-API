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
    console.log('\n=== Phase 12: Transaction History Tests ===\n');

    // Create test users
    const user1 = await User.create({
      email: `phase12-user1-${Date.now()}@example.com`,
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
      accountNumber: '7041111111',
      accountName: 'Phase 12 User 1',
      bankCode: '704',
      customer: customer1._id,
      balance: 100000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const token1 = jwt.sign({ sub: user1._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    const user2 = await User.create({
      email: `phase12-user2-${Date.now()}@example.com`,
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
      accountNumber: '7042222222',
      accountName: 'Phase 12 User 2',
      bankCode: '704',
      customer: customer2._id,
      balance: 100000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const token2 = jwt.sign({ sub: user2._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    // Create test transactions for user1
    const now = new Date();
    const successTx = await Transaction.create({
      reference: `TRF-SUCCESS-${Date.now()}`,
      fromAccount: account1._id,
      toAccount: account1._id,
      amount: 5000,
      currency: 'NGN',
      status: 'SUCCESS',
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
      createdAt: new Date(now.getTime() - 3600000), // 1 hour ago
    });

    const pendingTx = await Transaction.create({
      reference: `TRF-PENDING-${Date.now()}`,
      fromAccount: account1._id,
      toAccount: account1._id,
      amount: 2000,
      currency: 'NGN',
      status: 'PENDING',
      type: 'DEBIT',
      transferType: 'INTER_BANK',
      recipientBankCode: '260',
      recipientAccountNumber: '0123456789',
      createdAt: new Date(now.getTime() - 1800000), // 30 min ago
    });

    const failedTx = await Transaction.create({
      reference: `TRF-FAILED-${Date.now()}`,
      fromAccount: account1._id,
      toAccount: account1._id,
      amount: 1000,
      currency: 'NGN',
      status: 'FAILED',
      type: 'DEBIT',
      transferType: 'INTER_BANK',
      failureReason: 'Insufficient funds at recipient',
      recipientBankCode: '260',
      recipientAccountNumber: '0123456789',
      createdAt: new Date(now.getTime() - 900000), // 15 min ago
    });

    const creditTx = await Transaction.create({
      reference: `TRF-CREDIT-${Date.now()}`,
      toAccount: account1._id,
      amount: 10000,
      currency: 'NGN',
      status: 'SUCCESS',
      type: 'INITIAL_FUNDING',
      transferType: 'INITIAL_FUNDING',
      createdAt: new Date(now.getTime() - 7200000), // 2 hours ago
    });

    // Create transactions for user2 (should not be visible to user1)
    const user2Tx = await Transaction.create({
      reference: `TRF-USER2-${Date.now()}`,
      fromAccount: account2._id,
      toAccount: account2._id,
      amount: 3000,
      currency: 'NGN',
      status: 'SUCCESS',
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
    });

    console.log('Test 1: Unauthenticated request is rejected');
    const unauthResponse = await httpRequest(server, 'GET', '/api/transactions/history');
    assert.equal(unauthResponse.status, 401);
    assert.equal(unauthResponse.body.success, false);
    console.log('✓ Unauthenticated request rejected with 401');

    console.log('\nTest 2: Authenticated customer can access history');
    const historyResponse = await httpRequest(server, 'GET', '/api/transactions/history', null, token1);
    assert.equal(historyResponse.status, 200);
    assert.equal(historyResponse.body.success, true);
    assert.ok(Array.isArray(historyResponse.body.data.transactions));
    assert.ok(historyResponse.body.data.pagination);
    console.log(`✓ Retrieved ${historyResponse.body.data.transactions.length} transactions`);

    console.log('\nTest 3: Customer sees only their own transactions');
    const userTxs = historyResponse.body.data.transactions;
    assert.equal(userTxs.length, 4); // success, pending, failed, credit
    const userTxReferences = userTxs.map(tx => tx.reference);
    assert.ok(userTxReferences.includes(successTx.reference));
    assert.ok(userTxReferences.includes(pendingTx.reference));
    assert.ok(userTxReferences.includes(failedTx.reference));
    assert.ok(userTxReferences.includes(creditTx.reference));
    assert.ok(!userTxReferences.includes(user2Tx.reference));
    console.log('✓ Customer sees only their own transactions');

    console.log('\nTest 4: Customer cannot see another customer\'s transactions');
    const user2History = await httpRequest(server, 'GET', '/api/transactions/history', null, token2);
    const user2Txs = user2History.body.data.transactions;
    const user2TxReferences = user2Txs.map(tx => tx.reference);
    assert.ok(user2TxReferences.includes(user2Tx.reference));
    assert.ok(!user2TxReferences.includes(successTx.reference));
    console.log('✓ User2 cannot see User1 transactions');

    console.log('\nTest 5: Default sorting returns newest transactions first');
    const defaultSortResponse = await httpRequest(server, 'GET', '/api/transactions/history', null, token1);
    const defaultTxs = defaultSortResponse.body.data.transactions;
    const firstTxCreatedAt = new Date(defaultTxs[0].createdAt);
    const secondTxCreatedAt = new Date(defaultTxs[1].createdAt);
    assert.ok(firstTxCreatedAt >= secondTxCreatedAt);
    console.log('✓ Default sorting returns newest first');

    console.log('\nTest 6: Sorting by amount works');
    const amountSortResponse = await httpRequest(server, 'GET', '/api/transactions/history?sort=amount&direction=asc', null, token1);
    const amountTxs = amountSortResponse.body.data.transactions;
    for (let i = 1; i < amountTxs.length; i++) {
      assert.ok(amountTxs[i - 1].amount <= amountTxs[i].amount);
    }
    console.log('✓ Sorting by amount ascending works');

    console.log('\nTest 7: Invalid sort field is rejected');
    const invalidSortResponse = await httpRequest(server, 'GET', '/api/transactions/history?sort=invalid', null, token1);
    assert.equal(invalidSortResponse.status, 400);
    console.log('✓ Invalid sort field rejected');

    console.log('\nTest 8: Pagination works');
    const page1Response = await httpRequest(server, 'GET', '/api/transactions/history?page=1&limit=2', null, token1);
    const page1Txs = page1Response.body.data.transactions;
    assert.equal(page1Txs.length, 2);
    assert.equal(page1Response.body.data.pagination.currentPage, 1);
    assert.equal(page1Response.body.data.pagination.pageSize, 2);
    assert.equal(page1Response.body.data.pagination.totalTransactions, 4);
    assert.equal(page1Response.body.data.pagination.totalPages, 2);
    assert.equal(page1Response.body.data.pagination.hasMore, true);
    console.log('✓ Pagination page 1 correct');

    const page2Response = await httpRequest(server, 'GET', '/api/transactions/history?page=2&limit=2', null, token1);
    const page2Txs = page2Response.body.data.transactions;
    assert.equal(page2Txs.length, 2);
    assert.equal(page2Response.body.data.pagination.currentPage, 2);
    assert.equal(page2Response.body.data.pagination.hasMore, false);
    console.log('✓ Pagination page 2 correct');

    console.log('\nTest 9: Maximum limit is enforced');
    const largeLimit = await httpRequest(server, 'GET', '/api/transactions/history?limit=1000', null, token1);
    assert.equal(largeLimit.status, 400);
    console.log('✓ Limit > 100 rejected');

    console.log('\nTest 10: Transaction type filter works');
    const debitFilter = await httpRequest(server, 'GET', '/api/transactions/history?type=DEBIT', null, token1);
    const debitTxs = debitFilter.body.data.transactions;
    for (const tx of debitTxs) {
      assert.equal(tx.type, 'DEBIT');
    }
    assert.ok(debitTxs.length > 0);
    console.log(`✓ Type filter returned ${debitTxs.length} DEBIT transactions`);

    const creditFilter = await httpRequest(server, 'GET', '/api/transactions/history?type=INITIAL_FUNDING', null, token1);
    const creditTxs = creditFilter.body.data.transactions;
    for (const tx of creditTxs) {
      assert.equal(tx.type, 'INITIAL_FUNDING');
    }
    console.log(`✓ Type filter returned ${creditTxs.length} INITIAL_FUNDING transactions`);

    console.log('\nTest 11: Invalid type filter is rejected');
    const invalidTypeResponse = await httpRequest(server, 'GET', '/api/transactions/history?type=INVALID', null, token1);
    assert.equal(invalidTypeResponse.status, 400);
    console.log('✓ Invalid type rejected');

    console.log('\nTest 12: Status filter works');
    const successFilter = await httpRequest(server, 'GET', '/api/transactions/history?status=SUCCESS', null, token1);
    const successTxs = successFilter.body.data.transactions;
    for (const tx of successTxs) {
      assert.equal(tx.status, 'SUCCESS');
    }
    assert.equal(successTxs.length, 2); // successTx and creditTx
    console.log(`✓ Status filter returned ${successTxs.length} SUCCESS transactions`);

    const pendingFilter = await httpRequest(server, 'GET', '/api/transactions/history?status=PENDING', null, token1);
    const pendingTxs = pendingFilter.body.data.transactions;
    for (const tx of pendingTxs) {
      assert.equal(tx.status, 'PENDING');
    }
    console.log(`✓ Status filter returned ${pendingTxs.length} PENDING transactions`);

    console.log('\nTest 13: Invalid status filter is rejected');
    const invalidStatusResponse = await httpRequest(server, 'GET', '/api/transactions/history?status=INVALID', null, token1);
    assert.equal(invalidStatusResponse.status, 400);
    console.log('✓ Invalid status rejected');

    console.log('\nTest 14: Date range filter works');
    const fromDate = new Date(now.getTime() - 2700000).toISOString(); // 45 min ago
    const toDate = new Date(now.getTime() - 600000).toISOString(); // 10 min ago
    const dateRangeResponse = await httpRequest(server, 'GET', `/api/transactions/history?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`, null, token1);
    assert.equal(dateRangeResponse.status, 200);
    const dateRangeTxs = dateRangeResponse.body.data.transactions;
    for (const tx of dateRangeTxs) {
      const txDate = new Date(tx.createdAt);
      assert.ok(txDate >= new Date(fromDate));
      assert.ok(txDate <= new Date(toDate));
    }
    console.log(`✓ Date range filter returned ${dateRangeTxs.length} transactions in range`);

    console.log('\nTest 15: Invalid date range is rejected');
    const badDateRange = await httpRequest(server, 'GET', '/api/transactions/history?from=2026-08-29&to=2026-08-01', null, token1);
    assert.equal(badDateRange.status, 400);
    console.log('✓ Invalid date range rejected');

    console.log('\nTest 16: Combined filters work');
    const combinedResponse = await httpRequest(server, 'GET', `/api/transactions/history?type=DEBIT&status=FAILED&page=1&limit=10&sort=createdAt&direction=desc`, null, token1);
    assert.equal(combinedResponse.status, 200);
    const combinedTxs = combinedResponse.body.data.transactions;
    for (const tx of combinedTxs) {
      assert.equal(tx.type, 'DEBIT');
      assert.equal(tx.status, 'FAILED');
    }
    console.log(`✓ Combined filters returned ${combinedTxs.length} transactions`);

    console.log('\nTest 17: Pagination metadata is correct');
    const metaResponse = await httpRequest(server, 'GET', '/api/transactions/history?page=1&limit=10', null, token1);
    const meta = metaResponse.body.data.pagination;
    assert.ok(meta.currentPage !== undefined);
    assert.ok(meta.pageSize !== undefined);
    assert.ok(meta.totalTransactions !== undefined);
    assert.ok(meta.totalPages !== undefined);
    assert.ok(meta.hasMore !== undefined);
    console.log('✓ Pagination metadata present and correct');

    console.log('\nTest 18: Sensitive fields are not exposed');
    const dataResponse = await httpRequest(server, 'GET', '/api/transactions/history', null, token1);
    const txData = dataResponse.body.data.transactions[0];
    assert.ok(!txData.hasOwnProperty('_id') || txData.id);
    assert.ok(!txData.hasOwnProperty('__v'));
    assert.ok(txData.reference);
    assert.ok(txData.status);
    assert.ok(txData.amount);
    console.log('✓ Response contains appropriate fields only');

    console.log('\nTest 19: IDOR prevention - cannot access by changing transaction ID');
    // Try to query with another user's transaction ID in a direct request
    const idor1 = await httpRequest(server, 'GET', `/api/transfers/status/${user2Tx._id}`, null, token1);
    assert.equal(idor1.status, 403);
    console.log('✓ Cannot access other user transaction via status endpoint');

    console.log('\nTest 20: Account number security - cannot use account number to leak data');
    // The history endpoint should not accept account number as a filter parameter
    // User1 should only see their own account transactions
    const user1HistoryTxs = historyResponse.body.data.transactions;
    for (const tx of user1HistoryTxs) {
      assert.ok(tx.fromAccountId === account1._id.toString() || tx.toAccountId === account1._id.toString());
    }
    console.log('✓ History returns only transactions related to customer\'s account');

    console.log('\n✅ All Phase 12 tests passed!');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Phase 12 database cleaned up');
  }
})().catch((error) => {
  console.error('❌ Phase 12 test failed:', error);
  process.exitCode = 1;
});
