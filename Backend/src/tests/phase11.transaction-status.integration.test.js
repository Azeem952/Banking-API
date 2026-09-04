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
const nibssAuth = require('../integrations/nibss/nibss.auth');
const nibssNameEnquiry = require('../integrations/nibss/nibss.name-enquiry');
const nibssTransfer = require('../integrations/nibss/nibss.transfer');
const nibssTransactionStatus = require('../integrations/nibss/nibss.transaction-status');

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
  const originalAuthenticateFintech = nibssAuth.authenticateFintech;
  const originalNameEnquiry = nibssNameEnquiry.nameEnquiry;
  const originalTransfer = nibssTransfer.transfer;
  const originalTransactionStatus = nibssTransactionStatus.transactionStatus;

  try {
    // Mock NIBSS functions
    nibssAuth.authenticateFintech = async () => ({ token: 'fake-nibss-token' });
    nibssNameEnquiry.nameEnquiry = async (accountNumber, token) => {
      return { accountName: 'PHASE 11 RECIPIENT', accountNumber: '0123456789', bankCode: '260' };
    };
    nibssTransfer.transfer = async ({ from, to, amount }, token) => {
      return { status: 'SUCCESS', transactionId: 'EXT-1001' };
    };
    nibssTransactionStatus.transactionStatus = async (externalTxId, token) => {
      if (externalTxId === 'EXT-1001') {
        return { transactionId: 'EXT-1001', status: 'SUCCESS' };
      }
      if (externalTxId === 'EXT-PENDING') {
        return { transactionId: 'EXT-PENDING', status: 'PROCESSING' };
      }
      if (externalTxId === 'EXT-FAILED') {
        return { transactionId: 'EXT-FAILED', status: 'FAILED', message: 'Insufficient funds' };
      }
      throw new Error('External transaction not found');
    };

    console.log('\n=== Transaction Status Endpoint Tests ===');

    // Create test users and accounts
    const user1 = await User.create({
      email: `phase11-user1-${Date.now()}@example.com`,
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
      accountName: 'Phase 11 User 1',
      bankCode: '703',
      customer: customer1._id,
      balance: 50000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const token1 = jwt.sign({ sub: user1._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    const user2 = await User.create({
      email: `phase11-user2-${Date.now()}@example.com`,
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
      accountName: 'Phase 11 User 2',
      bankCode: '703',
      customer: customer2._id,
      balance: 50000,
      status: 'ACTIVE',
      currency: 'NGN',
    });
    const token2 = jwt.sign({ sub: user2._id.toString() }, env.jwtSecret, { expiresIn: '1h' });

    // Test 1: Create an intra-bank transfer to test status retrieval
    console.log('Test 1: Create intra-bank transfer and retrieve status');
    const transferResponse = await httpRequest(server, 'POST', '/api/transfers', {
      recipientAccountId: account2._id.toString(),
      amount: 5000,
    }, token1);
    assert.equal(transferResponse.status, 200);
    const txReference = transferResponse.body.data.transfer.reference;
    const tx1 = await Transaction.findOne({ reference: txReference });
    assert.ok(tx1);
    console.log(`✓ Created transaction: ${tx1._id}`);

    // Test 2: Retrieve transaction status with authentication
    console.log('Test 2: Authenticated user can retrieve their own transaction');
    const statusResponse = await httpRequest(server, 'GET', `/api/transfers/status/${tx1._id}`, null, token1);
    assert.equal(statusResponse.status, 200);
    assert.equal(statusResponse.body.success, true);
    assert.equal(statusResponse.body.data.transaction.id, tx1._id.toString());
    assert.equal(statusResponse.body.data.transaction.reference, txReference);
    assert.equal(statusResponse.body.data.transaction.status, 'SUCCESS');
    console.log(`✓ Retrieved transaction status: ${statusResponse.body.data.transaction.status}`);

    // Test 3: Unauthenticated request should be rejected
    console.log('Test 3: Unauthenticated requests are rejected');
    const unauthResponse = await httpRequest(server, 'GET', `/api/transfers/status/${tx1._id}`);
    assert.equal(unauthResponse.status, 401);
    assert.equal(unauthResponse.body.success, false);
    console.log('✓ Unauthenticated request rejected with 401');

    // Test 4: Different customer cannot access another's transaction
    console.log('Test 4: User cannot access another user\'s transaction');
    const unauthorizedResponse = await httpRequest(server, 'GET', `/api/transfers/status/${tx1._id}`, null, token2);
    assert.equal(unauthorizedResponse.status, 403);
    assert.equal(unauthorizedResponse.body.success, false);
    assert.equal(unauthorizedResponse.body.message, 'Unauthorized transaction access');
    console.log('✓ Unauthorized access rejected with 403');

    // Test 5: Invalid transaction ID
    console.log('Test 5: Invalid transaction ID returns 400');
    const invalidIdResponse = await httpRequest(server, 'GET', '/api/transfers/status/invalid-id', null, token1);
    assert.equal(invalidIdResponse.status, 400);
    assert.equal(invalidIdResponse.body.success, false);
    console.log('✓ Invalid transaction ID rejected with 400');

    // Test 6: Unknown transaction ID
    console.log('Test 6: Unknown transaction ID returns 404');
    const unknownIdResponse = await httpRequest(server, 'GET', `/api/transfers/status/${new mongoose.Types.ObjectId()}`, null, token1);
    assert.equal(unknownIdResponse.status, 404);
    assert.equal(unknownIdResponse.body.success, false);
    console.log('✓ Unknown transaction ID returns 404');

    console.log('\n=== External Status Synchronization Tests ===');

    // Test 7: Create inter-bank transfer for external status testing
    console.log('Test 7: Create inter-bank transfer for status sync testing');
    const interBankResponse = await httpRequest(server, 'POST', '/api/transfers/interbank', {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 3000,
      idempotencyKey: `phase11-interbank-${Date.now()}`,
    }, token1);
    assert.equal(interBankResponse.status, 200);
    const interBankTx = await Transaction.findOne({ reference: interBankResponse.body.data.transfer.reference });
    assert.equal(interBankTx.transferType, 'INTER_BANK');
    assert.equal(interBankTx.externalTransactionId, 'EXT-1001');
    console.log(`✓ Created inter-bank transaction with external ID: ${interBankTx.externalTransactionId}`);

    // Test 8: Retrieve inter-bank transaction with external status
    console.log('Test 8: Retrieve inter-bank transaction with external status');
    const externalStatusResponse = await httpRequest(
      server,
      'GET',
      `/api/transfers/status/${interBankTx._id}?includeExternalStatus=true`,
      null,
      token1,
    );
    assert.equal(externalStatusResponse.status, 200);
    assert.equal(externalStatusResponse.body.data.transaction.status, 'SUCCESS');
    assert.equal(externalStatusResponse.body.data.transaction.externalStatus, 'SUCCESS');
    console.log('✓ External status retrieved and matches local status');

    // Test 9: Update local status when external status differs
    console.log('Test 9: Local status updates when external status differs');
    const pendingTx = await Transaction.create({
      reference: `TRF-PENDING-${Date.now()}`,
      fromAccount: account1._id,
      toAccount: account1._id,
      amount: 1000,
      currency: 'NGN',
      status: Transaction.STATUSES.PENDING,
      type: Transaction.TYPES.DEBIT,
      transferType: Transaction.TRANSFER_TYPES.INTER_BANK,
      externalTransactionId: 'EXT-FAILED',
      recipientBankCode: '260',
      recipientAccountNumber: '0123456789',
      provider: 'NIBSS',
    });
    assert.equal(pendingTx.status, 'PENDING');

    const updateStatusResponse = await httpRequest(
      server,
      'GET',
      `/api/transfers/status/${pendingTx._id}?includeExternalStatus=true`,
      null,
      token1,
    );
    assert.equal(updateStatusResponse.status, 200);
    assert.equal(updateStatusResponse.body.data.transaction.status, 'FAILED');
    assert.equal(updateStatusResponse.body.data.transaction.externalStatus, 'FAILED');

    const updatedTx = await Transaction.findById(pendingTx._id);
    assert.equal(updatedTx.status, 'FAILED');
    console.log('✓ Local status updated to match external status');

    // Test 10: Terminal status is not overwritten
    console.log('Test 10: Terminal status (SUCCESS) is not overwritten');
    const successTx = await Transaction.create({
      reference: `TRF-SUCCESS-${Date.now()}`,
      fromAccount: account1._id,
      toAccount: account1._id,
      amount: 2000,
      currency: 'NGN',
      status: Transaction.STATUSES.SUCCESS,
      type: Transaction.TYPES.DEBIT,
      transferType: Transaction.TRANSFER_TYPES.INTER_BANK,
      externalTransactionId: 'EXT-UNKNOWN',
      recipientBankCode: '260',
      recipientAccountNumber: '0123456789',
      provider: 'NIBSS',
    });

    const terminalStatusResponse = await httpRequest(
      server,
      'GET',
      `/api/transfers/status/${successTx._id}?includeExternalStatus=true`,
      null,
      token1,
    );
    assert.equal(terminalStatusResponse.status, 200);
    assert.equal(terminalStatusResponse.body.data.transaction.status, 'SUCCESS');
    console.log('✓ Terminal status (SUCCESS) not overwritten');

    console.log('\n=== Transaction Idempotency Tests ===');

    // Test 11: First request creates transaction
    console.log('Test 11: First inter-bank transfer request creates transaction');
    const idempKey = `phase11-idem-${Date.now()}`;
    const firstRequest = await httpRequest(server, 'POST', '/api/transfers/interbank', {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 2000,
      idempotencyKey: idempKey,
    }, token1);
    assert.equal(firstRequest.status, 200);
    const firstTxRef = firstRequest.body.data.transfer.reference;
    console.log(`✓ First request created transaction: ${firstTxRef}`);

    // Test 12: Identical repeated request returns same transaction
    console.log('Test 12: Duplicate request with same idempotency key returns original transaction');
    const secondRequest = await httpRequest(server, 'POST', '/api/transfers/interbank', {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 2000,
      idempotencyKey: idempKey,
    }, token1);
    assert.equal(secondRequest.status, 200);
    const secondTxRef = secondRequest.body.data.transfer.reference;
    assert.equal(secondTxRef, firstTxRef);
    console.log('✓ Duplicate request returned original transaction reference');

    // Test 13: Verify only one transaction created
    console.log('Test 13: Verify only one transaction exists for idempotency key');
    const txCount = await Transaction.countDocuments({ idempotencyKey: idempKey });
    assert.equal(txCount, 1);
    console.log('✓ Only one transaction created for idempotency key');

    // Test 14: Different idempotency key creates new transaction
    console.log('Test 14: Different idempotency key creates new transaction');
    const newIdempKey = `phase11-idem2-${Date.now()}`;
    const thirdRequest = await httpRequest(server, 'POST', '/api/transfers/interbank', {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 2000,
      idempotencyKey: newIdempKey,
    }, token1);
    assert.equal(thirdRequest.status, 200);
    const thirdTxRef = thirdRequest.body.data.transfer.reference;
    assert.notEqual(thirdTxRef, firstTxRef);
    console.log('✓ Different idempotency key created new transaction');

    // Test 15: No idempotency key on subsequent requests
    console.log('Test 15: Requests without idempotency key are not protected');
    const noKeyRequest1 = await httpRequest(server, 'POST', '/api/transfers/interbank', {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 1000,
    }, token1);
    assert.equal(noKeyRequest1.status, 200);
    const noKeyRef1 = noKeyRequest1.body.data.transfer.reference;

    const noKeyRequest2 = await httpRequest(server, 'POST', '/api/transfers/interbank', {
      recipientBank: '260',
      recipientAccountNumber: '0123456789',
      amount: 1000,
    }, token1);
    assert.equal(noKeyRequest2.status, 200);
    const noKeyRef2 = noKeyRequest2.body.data.transfer.reference;

    assert.notEqual(noKeyRef1, noKeyRef2);
    console.log('✓ Requests without idempotency key created separate transactions');

    // Test 16: Idempotency key uniqueness at database level
    console.log('Test 16: Idempotency key uniqueness is enforced at database level');
    const uniqueKey = `phase11-unique-${Date.now()}`;
    try {
      const txs = await Transaction.create([
        {
          reference: `TRF-A-${Date.now()}`,
          fromAccount: account1._id,
          toAccount: account1._id,
          amount: 100,
          currency: 'NGN',
          status: 'PENDING',
          type: 'DEBIT',
          transferType: 'INTER_BANK',
          idempotencyKey: uniqueKey,
          externalTransactionId: 'EXT-A',
          recipientBankCode: '260',
          recipientAccountNumber: '0123456789',
        },
        {
          reference: `TRF-B-${Date.now() + 1}`,
          fromAccount: account1._id,
          toAccount: account1._id,
          amount: 100,
          currency: 'NGN',
          status: 'PENDING',
          type: 'DEBIT',
          transferType: 'INTER_BANK',
          idempotencyKey: uniqueKey,
          externalTransactionId: 'EXT-B',
          recipientBankCode: '260',
          recipientAccountNumber: '0123456789',
        },
      ]);
      assert.fail('Should have rejected duplicate idempotency key');
    } catch (error) {
      if (error.message === 'Should have rejected duplicate idempotency key') {
        throw error;
      }
      assert.ok(error.code === 11000 || (error.writeErrors && error.writeErrors.some(e => e.code === 11000)));
      console.log('✓ Database enforced uniqueness constraint on idempotency key');
    }

    console.log('\n=== Error Handling Tests ===');

    // Test 17: NIBSS unavailable gracefully handled
    console.log('Test 17: NIBSS unavailability is handled gracefully');
    const originalAuth = nibssAuth.authenticateFintech;
    nibssAuth.authenticateFintech = async () => {
      throw new Error('NIBSS service unavailable');
    };
    const nibssDownResponse = await httpRequest(server, 'GET', `/api/transfers/status/${interBankTx._id}?includeExternalStatus=true`, null, token1);
    nibssAuth.authenticateFintech = originalAuth;
    assert.equal(nibssDownResponse.status, 200);
    assert.ok(nibssDownResponse.body.data.transaction.status);
    console.log('✓ NIBSS unavailability handled gracefully');

    console.log('\n✅ All Phase 11 tests passed!');
  } finally {
    nibssAuth.authenticateFintech = originalAuthenticateFintech;
    nibssNameEnquiry.nameEnquiry = originalNameEnquiry;
    nibssTransfer.transfer = originalTransfer;
    nibssTransactionStatus.transactionStatus = originalTransactionStatus;
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Phase 11 database cleaned up');
  }
})().catch((error) => {
  console.error('❌ Phase 11 test failed:', error);
  process.exitCode = 1;
});
