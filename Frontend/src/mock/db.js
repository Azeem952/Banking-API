// ---------------------------------------------------------------------------
// MOCK DATA LAYER
// ---------------------------------------------------------------------------
// This file simulates a backend database using localStorage so the frontend
// is fully functional on its own. It exists ONLY because this build has no
// backend attached yet.
//
// When the real API is ready, delete this file and the /src/api/* modules'
// internals should call `fetch(...)` against the real endpoints instead of
// reading/writing here. Every function in /src/api/* is written to mirror a
// real REST call (same inputs, same shape of resolved/rejected value), so
// swapping the implementation should not require touching any page/component.
// ---------------------------------------------------------------------------

const DB_KEY = "nexora_mock_db_v1";

const initialState = {
  users: [
    {
      id: "seed-user-1",
      fullName: "John Doe",
      email: "demo@nexora.com",
      phone: "8012345678",
      password: "local-demo-only",
      createdAt: new Date().toISOString(),
    },
  ],
  sessionUserId: null,
  onboarding: {
    // seed user pre-verified so the demo can jump straight into banking flows
    "seed-user-1": { status: "VERIFIED", method: "BVN", idNumber: "00000000000" },
  },
  accounts: {
    "seed-user-1": {
      accountNumber: "0000000000",
      accountName: "Personal Savings Account",
      preferredName: "My Savings",
      balance: 15000,
      status: "ACTIVE",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    },
  },
  transactions: {
    "seed-user-1": [
      {
        reference: "FUND-250520-1030",
        type: "FUNDING",
        description: "Account Funding",
        amount: 15000,
        direction: "CREDIT",
        status: "SUCCESSFUL",
        channel: "System",
        date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      },
    ],
  },
};

function readDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      localStorage.setItem(DB_KEY, JSON.stringify(initialState));
      return structuredClone(initialState);
    }
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(DB_KEY, JSON.stringify(initialState));
    return structuredClone(initialState);
  }
}

function writeDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function getDB() {
  return readDB();
}

export function updateDB(mutator) {
  const db = readDB();
  mutator(db);
  writeDB(db);
  return db;
}

export function delay(ms = 600) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateReference(prefix) {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

export function generateAccountNumber() {
  let num = "";
  for (let i = 0; i < 10; i++) num += Math.floor(Math.random() * 10);
  return num;
}
