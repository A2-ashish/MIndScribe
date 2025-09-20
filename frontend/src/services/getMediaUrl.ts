import { ensureUser } from '../auth';

export async function getMediaUrl(assetId: string): Promise<string> {
  const fnUrl = import.meta.env.VITE_FUNCTION_GET_MEDIA_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/getMediaUrl';
  const user = await ensureUser();
  const token = await user.getIdToken();
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ assetId })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`getMediaUrl failed (${res.status}) ${text}`);
  const json = JSON.parse(text);
  if (!json?.url) throw new Error('Invalid response');
  return json.url as string;
}
