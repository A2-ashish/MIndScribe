import { ensureUser } from '../auth';

export interface EntryBundleResult {
  entry?: any;
  insight?: any;
  capsule?: any;
  alerts?: any[];
  twin?: any;
}

export async function fetchEntryBundle(entryId: string): Promise<EntryBundleResult> {
  const fnUrl = import.meta.env.VITE_FUNCTION_FETCH_ENTRY_BUNDLE_URL;
  if (!fnUrl) throw new Error('Function URL (fetchEntryBundle) not configured');
  const user = await ensureUser();
  const token = await user.getIdToken();
  const url = `${fnUrl}?entryId=${encodeURIComponent(entryId)}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fetchEntryBundle failed (${res.status}) ${text}`);
  }
  return res.json();
}
