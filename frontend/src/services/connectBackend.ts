import { ensureUser } from '../auth';

async function call(url: string, method: 'GET' | 'POST' = 'POST') {
  const user = await ensureUser();
  const token = await user.getIdToken();
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend connect call failed (${res.status}) ${text}`);
  }
  return res.json().catch(() => ({}));
}

export async function connectBackend() {
  const url = import.meta.env.VITE_FUNCTION_CONNECT_URL || import.meta.env.VITE_FUNCTION_PING_URL;
  if (!url) return; // optional
  try {
    await call(url, 'POST');
  } catch (_e) {
    // best-effort; do not block UI
  }
}

export async function disconnectBackend() {
  const url = import.meta.env.VITE_FUNCTION_LOGOUT_URL;
  if (!url) return; // optional
  try {
    await call(url, 'POST');
  } catch (_e) {
    // ignore
  }
}
