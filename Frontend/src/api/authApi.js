import { apiRequest, clearStoredSession, getStoredSession, persistSession } from "./client";

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id || user._id,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerUser(payload) {
  const result = await apiRequest({
    path: "/api/auth/register",
    method: "POST",
    body: {
      email: payload.email,
      password: payload.password,
    },
  });

  return { user: normalizeUser(result.user) };
}

export async function loginUser({ email, password }) {
  const result = await apiRequest({
    path: "/api/auth/login",
    method: "POST",
    body: { email, password },
  });

  const session = {
    token: result.token,
    refreshToken: result.refreshToken,
    user: normalizeUser(result.user),
    onboarding: { status: "PENDING" },
    account: null,
  };

  persistSession(session);
  return { user: session.user, onboarding: session.onboarding, account: session.account };
}

export async function logoutUser() {
  const session = getStoredSession();
  if (!session?.refreshToken) {
    clearStoredSession();
    return;
  }

  try {
    await apiRequest({
      path: "/api/auth/logout",
      method: "POST",
      body: { refreshToken: session.refreshToken },
    });
  } finally {
    clearStoredSession();
  }
}

export function getCurrentSession() {
  const session = getStoredSession();
  if (!session?.user) return null;
  return {
    user: session.user,
    onboarding: session.onboarding || { status: "PENDING" },
    account: session.account || null,
  };
}
