import { describe, it, expect } from 'vitest';
import { registerUser, loginUser } from '../src/api/authApi.js';
import { submitVerification } from '../src/api/onboardingApi.js';
import { createAccount } from '../src/api/accountApi.js';
import { nameEnquiry, transferFunds } from '../src/api/transferApi.js';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

describe('Frontend Step 3 contract', () => {
  it('matches the Register.jsx and Login.jsx call signatures', async () => {
    const email = uniqueEmail('register-login');
    const password = 'Password123';

    console.log('\n--- 1) Register.jsx call signature ---');
    console.log('await registerUser({ email, password })');
    const reg = await registerUser({ email, password });
    console.log('RAW registerUser() result =');
    console.log(JSON.stringify(reg, null, 2));

    console.log('\n--- 2) Login.jsx call signature ---');
    console.log('await loginUser({ email, password })');
    const login = await loginUser({ email, password });
    console.log('RAW loginUser() result =');
    console.log(JSON.stringify(login, null, 2));

    expect(reg).toBeTruthy();
    expect(login).toBeTruthy();
    expect(login.user).toBeTruthy();
  });

  it('matches the Onboarding.jsx call signature', async () => {
    const email = uniqueEmail('onboarding');
    const password = 'Password123';
    await registerUser({ email, password });
    await loginUser({ email, password });

    console.log('\n--- 3) Onboarding.jsx call signature ---');
    console.log('await submitVerification({ method: "BVN", idNumber: "12345678901" })');
    const verified = await submitVerification({ method: 'BVN', idNumber: '12345678901' });
    console.log('RAW submitVerification() result =');
    console.log(JSON.stringify(verified, null, 2));

    expect(verified).toBeTruthy();
    expect(verified.status).toBeDefined();
  });

  it('matches the Account.jsx call signature and reads the same response fields the frontend code uses', async () => {
    const email = uniqueEmail('account');
    const password = 'Password123';
    await registerUser({ email, password });
    const login = await loginUser({ email, password });
    await submitVerification({ method: 'BVN', idNumber: '12345678901' });

    console.log('\n--- 4) Account.jsx call signature ---');
    console.log('await createAccount({ accountName: accountName || "Personal Savings Account", preferredName })');
    const account = await createAccount({
      accountName: 'Personal Savings Account',
      preferredName: 'My Savings',
    });

    console.log('Result: account created with accountNumber =', account.accountNumber);
    
    expect(login).toBeTruthy();
    expect(account).toBeTruthy();
    expect(account.accountName).toBeTruthy();
    expect(account.accountNumber).toMatch(/^\d{10}$/);
  });

  it('matches the Transfer.jsx name-enquiry/transfer signatures and reads the same response fields the frontend code uses', async () => {
    const senderEmail = uniqueEmail('transfer-sender');
    const senderPassword = 'Password123';
    await registerUser({ email: senderEmail, password: senderPassword });
    const senderLogin = await loginUser({ email: senderEmail, password: senderPassword });
    await submitVerification({ method: 'BVN', idNumber: '12345678901' });

    const senderAccount = await createAccount({
      accountName: 'Personal Savings Account',
      preferredName: 'My Savings',
    });

    const recipientEmail = uniqueEmail('transfer-recipient');
    const recipientPassword = 'Password123';
    await registerUser({ email: recipientEmail, password: recipientPassword });
    const recipientLogin = await loginUser({ email: recipientEmail, password: recipientPassword });
    await submitVerification({ method: 'BVN', idNumber: '10987654321' });

    const recipientAccount = await createAccount({
      accountName: 'Recipient Savings Account',
      preferredName: 'Other Savings',
    });

    await loginUser({ email: senderEmail, password: senderPassword });

    console.log('\n--- 5) Transfer.jsx name enquiry call signature ---');
    console.log('await nameEnquiry({ accountNumber, bankCode: "703" })');
    const enquiry = await nameEnquiry({
      accountNumber: recipientAccount.accountNumber,
      bankCode: '703',
    });
    console.log('RAW nameEnquiry() response =');
    console.log(JSON.stringify(enquiry, null, 2));
    console.log('transferApi.js extraction: accountNumber: result.accountNumber, accountName: result.accountName, bankName: BANKS.find((bank) => bank.code === result.bankCode)?.name || "Bank"');
    console.log('enquiry.accountName =', JSON.stringify(enquiry.accountName));
    console.log('enquiry.bankName =', JSON.stringify(enquiry.bankName));

    console.log('\n--- 6) Transfer.jsx transfer call signature ---');
    console.log('await transferFunds({ transferType, fromAccount, toAccount, toAccountName, toBankCode, toBankName, amount, narration })');
    const transfer = await transferFunds({
      transferType: 'INTRA_BANK',
      fromAccount: senderAccount.id,
      toAccount: recipientAccount.accountNumber,
      toAccountName: enquiry.accountName,
      toBankCode: '703',
      toBankName: enquiry.bankName,
      amount: '100',
      narration: 'Step 3 contract check',
    });
    console.log('RAW transferFunds() response =');
    console.log(JSON.stringify(transfer, null, 2));
    console.log('transferApi.js extraction: reference: result.transfer?.reference || result.reference, status: result.transfer?.status || result.status, amount: Number(result.transfer?.amount || result.amount || amount), toAccountName: toAccountName || result.transfer?.recipientName || "Recipient", toBankName: toBankName || null');
    console.log('transfer.reference =', JSON.stringify(transfer.reference));
    console.log('transfer.status =', JSON.stringify(transfer.status));

    expect(senderLogin).toBeTruthy();
    expect(recipientLogin).toBeTruthy();
    expect(enquiry).toBeTruthy();
    expect(transfer).toBeTruthy();
    expect(transfer.reference).toBeTruthy();
  });
});
