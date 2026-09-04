const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const SESSION_KEY = 'nexora_session';

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function persistSession(nextSession) {
  const current = getStoredSession() || {};
  const merged = { ...current, ...nextSession };
  localStorage.setItem(SESSION_KEY, JSON.stringify(merged));
  return merged;
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getStoredAccessToken() {
  return getStoredSession()?.token || null;
}

export async function apiRequest({
  path,
  method = 'GET',
  body,
  query = {},
  headers = {},
  auth = true,
}) {
  const target = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    target.searchParams.set(key, String(value));
  });

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  const token = getStoredAccessToken();
  if (auth && token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(target, {
    method,
    headers: requestHeaders,
    body: body === undefined || body === null ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload && payload.success === false) {
    const error = new Error(payload.message || 'Request failed');
    error.payload = payload;
    throw error;
  }

  return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : (payload?.data || payload);
}
