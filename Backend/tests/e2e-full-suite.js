const BASE_URL = 'http://localhost:3000';

const state = {
  userA: null,
  userB: null,
  userAToken: null,
  userBToken: null,
  userAAccount: null,
  userBAccount: null,
  transferRef: null,
  interbankRef: null,
  currentBalanceA: null,
  currentBalanceB: null,
  lastResponse: null,
};

const results = [];

function uniqueEmail(prefix = 'e2etest') {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}@example.com`;
}

function safeJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

function printRequest(name, method, path, body) {
  console.log(`\n=== ${name} REQUEST ===`);
  console.log(`${method.toUpperCase()} ${path}`);
  console.log(JSON.stringify(body ?? null, null, 2));
}

function printResponse(name, status, bodyText) {
  console.log(`\n=== ${name} RESPONSE ===`);
  console.log(`STATUS ${status}`);
  console.log(bodyText);
}

function recordResult(name, status, detail) {
  results.push({ name, status, detail });
}

async function apiRequest({ name, method, path, body, token }) {
  printRequest(name, method, path, body);

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const rawText = await response.text();
  printResponse(name, response.status, rawText);

  const parsed = safeJson(rawText);
  const result = { status: response.status, body: parsed, raw: rawText, headers: response.headers };
  state.lastResponse = result;
  return result;
}

function expectStatus(actualStatus, expectedStatus, name) {
  return actualStatus === expectedStatus;
}

function expectObjectPath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function markSkipped(name, reason) {
  console.log(`\n=== ${name} SKIPPED ===`);
  console.log(reason);
  recordResult(name, 'SKIPPED', reason);
}

async function runStep(name, fn, options = {}) {
  const dependsOn = options.dependsOn || [];
  const dependencyFailure = dependsOn.some((depName) => {
    const match = results.find((item) => item.name === depName);
    return match && match.status === 'FAIL';
  });

  if (dependencyFailure) {
    markSkipped(name, `Skipped because dependency failed: ${dependsOn.join(', ')}`);
    return;
  }

  try {
    const outcome = await fn();
    if (outcome && outcome.status === 'FAIL') {
      throw new Error(outcome.reason || 'Test failed');
    }
    recordResult(name, 'PASS', outcome?.detail || '');
  } catch (error) {
    const detail = error?.message || 'Unknown failure';
    console.log(`\n=== ${name} FAIL ===`);
    console.log(detail);
    recordResult(name, 'FAIL', detail);
  }
}

async function stepRegisterUserA() {
  state.userA = {
    email: uniqueEmail('e2etest_a'),
    password: 'TestPassword123!',
  };

  const res = await apiRequest({
    name: 'AUTH 01 - Register User A',
    method: 'POST',
    path: '/api/auth/register',
    body: {
      email: state.userA.email,
      password: state.userA.password,
      confirmPassword: state.userA.password,
    },
  });

  if (res.status !== 201 || !res.body?.success || !res.body?.data?.user?.id || res.body.data.user.email !== state.userA.email) {
    throw new Error(`Expected 201 + user object. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  if (res.body.data.user.password || res.body.data.password) {
    throw new Error(`Password leaked in registration response: ${JSON.stringify(res.body)}`);
  }
}

async function stepRegisterUserADuplicate() {
  const res = await apiRequest({
    name: 'AUTH 02 - Register User A again',
    method: 'POST',
    path: '/api/auth/register',
    body: {
      email: state.userA.email,
      password: state.userA.password,
      confirmPassword: state.userA.password,
    },
  });

  const allowed = [409, 400];
  if (!allowed.includes(res.status)) {
    throw new Error(`Expected 409/400 duplicate-user error, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  }
  if (res.status === 201) {
    throw new Error('Duplicate registration incorrectly returned 201');
  }
}

async function stepLoginUserA() {
  const res = await apiRequest({
    name: 'AUTH 03 - Login User A',
    method: 'POST',
    path: '/api/auth/login',
    body: {
      email: state.userA.email,
      password: state.userA.password,
    },
  });

  if (res.status !== 200 || !res.body?.success || !res.body?.data?.token) {
    throw new Error(`Expected 200 + token. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  state.userAToken = res.body.data.token;
}

async function stepLoginUserAWrongPassword() {
  const res = await apiRequest({
    name: 'AUTH 04 - Login User A wrong password',
    method: 'POST',
    path: '/api/auth/login',
    body: {
      email: state.userA.email,
      password: 'WrongPassword123!',
    },
  });

  if (res.status !== 401) {
    throw new Error(`Expected 401 unauthorized, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  }
}

async function stepRegisterUserB() {
  state.userB = {
    email: uniqueEmail('e2etest_b'),
    password: 'TestPassword123!',
  };

  const res = await apiRequest({
    name: 'AUTH 05 - Register User B',
    method: 'POST',
    path: '/api/auth/register',
    body: {
      email: state.userB.email,
      password: state.userB.password,
      confirmPassword: state.userB.password,
    },
  });

  if (res.status !== 201 || !res.body?.success || !res.body?.data?.user?.id) {
    throw new Error(`Expected 201 + user object. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepLoginUserB() {
  const res = await apiRequest({
    name: 'AUTH 06 - Login User B',
    method: 'POST',
    path: '/api/auth/login',
    body: {
      email: state.userB.email,
      password: state.userB.password,
    },
  });

  if (res.status !== 200 || !res.body?.success || !res.body?.data?.token) {
    throw new Error(`Expected 200 + token. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  state.userBToken = res.body.data.token;
}

async function stepCreateAccountBeforeOnboarding() {
  const res = await apiRequest({
    name: 'ONBOARDING 07 - Create account for User A before onboarding',
    method: 'POST',
    path: '/api/account/create',
    body: {
      kycType: 'BVN',
      kycID: '12345678901',
      dob: '1995-01-15',
    },
    token: state.userAToken,
  });

  if (res.status >= 200 && res.status < 300) {
    throw new Error(`Critical business-rule bug: account creation succeeded before verification. Body: ${JSON.stringify(res.body)}`);
  }
}

async function stepVerifyBVNUserA() {
  const res = await apiRequest({
    name: 'ONBOARDING 08 - Verify BVN for User A',
    method: 'POST',
    path: '/api/onboarding/bvn',
    body: { bvn: '22222222222' },
    token: state.userAToken,
  });

  if (res.status !== 200 || !res.body?.success || res.body.data.onboardingStatus !== 'VERIFIED') {
    throw new Error(`Expected 200 + verified onboarding. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepVerifyNINUserB() {
  const res = await apiRequest({
    name: 'ONBOARDING 09 - Verify NIN for User B',
    method: 'POST',
    path: '/api/onboarding/nin',
    body: { nin: '10987654321' },
    token: state.userBToken,
  });

  if (res.status !== 200 || !res.body?.success || res.body.data.onboardingStatus !== 'VERIFIED') {
    throw new Error(`Expected 200 + verified onboarding. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepVerifyMalformedID() {
  const res = await apiRequest({
    name: 'ONBOARDING 10 - Verify malformed ID',
    method: 'POST',
    path: '/api/onboarding/bvn',
    body: { bvn: '12345' },
    token: state.userAToken,
  });

  if (res.status !== 400) {
    throw new Error(`Expected 400 invalid ID, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  }
}

async function stepCreateAccountUserA() {
  const res = await apiRequest({
    name: 'ACCOUNT CREATION 11 - Create account for User A',
    method: 'POST',
    path: '/api/account/create',
    body: {
      kycType: 'BVN',
      kycID: '12345678901',
      dob: '1995-01-15',
    },
    token: state.userAToken,
  });

  if (res.status !== 201 || !res.body?.success || !res.body?.data?.account) {
    throw new Error(`Expected 201 + account object. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const account = res.body.data.account;
  if (!/^\d{10}$/.test(String(account.accountNumber))) {
    throw new Error(`Expected 10-digit accountNumber, got ${account.accountNumber}`);
  }
  if (account.balance !== 15000) {
    throw new Error(`Expected initial balance 15000, got ${account.balance}`);
  }

  state.userAAccount = account;
}

async function stepDoubleCreateUserA() {
  const res = await apiRequest({
    name: 'ACCOUNT CREATION 12 - Create second account for User A',
    method: 'POST',
    path: '/api/account/create',
    body: {
      kycType: 'BVN',
      kycID: '12345678901',
      dob: '1995-01-15',
    },
    token: state.userAToken,
  });

  if (res.status >= 200 && res.status < 300) {
    throw new Error(`Critical business-rule bug: second account creation succeeded. Body: ${JSON.stringify(res.body)}`);
  }
}

async function stepCreateAccountUserB() {
  const res = await apiRequest({
    name: 'ACCOUNT CREATION 13 - Create account for User B',
    method: 'POST',
    path: '/api/account/create',
    body: {
      kycType: 'NIN',
      kycID: '10987654321',
      dob: '1990-08-08',
    },
    token: state.userBToken,
  });

  if (res.status !== 201 || !res.body?.success || !res.body?.data?.account) {
    throw new Error(`Expected 201 + account object. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  state.userBAccount = res.body.data.account;
}

async function stepGetUserABalance() {
  const res = await apiRequest({
    name: 'BALANCE 14 - Get User A balance',
    method: 'GET',
    path: `/api/account/balance/${state.userAAccount._id || state.userAAccount.id || state.userAAccount.accountId}`,
    token: state.userAToken,
  });

  if (res.status !== 200 || !res.body?.success || res.body.data.account.balance !== 15000) {
    throw new Error(`Expected 200 + balance 15000. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  state.currentBalanceA = res.body.data.account.balance;
}

async function stepBalanceIDORUserB() {
  const res = await apiRequest({
    name: 'BALANCE 15 - User B reads User A balance',
    method: 'GET',
    path: `/api/account/balance/${state.userAAccount._id || state.userAAccount.id || state.userAAccount.accountId}`,
    token: state.userBToken,
  });

  if (res.status >= 200 && res.status < 300) {
    throw new Error(`CRITICAL security bug: User B could read User A balance. Response: ${JSON.stringify(res.body)}`);
  }
}

async function stepNameEnquiryUserBAccount() {
  const res = await apiRequest({
    name: 'NAME ENQUIRY 16 - Name enquiry on User B account number using User A token',
    method: 'POST',
    path: '/api/transfers/name-enquiry',
    body: {
      bankCode: state.userBAccount.bankCode,
      accountNumber: state.userBAccount.accountNumber,
    },
    token: state.userAToken,
  });

  if (res.status !== 200 || !res.body?.success || !res.body?.data?.accountName) {
    throw new Error(`Expected 200 + accountName. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  if (res.body.data.accountNumber !== state.userBAccount.accountNumber) {
    throw new Error(`Returned wrong account number: ${JSON.stringify(res.body)}`);
  }
}

async function stepNameEnquiryInvalid() {
  const res = await apiRequest({
    name: 'NAME ENQUIRY 17 - Invalid account number enquiry',
    method: 'POST',
    path: '/api/transfers/name-enquiry',
    body: {
      bankCode: '703',
      accountNumber: '0000000000',
    },
    token: state.userAToken,
  });

  if (res.status < 400 || res.status >= 500) {
    throw new Error(`Expected a clear 4xx not-found/validation error. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepIntraBankTransfer() {
  const amount = 2500;
  const res = await apiRequest({
    name: 'TRANSFER 18 - Intra-bank transfer from User A to User B',
    method: 'POST',
    path: '/api/transfers',
    body: {
      recipientAccountNumber: state.userBAccount.accountNumber,
      amount,
    },
    token: state.userAToken,
  });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Expected 200/201 transfer success. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const transfer = res.body?.data?.transfer || res.body?.data;
  if (!transfer || !transfer.reference) {
    throw new Error(`Transfer response missing reference: ${JSON.stringify(res.body)}`);
  }

  state.transferRef = transfer.reference;

  const balanceA = await apiRequest({
    name: 'TRANSFER 18 - Post-transfer balance check for User A',
    method: 'GET',
    path: `/api/account/balance/${state.userAAccount._id || state.userAAccount.id || state.userAAccount.accountId}`,
    token: state.userAToken,
  });
  const balanceB = await apiRequest({
    name: 'TRANSFER 18 - Post-transfer balance check for User B',
    method: 'GET',
    path: `/api/account/balance/${state.userBAccount._id || state.userBAccount.id || state.userBAccount.accountId}`,
    token: state.userBToken,
  });

  if (balanceA.status !== 200 || balanceB.status !== 200) {
    throw new Error(`Failed to read balances after transfer: ${balanceA.status}/${balanceB.status}`);
  }

  if (balanceA.body.data.account.balance !== 15000 - amount) {
    throw new Error(`User A balance mismatch after transfer. Expected ${15000 - amount}, got ${balanceA.body.data.account.balance}`);
  }
  if (balanceB.body.data.account.balance !== 15000 + amount) {
    throw new Error(`User B balance mismatch after transfer. Expected ${15000 + amount}, got ${balanceB.body.data.account.balance}`);
  }

  state.currentBalanceA = balanceA.body.data.account.balance;
  state.currentBalanceB = balanceB.body.data.account.balance;
}

async function stepTransferInsufficientFunds() {
  // LIVE ROUND-TRIP: Get actual balance before attempt
  const balanceBeforeRes = await apiRequest({
    name: 'TRANSFER 19 - Get balance before insufficient funds attempt',
    method: 'GET',
    path: `/api/account/balance/${state.userAAccount._id || state.userAAccount.id || state.userAAccount.accountId}`,
    token: state.userAToken,
  });

  if (balanceBeforeRes.status !== 200) {
    throw new Error(`Failed to fetch balance before transfer: ${JSON.stringify(balanceBeforeRes.body)}`);
  }

  const balanceBefore = balanceBeforeRes.body.data.account.balance;

  // Attempt transfer with amount > current balance
  const res = await apiRequest({
    name: 'TRANSFER 19 - Insufficient funds transfer',
    method: 'POST',
    path: '/api/transfers',
    body: {
      recipientAccountNumber: state.userBAccount.accountNumber,
      amount: balanceBefore + 1000,
    },
    token: state.userAToken,
  });

  if (res.status < 400) {
    throw new Error(`Expected rejection for insufficient funds, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  }

  // LIVE ROUND-TRIP: Get actual balance after failed attempt
  const balanceAfterRes = await apiRequest({
    name: 'TRANSFER 19 - Confirm no balance movement afterwards',
    method: 'GET',
    path: `/api/account/balance/${state.userAAccount._id || state.userAAccount.id || state.userAAccount.accountId}`,
    token: state.userAToken,
  });

  if (balanceAfterRes.status !== 200) {
    throw new Error(`Failed to fetch balance after transfer: ${JSON.stringify(balanceAfterRes.body)}`);
  }

  const balanceAfter = balanceAfterRes.body.data.account.balance;

  // Compare actual API responses directly — fail loudly if balance changed
  if (balanceAfter !== balanceBefore) {
    throw new Error(`CRITICAL: Balance mutated after failed transfer. Before: ${balanceBefore}, After: ${balanceAfter}`);
  }
}

async function stepTransferNonExistentAccount() {
  const res = await apiRequest({
    name: 'TRANSFER 20 - Transfer to non-existent account',
    method: 'POST',
    path: '/api/transfers',
    body: {
      recipientAccountNumber: '9999999999',
      amount: 100,
    },
    token: state.userAToken,
  });

  if (res.status < 400) {
    throw new Error(`Expected rejection for non-existent recipient. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepTransferZeroOrNegative() {
  const res = await apiRequest({
    name: 'TRANSFER 21 - Transfer zero/negative amount',
    method: 'POST',
    path: '/api/transfers',
    body: {
      recipientAccountNumber: state.userBAccount.accountNumber,
      amount: 0,
    },
    token: state.userAToken,
  });

  if (res.status !== 400) {
    throw new Error(`Expected 400 for invalid amount, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  }
}

async function stepInterbankIfImplemented() {
  const probe = await apiRequest({
    name: 'INTERBANK 22 - Probe inter-bank endpoint availability',
    method: 'POST',
    path: '/api/transfers/interbank',
    body: {
      recipientBank: '703',
      recipientAccountNumber: '7031234567',
      amount: 100,
    },
    token: state.userAToken,
  });

  if (probe.status === 404 || probe.body?.message?.toLowerCase().includes('route not found')) {
    throw new Error('Inter-bank feature not present on this backend build.');
  }

  const res = await apiRequest({
    name: 'INTERBANK 22 - Inter-bank transfer valid recipient',
    method: 'POST',
    path: '/api/transfers/interbank',
    body: {
      recipientBank: '703',
      recipientAccountNumber: '7031234567',
      amount: 100,
    },
    token: state.userAToken,
  });

  const transfer = res.body?.data?.transfer || res.body?.data;
  if (res.status >= 200 && res.status < 300) {
    if (!transfer?.reference) {
      throw new Error(`Inter-bank transfer succeeded but without reference: ${JSON.stringify(res.body)}`);
    }
    state.interbankRef = transfer.reference;
    return;
  }

  if (res.status === 400 || res.status === 503 || res.status === 502) {
    throw new Error(`Inter-bank transfer unexpectedly rejected: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepQueryInterbankStatus() {
  const ref = state.interbankRef;
  if (!ref) {
    throw new Error('Inter-bank transfer did not produce a reference in this run.');
  }

  const res = await apiRequest({
    name: 'INTERBANK 23 - Query inter-bank status',
    method: 'GET',
    path: `/api/transfers/status/${ref}`,
    token: state.userAToken,
  });

  if (res.status !== 200 || !res.body?.success || !res.body?.data?.transaction) {
    throw new Error(`Expected 200 + transaction status. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepQueryStatusByReference() {
  const res = await apiRequest({
    name: 'TRANSACTION STATUS 24 - Query status for successful intra-bank transfer',
    method: 'GET',
    path: `/api/transfers/status/${state.transferRef}`,
    token: state.userAToken,
  });

  if (res.status !== 200 || !res.body?.success || !res.body?.data?.transaction) {
    throw new Error(`Expected 200 + transaction. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepQueryStatusBadReference() {
  const res = await apiRequest({
    name: 'TRANSACTION STATUS 25 - Query invalid transaction reference',
    method: 'GET',
    path: '/api/transfers/status/507f1f77bcf86cd799439011',
    token: state.userAToken,
  });

  if (res.status !== 404) {
    throw new Error(`Expected 404 invalid reference, got ${res.status}. Body: ${JSON.stringify(res.body)}`);
  }
}

async function stepTransactionStatusIDOR() {
  const res = await apiRequest({
    name: 'TRANSACTION STATUS 25B - User B reads User A transaction (IDOR test)',
    method: 'GET',
    path: `/api/transfers/status/${state.transferRef}`,
    token: state.userBToken,
  });

  if (res.status < 400) {
    throw new Error(`Expected rejection (403/404) for User B accessing User A's transaction. Got ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepAccountDetailsIDOR() {
  const accountId = state.userAAccount._id || state.userAAccount.id || state.userAAccount.accountId;
  const res = await apiRequest({
    name: 'ACCOUNT 13B - User B reads User A account details (IDOR test)',
    method: 'GET',
    path: `/api/account/${accountId}`,
    token: state.userBToken,
  });

  if (res.status < 400) {
    throw new Error(`Expected rejection (403/404) for User B accessing User A's account details. Got ${res.status} ${JSON.stringify(res.body)}`);
  }
}

async function stepGetUserAHistory() {
  const res = await apiRequest({
    name: 'TRANSACTION HISTORY 26 - Get User A transaction history',
    method: 'GET',
    path: '/api/transactions/history?page=1&limit=20',
    token: state.userAToken,
  });

  if (res.status !== 200 || !res.body?.success || !Array.isArray(res.body.data.transactions)) {
    throw new Error(`Expected 200 + transactions array. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const refs = res.body.data.transactions.map((tx) => tx.reference);
  if (!refs.includes(state.transferRef)) {
    throw new Error(`Intra-bank transfer missing from history. History: ${JSON.stringify(res.body.data.transactions)}`);
  }
}

async function stepHistoryIDORUserB() {
  const res = await apiRequest({
    name: 'TRANSACTION HISTORY 27 - User B accesses User A transaction history',
    method: 'GET',
    path: '/api/transactions/history?page=1&limit=20',
    token: state.userBToken,
  });

  if (res.status !== 200 || !res.body?.success || !Array.isArray(res.body.data.transactions)) {
    throw new Error(`Expected 200 + own-transaction history for User B. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const accountId = state.userBAccount._id || state.userBAccount.id || state.userBAccount.accountId;
  const ownRelated = res.body.data.transactions.every((tx) => {
    const fromId = tx.fromAccountId && tx.fromAccountId.toString ? tx.fromAccountId.toString() : tx.fromAccountId;
    const toId = tx.toAccountId && tx.toAccountId.toString ? tx.toAccountId.toString() : tx.toAccountId;
    return [fromId, toId].includes(accountId);
  });

  if (!ownRelated) {
    throw new Error(`User B history included records unrelated to B's account: ${JSON.stringify(res.body.data.transactions)}`);
  }
}

async function stepHistoryPagination() {
  const res = await apiRequest({
    name: 'TRANSACTION HISTORY 28 - Get paginated history',
    method: 'GET',
    path: '/api/transactions/history?page=1&limit=1',
    token: state.userAToken,
  });

  if (res.status !== 200 || !res.body?.success || !Array.isArray(res.body.data.transactions) || res.body.data.transactions.length !== 1) {
    throw new Error(`Expected 1 result on page 1 limit 1. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  if (!res.body.data.pagination || res.body.data.pagination.currentPage !== 1) {
    throw new Error(`Missing pagination metadata: ${JSON.stringify(res.body)}`);
  }
}

async function stepHistoryFilterTypeTransfer() {
  const res = await apiRequest({
    name: 'TRANSACTION HISTORY 29 - Filter history by TRANSFER type',
    method: 'GET',
    path: '/api/transactions/history?page=1&limit=20&type=DEBIT',
    token: state.userAToken,
  });

  if (res.status !== 200 || !res.body?.success || !Array.isArray(res.body.data.transactions)) {
    throw new Error(`Expected 200 + history results. Actual: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const bad = res.body.data.transactions.some((tx) => tx.type !== 'DEBIT');
  if (bad) {
    throw new Error(`Filter type=DEBIT returned non-DEBIT transactions: ${JSON.stringify(res.body.data.transactions)}`);
  }
}

(async function main() {
  console.log('=== BACKEND E2E FULL SUITE START ===');

  const tests = [
    ['AUTH 01 - Register User A', () => runStep('AUTH 01 - Register User A', stepRegisterUserA)],
    ['AUTH 02 - Register User A again', () => runStep('AUTH 02 - Register User A again', stepRegisterUserADuplicate, { dependsOn: ['AUTH 01 - Register User A'] })],
    ['AUTH 03 - Login User A', () => runStep('AUTH 03 - Login User A', stepLoginUserA, { dependsOn: ['AUTH 01 - Register User A'] })],
    ['AUTH 04 - Login User A wrong password', () => runStep('AUTH 04 - Login User A wrong password', stepLoginUserAWrongPassword, { dependsOn: ['AUTH 03 - Login User A'] })],
    ['AUTH 05 - Register User B', () => runStep('AUTH 05 - Register User B', stepRegisterUserB, { dependsOn: ['AUTH 03 - Login User A'] })],
    ['AUTH 06 - Login User B', () => runStep('AUTH 06 - Login User B', stepLoginUserB, { dependsOn: ['AUTH 05 - Register User B'] })],
    ['ONBOARDING 07 - Create account before onboarding', () => runStep('ONBOARDING 07 - Create account for User A before onboarding', stepCreateAccountBeforeOnboarding, { dependsOn: ['AUTH 03 - Login User A'] })],
    ['ONBOARDING 08 - Verify BVN for User A', () => runStep('ONBOARDING 08 - Verify BVN for User A', stepVerifyBVNUserA, { dependsOn: ['AUTH 03 - Login User A'] })],
    ['ONBOARDING 09 - Verify NIN for User B', () => runStep('ONBOARDING 09 - Verify NIN for User B', stepVerifyNINUserB, { dependsOn: ['AUTH 06 - Login User B'] })],
    ['ONBOARDING 10 - Verify malformed ID', () => runStep('ONBOARDING 10 - Verify malformed ID', stepVerifyMalformedID, { dependsOn: ['ONBOARDING 08 - Verify BVN for User A'] })],
    ['ACCOUNT CREATION 11 - Create account for User A', () => runStep('ACCOUNT CREATION 11 - Create account for User A', stepCreateAccountUserA, { dependsOn: ['ONBOARDING 08 - Verify BVN for User A'] })],
    ['ACCOUNT CREATION 12 - Create second account for User A', () => runStep('ACCOUNT CREATION 12 - Create second account for User A', stepDoubleCreateUserA, { dependsOn: ['ACCOUNT CREATION 11 - Create account for User A'] })],
    ['ACCOUNT CREATION 13 - Create account for User B', () => runStep('ACCOUNT CREATION 13 - Create account for User B', stepCreateAccountUserB, { dependsOn: ['ONBOARDING 09 - Verify NIN for User B'] })],
    ['BALANCE 14 - Get User A balance', () => runStep('BALANCE 14 - Get User A balance', stepGetUserABalance, { dependsOn: ['ACCOUNT CREATION 11 - Create account for User A'] })],
    ['BALANCE 15 - User B reads User A balance', () => runStep('BALANCE 15 - User B reads User A balance', stepBalanceIDORUserB, { dependsOn: ['BALANCE 14 - Get User A balance'] })],
    ['NAME ENQUIRY 16 - Name enquiry on User B account', () => runStep('NAME ENQUIRY 16 - Name enquiry on User B account', stepNameEnquiryUserBAccount, { dependsOn: ['ACCOUNT CREATION 13 - Create account for User B'] })],
    ['NAME ENQUIRY 17 - Invalid account number enquiry', () => runStep('NAME ENQUIRY 17 - Invalid account number enquiry', stepNameEnquiryInvalid, { dependsOn: ['NAME ENQUIRY 16 - Name enquiry on User B account'] })],
    ['TRANSFER 18 - Intra-bank transfer', () => runStep('TRANSFER 18 - Intra-bank transfer from User A to User B', stepIntraBankTransfer, { dependsOn: ['BALANCE 14 - Get User A balance', 'ACCOUNT CREATION 13 - Create account for User B'] })],
    ['TRANSFER 19 - Insufficient funds transfer', () => runStep('TRANSFER 19 - Insufficient funds transfer', stepTransferInsufficientFunds, { dependsOn: ['TRANSFER 18 - Intra-bank transfer from User A to User B'] })],
    ['TRANSFER 20 - Non-existent account transfer', () => runStep('TRANSFER 20 - Transfer to non-existent account', stepTransferNonExistentAccount, { dependsOn: ['TRANSFER 18 - Intra-bank transfer from User A to User B'] })],
    ['TRANSFER 21 - Zero/negative transfer', () => runStep('TRANSFER 21 - Transfer zero/negative amount', stepTransferZeroOrNegative, { dependsOn: ['TRANSFER 18 - Intra-bank transfer from User A to User B'] })],
    ['INTERBANK 22 - Inter-bank transfer valid recipient', () => runStep('INTERBANK 22 - Inter-bank transfer valid recipient', stepInterbankIfImplemented, { dependsOn: ['TRANSFER 18 - Intra-bank transfer from User A to User B'] })],
    ['INTERBANK 23 - Query inter-bank status', () => runStep('INTERBANK 23 - Query inter-bank status', stepQueryInterbankStatus, { dependsOn: ['INTERBANK 22 - Inter-bank transfer valid recipient'] })],
    ['TRANSACTION STATUS 24 - Query status by intra-bank reference', () => runStep('TRANSACTION STATUS 24 - Query status for successful intra-bank transfer', stepQueryStatusByReference, { dependsOn: ['TRANSFER 18 - Intra-bank transfer from User A to User B'] })],
    ['TRANSACTION STATUS 25 - Query invalid reference', () => runStep('TRANSACTION STATUS 25 - Query invalid transaction reference', stepQueryStatusBadReference, { dependsOn: ['TRANSACTION STATUS 24 - Query status for successful intra-bank transfer'] })],
    ['TRANSACTION STATUS 25B - IDOR test', () => runStep('TRANSACTION STATUS 25B - User B reads User A transaction (IDOR test)', stepTransactionStatusIDOR, { dependsOn: ['TRANSACTION STATUS 24 - Query status for successful intra-bank transfer'] })],
    ['ACCOUNT 13B - IDOR test', () => runStep('ACCOUNT 13B - User B reads User A account details (IDOR test)', stepAccountDetailsIDOR, { dependsOn: ['ACCOUNT CREATION 13 - Create account for User B'] })],
    ['TRANSACTION HISTORY 26 - Get User A history', () => runStep('TRANSACTION HISTORY 26 - Get User A transaction history', stepGetUserAHistory, { dependsOn: ['TRANSFER 18 - Intra-bank transfer from User A to User B'] })],
    ['TRANSACTION HISTORY 27 - User B accesses User A history', () => runStep('TRANSACTION HISTORY 27 - User B accesses User A transaction history', stepHistoryIDORUserB, { dependsOn: ['TRANSACTION HISTORY 26 - Get User A transaction history'] })],
    ['TRANSACTION HISTORY 28 - Paginated history', () => runStep('TRANSACTION HISTORY 28 - Get paginated history', stepHistoryPagination, { dependsOn: ['TRANSACTION HISTORY 26 - Get User A transaction history'] })],
    ['TRANSACTION HISTORY 29 - Filter history by transfer type', () => runStep('TRANSACTION HISTORY 29 - Filter history by transfer type', stepHistoryFilterTypeTransfer, { dependsOn: ['TRANSACTION HISTORY 26 - Get User A transaction history'] })],
  ];

  for (const [name, runner] of tests) {
    await runner();
  }

  console.log('\n=== SUMMARY TABLE ===');
  console.log('| Test | Status |');
  console.log('| --- | --- |');
  for (const result of results) {
    console.log(`| ${result.name} | ${result.status} |`);
  }
})();
