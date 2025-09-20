import React, { useEffect, useState } from 'react';
import { fetchEntryBundle } from '../services/fetchEntryBundle';
import { ensureUser } from '../auth';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseCore';
import { MediaUploadButton } from './MediaUploadButton';

interface EntryMeta { entryId: string; text: string; createdAt?: any; processed?: boolean; }

export const EntryBundleViewer: React.FC = () => {
  const [entries, setEntries] = useState<EntryMeta[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [bundle, setBundle] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await ensureUser();
        const q = query(
          collection(db, 'entries'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(15)
        );
        const snap = await getDocs(q);
        const list: EntryMeta[] = [];
        snap.forEach(d => list.push(d.data() as EntryMeta));
        setEntries(list);
  if (list.length && !selected && list[0]?.entryId) setSelected(list[0].entryId);
      } catch (e: any) { setError(e.message || String(e)); }
    })();
  }, []);

  const doFetch = async () => {
    if (!selected) return;
    setLoading(true); setError(null);
    try {
      const b = await fetchEntryBundle(selected);
      setBundle(b);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  };

  useEffect(() => { if (selected) { void doFetch(); } }, [selected]);

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui', maxWidth: 900, margin: '0 auto' }}>
      <h2>Entry Bundle Viewer</h2>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={selected} onChange={e => setSelected(e.target.value)}>
          {entries.map(e => (
            <option key={e.entryId} value={e.entryId}>
              {e.entryId.slice(0,8)} — {e.text.slice(0,40)}{e.text.length>40?'…':''}
            </option>
          ))}
        </select>
        <button onClick={doFetch} disabled={loading || !selected}>Refresh</button>
        {loading && <span>Loading…</span>}
        {!!selected && <MediaUploadButton entryId={selected} />}
      </div>
      {error && <div style={{ color: 'red', marginTop: '0.5rem' }}>{error}</div>}
      {bundle && (
        <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
          <section style={cardStyle}> <h3>Entry</h3><pre style={preStyle}>{JSON.stringify(bundle.entry, null, 2)}</pre></section>
          <section style={cardStyle}> <h3>Insight</h3><pre style={preStyle}>{JSON.stringify(bundle.insight, null, 2)}</pre></section>
          <section style={cardStyle}> <h3>Capsule</h3><pre style={preStyle}>{JSON.stringify(bundle.capsule, null, 2)}</pre></section>
          <section style={cardStyle}> <h3>Alerts</h3><pre style={preStyle}>{JSON.stringify(bundle.alerts, null, 2)}</pre></section>
          <section style={cardStyle}> <h3>Twin</h3><pre style={preStyle}>{JSON.stringify(bundle.twin, null, 2)}</pre></section>
        </div>
      )}
    </div>
  );
};

const cardStyle: React.CSSProperties = { border: '1px solid #ddd', borderRadius: 8, padding: '0.75rem', background: '#fafafa' };
const preStyle: React.CSSProperties = { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 };
