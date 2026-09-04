const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const Account = require('../models/account.model');
const Transaction = require('../models/transaction.model');

test('Phase 2 models expose the required relationships and timestamps', () => {
  assert.ok(User.schema.indexes().some(([fields, options]) => fields.email === 1 && options.unique));
  assert.equal(Customer.schema.path('user').options.ref, 'User');
  assert.equal(Account.schema.path('customer').options.ref, 'Customer');
  assert.equal(Transaction.schema.path('fromAccount').options.ref, 'Account');
  assert.equal(Transaction.schema.path('toAccount').options.ref, 'Account');
  assert.deepEqual(User.schema.options.timestamps, true);
  assert.deepEqual(Customer.schema.options.timestamps, true);
  assert.deepEqual(Account.schema.options.timestamps, true);
  assert.deepEqual(Transaction.schema.options.timestamps, true);
});

test('Phase 2 models reject invalid documented data shapes', async () => {
  const user = new User({ email: 'not-an-email' });
  const customer = new Customer({ user: new mongoose.Types.ObjectId(), status: 'UNKNOWN' });
  const account = new Account({
    accountNumber: '123',
    accountName: 'Test User',
    bankCode: '7',
    customer: new mongoose.Types.ObjectId(),
    balance: 1.5,
  });
  const transaction = new Transaction({
    reference: 'TX-1',
    fromAccount: new mongoose.Types.ObjectId(),
    toAccount: new mongoose.Types.ObjectId(),
    amount: 0,
    status: 'UNKNOWN',
    type: 'REFUND',
    transferType: 'INTERNATIONAL',
  });

  await assert.rejects(user.validate(), (error) => Boolean(error.errors.email));
  await assert.rejects(customer.validate(), (error) => Boolean(error.errors.status));
  await assert.rejects(account.validate(), (error) => Boolean(
    error.errors.accountNumber && error.errors.bankCode && error.errors.balance,
  ));
  await assert.rejects(transaction.validate(), (error) => Boolean(
    error.errors.amount
      && error.errors.status
      && error.errors.type
      && error.errors.transferType,
  ));
});

test('Phase 2 models declare database uniqueness indexes', () => {
  const indexPaths = (schema) => schema.indexes().map(([fields, options]) => ({ fields, options }));

  assert.ok(indexPaths(User.schema).some(({ fields, options }) => fields.email === 1 && options.unique));
  assert.ok(indexPaths(Account.schema).some(({ fields, options }) => fields.accountNumber === 1 && options.unique));
  assert.ok(indexPaths(Account.schema).some(({ fields, options }) => fields.customer === 1 && options.unique));
  assert.ok(indexPaths(Transaction.schema).some(({ fields, options }) => fields.reference === 1 && options.unique));
});
