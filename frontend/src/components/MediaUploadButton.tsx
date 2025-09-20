import React, { useState } from 'react';
import { requestUpload, putToSignedUrl } from '../services/mediaUpload';

interface Props {
  entryId: string;
}

export function MediaUploadButton({ entryId }: Props) {
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('');
    setProgress(0);
    setBusy(true);
    try {
      const type = file.type.startsWith('audio/') ? 'audio' : 'image';
      const grant = await requestUpload(entryId, type as 'image' | 'audio', file.type, file.size);
      await putToSignedUrl(grant.uploadUrl, grant.headers, file, setProgress);
      setStatus('Upload complete');
    } catch (err: any) {
      setStatus(err?.message || String(err));
    } finally {
      setBusy(false);
      // reset input so picking same file again still triggers change
      e.target.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ cursor: busy ? 'not-allowed' : 'pointer' }}>
        <input type="file" accept="image/png,image/jpeg,audio/*" onChange={onPickFile} disabled={busy} style={{ display: 'none' }} />
        <span style={{ padding: '6px 12px', background: '#1976d2', color: 'white', borderRadius: 4 }}>
          {busy ? 'Uploading…' : 'Attach media'}
        </span>
      </label>
      {busy || progress > 0 ? <span>{progress}%</span> : null}
      {status ? <span style={{ marginLeft: 8, color: status === 'Upload complete' ? 'green' : 'crimson' }}>{status}</span> : null}
    </div>
  );
}
