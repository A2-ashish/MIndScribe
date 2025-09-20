import { ensureUser } from '../auth';

export async function createDraftEntry(): Promise<{ entryId: string }> {
  const fnUrl = import.meta.env.VITE_FUNCTION_CREATE_DRAFT_ENTRY_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/createDraftEntry';
  const user = await ensureUser();
  const token = await user.getIdToken();
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`createDraftEntry failed (${res.status}) ${t}`);
  }
  const json = await res.json();
  if (!json?.entryId && !json?.ok) return json; // flexible
  return { entryId: json.entryId };
}
