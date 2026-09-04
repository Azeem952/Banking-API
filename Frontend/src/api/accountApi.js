import { apiRequest, getStoredSession, persistSession } from "./client";

const INITIAL_FUNDING = 15000;

export function getAccount() {
  const session = getStoredSession();
  return session?.account || null;
}

export async function createAccount({ accountName, preferredName }) {
  const result = await apiRequest({
    path: "/api/account/create",
    method: "POST",
    body: {
      kycType: "BVN",
      kycID: "12345678901",
      dob: "1995-01-15",
    },
  });

  const accountData = result?.account || result || {};
  const account = {
    ...accountData,
    id: accountData.id || accountData._id,
    accountNumber: accountData.accountNumber,
    accountName: accountData.accountName || accountName || "Personal Savings Account",
    preferredName: preferredName || accountData.accountName || "My Savings",
    balance: accountData.balance ?? INITIAL_FUNDING,
    status: accountData.status || "ACTIVE",
    createdAt: accountData.createdAt || new Date().toISOString(),
  };

  const session = getStoredSession();
  persistSession({ ...session, account });
  return account;
}
