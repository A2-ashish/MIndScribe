import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseCore';
import { ensureUser } from '../auth';
import { getMediaUrl } from '../services/getMediaUrl';

type MediaStatus = 'pending' | 'processing' | 'complete' | 'failed';

interface MediaAsset {
  assetId: string;
  userId: string;
  entryId: string;
  type: 'image' | 'audio' | 'unknown';
  mime: string;
  status: MediaStatus;
  sizeBytes?: number;
  error?: string;
  createdAt?: any;
  updatedAt?: any;
  labels?: string[];
  caption?: string;
  transcript?: string;
}

function statusColor(s: MediaStatus): string {
  switch (s) {
    case 'pending': return '#9e9e9e';
    case 'processing': return '#1976d2';
    case 'complete': return '#2e7d32';
    case 'failed': return '#c62828';
  }
}

function fmtBytes(n?: number) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}

export const MediaAssetsList: React.FC<{ entryId: string }> = ({ entryId }) => {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [urlErrors, setUrlErrors] = useState<Record<string, string | undefined>>({});
  const [audioDur, setAudioDur] = useState<Record<string, number>>({});
  const [lightbox, setLightbox] = useState<{ url: string; caption?: string } | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        // Ensure we have an authenticated user before subscribing
        const user = await ensureUser();
        if (cancelled) return;
        setReady(true);
        const q = query(
          collection(db, 'mediaAssets'),
          where('entryId', '==', entryId),
          // Include userId filter to satisfy Firestore security rules (isOwner)
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(25)
        );
        unsub = onSnapshot(q, (snap) => {
          const list: MediaAsset[] = [];
          snap.forEach(d => list.push(d.data() as MediaAsset));
          setItems(list);
          // Clear any previous transient permission errors once data arrives
          setError(null);
        }, (err) => {
          const msg = err?.message || String(err);
          // Friendlier messages for common Firestore errors
          if (/requires an index/i.test(msg) || /FAILED_PRECONDITION/i.test(msg)) {
            setError('Building index for media… showing unordered results meanwhile.');
            // Fallback: fetch unordered results while index builds
            import('firebase/firestore').then(async ({ getDocs }) => {
              try {
                const fallbackQ = query(
                  collection(db, 'mediaAssets'),
                  where('entryId', '==', entryId),
                  where('userId', '==', user.uid),
                  limit(25)
                );
                const snap = await getDocs(fallbackQ as any);
                const list: MediaAsset[] = [];
                snap.forEach(d => list.push(d.data() as MediaAsset));
                if (!cancelled) setItems(list);
              } catch (e) {
                console.warn('Fallback fetch failed', e);
              }
            });
          } else if (/Missing or insufficient permissions/i.test(msg) || /PERMISSION_DENIED/i.test(msg)) {
            setError('Missing permissions to load media. Make sure you are signed in and own this entry.');
          } else {
            setError(msg);
          }
        });
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, [entryId]);

  // Lazy-load signed URLs for completed assets
  useEffect(() => {
    let cancelled = false;
    (async () => {
  const targets = items.filter(i => (i.status === 'complete' || i.status === 'processing' || i.status === 'pending') && (i.type === 'image' || i.type === 'audio'));
      for (const m of targets) {
        if (urls[m.assetId]) continue; // already fetched
        try {
          setLoading(prev => ({ ...prev, [m.assetId]: true }));
          setUrlErrors(prev => ({ ...prev, [m.assetId]: undefined }));
          const url = await getMediaUrl(m.assetId);
          if (!cancelled) setUrls(prev => ({ ...prev, [m.assetId]: url }));
        } catch (e) {
          // ignore preview fetch errors; user can still see metadata
          const msg = (e as any)?.message || String(e);
          console.warn('Preview fetch failed', m.assetId, msg);
          if (!cancelled) setUrlErrors(prev => ({ ...prev, [m.assetId]: msg }));
        } finally {
          if (!cancelled) setLoading(prev => ({ ...prev, [m.assetId]: false }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [items, urls]);

  async function retryPreview(assetId: string) {
    try {
      setLoading(prev => ({ ...prev, [assetId]: true }));
      setUrlErrors(prev => ({ ...prev, [assetId]: undefined }));
      const url = await getMediaUrl(assetId);
      setUrls(prev => ({ ...prev, [assetId]: url }));
    } catch (e:any) {
      setUrlErrors(prev => ({ ...prev, [assetId]: e?.message || String(e) }));
    } finally {
      setLoading(prev => ({ ...prev, [assetId]: false }));
    }
  }

  function fmtSecs(sec?: number) {
    if (!sec && sec !== 0) return '';
    const s = Math.round(sec);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  }

  return (
    <>
    <section style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Media Assets</h3>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      {!error && items.length === 0 && <div style={{ opacity: 0.7 }}>No media uploaded yet.</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((m) => (
          <div key={m.assetId} style={rowStyle}>
            <span style={{...pillStyle, background: statusColor(m.status), color: 'white'}}>{m.status}</span>
            <span style={{ minWidth: 70 }}>{m.type}</span>
            <span title={m.mime} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.mime}</span>
            <span>{fmtBytes(m.sizeBytes)}</span>
            {/* Preview */}
            {(m.status === 'complete' || m.status === 'processing' || m.status === 'pending') && m.type === 'image' && (
              urls[m.assetId] ? (
                <img
                  src={urls[m.assetId]}
                  alt={m.caption || m.assetId}
                  style={{ maxHeight: 64, borderRadius: 4, cursor: 'zoom-in' }}
                  onClick={() => setLightbox(m.caption ? { url: urls[m.assetId]!, caption: m.caption } : { url: urls[m.assetId]! })}
                />
              ) : (
                <span style={{ opacity: 0.7 }}>
                  {urlErrors[m.assetId]
                    ? <button onClick={() => retryPreview(m.assetId)}>Retry preview</button>
                    : (loading[m.assetId] ? 'loading preview…' : '')}
                </span>
              )
            )}
            {(m.status === 'complete' || m.status === 'processing' || m.status === 'pending') && m.type === 'audio' && (
              urls[m.assetId] ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <audio
                    src={urls[m.assetId]}
                    controls
                    style={{ maxWidth: 260 }}
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget as HTMLAudioElement;
                      if (!Number.isNaN(el.duration)) setAudioDur(prev => ({ ...prev, [m.assetId]: el.duration }));
                    }}
                  />
                  {audioDur[m.assetId] !== undefined && (
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{fmtSecs(audioDur[m.assetId])}</span>
                  )}
                </span>
              ) : (
                <span style={{ opacity: 0.7 }}>
                  {urlErrors[m.assetId]
                    ? <button onClick={() => retryPreview(m.assetId)}>Retry audio</button>
                    : (loading[m.assetId] ? 'loading audio…' : '')}
                </span>
              )
            )}
            {m.caption && <span title={m.caption} style={{ flexBasis: '100%', opacity: 0.8 }}>caption: {m.caption}</span>}
            {m.labels && m.labels.length > 0 && (
              <span style={{ flexBasis: '100%', opacity: 0.8 }}>labels: {m.labels.slice(0,6).join(', ')}{m.labels.length>6?'…':''}</span>
            )}
            {m.transcript && <span title={m.transcript} style={{ flexBasis: '100%', opacity: 0.8 }}>transcript: {m.transcript.slice(0,120)}{m.transcript.length>120?'…':''}</span>}
            {m.error && <span style={{ flexBasis: '100%', color: '#c62828' }}>error: {m.error}</span>}
          </div>
        ))}
      </div>
    </section>
    {lightbox && (
      <div
        onClick={() => setLightbox(null)}
        style={{
          position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, cursor: 'zoom-out'
        }}
      >
        <div style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
          <img src={lightbox!.url} alt={String(lightbox?.caption || '')} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 6 }} />
          {lightbox?.caption && <div style={{ color: '#eee', textAlign: 'center', marginTop: 8, fontSize: 14 }}>{lightbox.caption}</div>}
        </div>
      </div>
    )}
    </>
  );
};

const cardStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem', background: '#fafafa' };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px dashed #eee', padding: '6px 0' };
const pillStyle: React.CSSProperties = { padding: '2px 8px', borderRadius: 999, fontSize: 12 };
