import { test, expect } from "@playwright/test";

const baseURL = "http://localhost:5173";
const apiURL = "http://localhost:3000";
const password = "Password123!";
const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const userA = {
  email: `e2e-a-${runId}@example.com`,
  bvn: "12345678901",
};
const userB = {
  email: `e2e-b-${runId}@example.com`,
  bvn: "12345678902",
};

async function apiRequest(request, path, options = {}) {
  const response = await request.fetch(`${apiURL}${path}`, options);
  const body = await response.json();
  expect(response.ok(), `${options.method || "GET"} ${path}: ${JSON.stringify(body)}`).toBeTruthy();
  return body.data || body;
}

async function createVerifiedRecipient(request) {
  const registered = await apiRequest(request, "/api/auth/register", {
    method: "POST",
    data: { email: userB.email, password },
  });
  const loggedIn = await apiRequest(request, "/api/auth/login", {
    method: "POST",
    data: { email: userB.email, password },
  });
  const token = loggedIn.token;
  await apiRequest(request, "/api/onboarding/bvn", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: { bvn: userB.bvn },
  });
  const account = await apiRequest(request, "/api/account/create", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    data: {
      kycType: "BVN",
      kycID: userB.bvn,
      dob: "1995-01-15",
      accountName: "Recipient Savings",
      preferredName: "Recipient",
    },
  });
  return { registered, account: account.account || account };
}

async function registerAndLogin(page) {
  await test.step("Register fresh User A", async () => {
    await page.goto(`${baseURL}/register`);
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
    await page.getByPlaceholder("Enter your email address").fill(userA.email);
    await page.getByPlaceholder("Create a strong password").fill(password);
    await page.getByPlaceholder("Confirm your password").fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Registration successful. Log in to continue.")).toBeVisible();
  });

  await test.step("Log in User A", async () => {
    await page.getByPlaceholder("Enter your email address").fill(userA.email);
    await page.getByPlaceholder("Enter your password").fill(password);
    await page.getByRole("button", { name: "Log In" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "Customer Onboarding" })).toBeVisible();
  });
}

async function completeOnboarding(page) {
  await test.step("Complete BVN onboarding", async () => {
    await expect(page.getByText("BVN Verification")).toBeVisible();
    await page.getByPlaceholder("Enter your BVN").fill(userA.bvn);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Verification successful. Redirecting you to account creation…")).toBeVisible();
    await expect(page).toHaveURL(/\/account$/, { timeout: 5000 });
  });
}

async function createAccount(page) {
  let accountNumber;
  await test.step("Create funded account", async () => {
    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page.getByText("Account Created Successfully")).toBeVisible();
    await expect(page.getByText("Your account has been funded with ₦15,000.00.")).toBeVisible();
    await expect(page.locator("dd").filter({ hasText: "₦15,000.00" })).toBeVisible();
    accountNumber = await page.locator("dt", { hasText: "Account Number" }).locator("..").locator("dd").innerText();
    expect(accountNumber).toMatch(/^\d{10}$/);
  });
  return accountNumber;
}

async function transfer(page, recipientAccount, type, amount) {
  await page.goto(`${baseURL}/transfer`);
  await expect(page.getByRole("heading", { name: "Transfer Money" })).toBeVisible();
  if (type === "INTER_BANK") {
    await page.getByRole("button", { name: /Inter-bank Transfer/ }).click();
    await page.locator("select").selectOption("000001");
  } else {
    await page.getByRole("button", { name: /Intra-bank Transfer/ }).click();
  }
  await page.getByPlaceholder("Enter account number").fill(recipientAccount);
  await page.getByRole("button", { name: "Enquire Name" }).click();
  const enquiryMessage = page.locator("div.mt-2.min-h-\\[20px\\] p");
  await expect(enquiryMessage).toBeVisible();
  await expect(enquiryMessage).not.toHaveText("Recipient name will appear here after verification");
  await page.getByPlaceholder("Enter amount").fill(String(amount));
  await page.getByPlaceholder("Enter narration").fill(`${type} E2E transfer`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Review Transfer")).toBeVisible();
  await page.getByRole("button", { name: "Confirm & Send" }).click();
  await expect(page.getByText(/Transfer Successful|Transfer Pending/)).toBeVisible({ timeout: 15000 });
  const state = await page.locator("body").innerText();
  expect(state).toMatch(/Reference:|being processed by the receiving bank/);
  const reference = state.match(/Reference:\s*([A-Za-z0-9-]+)/)?.[1] || null;
  return { reference, state };
}

test("Step 4 full customer and security journeys", async ({ page, request }) => {
  test.setTimeout(90000);
  const recipient = await test.step("Provision real User B recipient account", () => createVerifiedRecipient(request));
  expect(recipient.account.accountNumber).toMatch(/^\d{10}$/);
  expect(recipient.account.id).toBeTruthy();

  await registerAndLogin(page);
  await completeOnboarding(page);
  const senderAccountNumber = await createAccount(page);

  let senderAccountId;
  await test.step("Verify dashboard balance and account number", async () => {
    await page.getByRole("button", { name: "Go to Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "₦15,000.00" }).first()).toBeVisible();
    await expect(page.getByText(senderAccountNumber, { exact: true })).toBeVisible();
    const session = await page.evaluate(() => JSON.parse(localStorage.getItem("nexora_session")));
    senderAccountId = session.account.id;
  });

  const intraBank = await test.step("Complete intra-bank transfer", () =>
    transfer(page, recipient.account.accountNumber, "INTRA_BANK", 100));

  await test.step("Complete inter-bank transfer when exposed", async () => {
    const result = await transfer(page, "0123456789", "INTER_BANK", 100);
    expect(result.state).toMatch(/Transfer Successful|Transfer Pending/);
  });

  await test.step("Verify transaction history contains transfer", async () => {
    await page.goto(`${baseURL}/transactions`);
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.getByText(intraBank.reference, { exact: true }).first()).toBeVisible();
  });

  await test.step("Verify transaction detail status and amount", async () => {
    await page.getByText(intraBank.reference, { exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/transactions/${intraBank.reference}$`));
    await expect(page.getByRole("heading", { name: "Transaction Details" })).toBeVisible();
    await expect(page.getByText(/Successful|Pending|Failed/, { exact: true })).toBeVisible();
    await expect(page.getByText(/−₦100\.00/)).toBeVisible();
  });

  await test.step("Block User A from User B account detail", async () => {
    await page.goto(`${baseURL}/account/${recipient.account.id}`);
    await expect(page).not.toHaveURL(new RegExp(`/account/${recipient.account.id}$`));
    await expect(page.getByText(recipient.account.accountNumber, { exact: true })).not.toBeVisible();
  });

  await test.step("Block User A from User B transaction detail", async () => {
    await page.goto(`${baseURL}/transactions/${recipient.account.id}`);
    await expect(page.getByText(/Transaction not found|Invalid resource identifier/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Transaction Details" })).not.toBeVisible();
    await expect(page.getByText(recipient.account.accountNumber, { exact: true })).not.toBeVisible();
  });

  expect(senderAccountId).toBeTruthy();
});