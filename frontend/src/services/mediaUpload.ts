import { ensureUser } from '../auth';

export interface UploadGrant {
  assetId: string;
  uploadUrl: string;
  storagePath: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}

export async function requestUpload(entryId: string, type: 'image' | 'audio', mime: string, sizeBytes?: number): Promise<UploadGrant> {
  const fnUrl = import.meta.env.VITE_FUNCTION_REQUEST_MEDIA_UPLOAD_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/requestMediaUpload';
  const user = await ensureUser();
  const token = await user.getIdToken();
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ entryId, type, mime, sizeBytes })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`requestMediaUpload failed (${res.status}) ${text}`);
  }
  const json = await res.json();
  if (!json?.grant?.uploadUrl) throw new Error('Invalid grant response');
  return json.grant as UploadGrant;
}

export async function putToSignedUrl(
  uploadUrl: string,
  headers: Record<string, string>,
  blob: Blob,
  onProgress?: (pct: number) => void
): Promise<void> {
  // Use XHR to get upload progress events
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    // Set headers (Content-Type + x-goog-meta-*)
    Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        onProgress(pct);
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
    };
    xhr.send(blob);
  });
}
