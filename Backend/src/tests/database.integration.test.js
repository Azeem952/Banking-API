const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const Account = require('../models/account.model');
const Transaction = require('../models/transaction.model');

async function expectDuplicate(operation) {
  await assert.rejects(operation, (error) => error.code === 11000);
}

async function expectValidation(operation) {
  await assert.rejects(operation, (error) => error.name === 'ValidationError' || error.name === 'CastError');
}

async function run() {
  assert.ok(process.env.MONGODB_URI, 'MONGODB_URI must be supplied for this integration test');
  await connectDatabase();

  try {
    await Promise.all([
      User.syncIndexes(),
      Customer.syncIndexes(),
      Account.syncIndexes(),
      Transaction.syncIndexes(),
    ]);

    const collections = await Promise.all([
      User.collection.indexes(),
      Customer.collection.indexes(),
      Account.collection.indexes(),
      Transaction.collection.indexes(),
    ]);
    const indexNames = collections.flat().map((index) => index.name);
    for (const indexName of ['email_1', 'user_1', 'accountNumber_1', 'customer_1', 'reference_1']) {
      assert.ok(indexNames.includes(indexName), `missing actual index ${indexName}`);
    }

    const email = `phase2-${Date.now()}@example.test`;
    const user = await User.create({
      email,
      passwordHash: bcrypt.hashSync('Password123', 10),
    });
    assert.equal((await User.findById(user._id)).email, email);
    await expectDuplicate(() => User.create({
      email,
      passwordHash: bcrypt.hashSync('Password123', 10),
    }));

    const customer = await Customer.create({ user: user._id });
    const account = await Account.create({
      accountNumber: '7012345678',
      accountName: 'Phase Two Test',
      bankCode: '701',
      customer: customer._id,
      balance: 15000,
    });
    assert.equal((await Account.findById(account._id)).accountNumber, '7012345678');
    await expectDuplicate(() => Account.create({
      accountNumber: '7012345678',
      accountName: 'Duplicate Number',
      bankCode: '701',
      customer: new mongoose.Types.ObjectId(),
      balance: 1,
    }));
    await expectDuplicate(() => Account.create({
      accountNumber: '7098765432',
      accountName: 'Duplicate Customer',
      bankCode: '701',
      customer: customer._id,
      balance: 1,
    }));

    const reference = `P2-${Date.now()}`;
    const transaction = await Transaction.create({
      reference,
      fromAccount: account._id,
      toAccount: account._id,
      amount: 1,
      status: 'PENDING',
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
    });
    assert.equal((await Transaction.findById(transaction._id)).reference, reference);
    await expectDuplicate(() => Transaction.create({
      reference,
      fromAccount: account._id,
      toAccount: account._id,
      amount: 1,
      type: 'CREDIT',
      transferType: 'INTRA_BANK',
    }));

    await expectValidation(() => User.create({}));
    await expectValidation(() => Customer.create({ user: new mongoose.Types.ObjectId(), status: 'INVALID' }));
    await expectValidation(() => Account.create({
      accountNumber: '123',
      accountName: 'Invalid',
      bankCode: '701',
      customer: new mongoose.Types.ObjectId(),
      balance: 1,
    }));
    await expectValidation(() => Account.create({
      accountNumber: '7011111111',
      accountName: 'Invalid',
      bankCode: '701',
      customer: new mongoose.Types.ObjectId(),
      balance: -1,
    }));
    await expectValidation(() => Transaction.create({
      reference: `invalid-${Date.now()}`,
      fromAccount: account._id,
      toAccount: account._id,
      amount: 0,
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
    }));
    await expectValidation(() => Transaction.create({
      reference: `invalid-ref-${Date.now()}`,
      fromAccount: 'not-an-object-id',
      toAccount: account._id,
      amount: 1,
      type: 'DEBIT',
      transferType: 'INTRA_BANK',
    }));

    const populated = await Transaction.findById(transaction._id).populate('fromAccount toAccount');
    assert.equal(populated.fromAccount.accountNumber, account.accountNumber);
    assert.equal(populated.toAccount.accountNumber, account.accountNumber);
    console.log('Phase 2 MongoDB integration validation passed');
  } finally {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
    console.log('Isolated Phase 2 database cleaned up');
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
