import { Suspense, lazy, useEffect, useState } from 'react';
import { ensureUser } from './auth';
import { auth } from './auth';
import { signOut } from 'firebase/auth';
import { submitEntry } from './services/submitEntry';
import { createDraftEntry } from './services/createDraftEntry';
import { useEntryPipeline } from './hooks/useEntryPipeline';
import { JournalInput } from './components/JournalInput';
import { CapsuleDisplay } from './components/CapsuleDisplay';
import { AppPage } from './pages/AppPage';
import { UserPage } from './pages/UserPage';
// Adjusted path to existing file at components/Alert/modal.tsx
import { AlertModal } from './components/Alert/modal';
import { AccountUpgrade } from './components/AccountUpgrade';
import { MediaUploadButton } from './components/MediaUploadButton';
import { MediaAssetsList } from './components/MediaAssetsList';
import { getClassifierStatus, type ClassifierStatusResponse } from './services/getClassifierStatus';
const EntryBundleViewer = lazy(() => import('./components/EntryBundleViewer').then(m => ({ default: m.EntryBundleViewer })));
import { fetchEntryBundle } from './services/fetchEntryBundle';
import { getLatestSwarmNarrative } from './services/getLatestSwarmNarrative';
import { getAnalyticsSummary, type AnalyticsRow } from './services/getAnalyticsSummary';
import { Sparkline } from './components/Sparkline';
import { getUserCounts, type UserCounts } from './services/getUserCounts';
import { getUserStats, type UserStats } from './services/getUserStats';
import { updateProfile } from 'firebase/auth';

export default function App() {
  const [entryId, setEntryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { capsule, alert, loading, insight } = useEntryPipeline(entryId);
  const [showAlert, setShowAlert] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [clfLoading, setClfLoading] = useState(false);
  const [clfStatus, setClfStatus] = useState<ClassifierStatusResponse | null>(null);
  const [clfError, setClfError] = useState<string | null>(null);
  const [bundleJson, setBundleJson] = useState<any | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [swarm, setSwarm] = useState<{ createdAt: string | null, narrative: string } | null>(null);
  const [swarmLoading, setSwarmLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsRow[] | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [days, setDays] = useState<number>(14);
  const [analyticsUpdatedAt, setAnalyticsUpdatedAt] = useState<string | null>(null);
  const [route, setRoute] = useState<string>(() => window.location.hash || '#/');
  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState<string>('');
  const [savingName, setSavingName] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    const fromLs = localStorage.getItem('reduced-motion');
    if (fromLs === 'true') return true;
    if (fromLs === 'false') return false;
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    ensureUser().then(u => setUid(u.uid)).catch(console.error);
    // Interactive background: track mouse position -> CSS vars
    const onMove = (e: MouseEvent) => {
      if (reducedMotion) return;
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      document.documentElement.style.setProperty('--mx', x.toFixed(2) + '%');
      document.documentElement.style.setProperty('--my', y.toFixed(2) + '%');
    };
    window.addEventListener('pointermove', onMove);
    const onHash = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('hashchange', onHash);
    };
  }, [reducedMotion]);

  // Auto-load analytics on mount and when day range changes (best-effort; ignore errors)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setAnalyticsLoading(true);
        const data = await getAnalyticsSummary(days);
        if (mounted) {
          setAnalytics(data?.rows ?? null);
          setAnalyticsUpdatedAt(new Date().toISOString());
        }
      } catch (_) {
        // no-op
      } finally {
        if (mounted) setAnalyticsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [days]);

  // Load counts when authenticated
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uid) return;
      try {
        setCountsLoading(true);
        const c = await getUserCounts(uid);
        if (mounted) setCounts(c);
      } catch {
        if (mounted) setCounts(null);
      } finally {
        if (mounted) setCountsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [uid]);

  // Load additional stats
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uid) return;
      try {
        setStatsLoading(true);
        const s = await getUserStats(uid);
        if (mounted) setStats(s);
      } catch {
        if (mounted) setStats(null);
      } finally {
        if (mounted) setStatsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [uid]);

  async function handleSubmit(text: string) {
    try {
      setSubmitting(true);
      // If user already has a draft entryId, submit against that
      const { entryId: submittedId, fallback } = await submitEntry(text, entryId || undefined);
      setEntryId(submittedId);
      if (fallback) {
        console.warn('Using fallback direct Firestore write (no server processing).');
      }
    } catch (e:any) {
      console.error(e);
      window.alert(e.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateDraft() {
    try {
      const { entryId } = await createDraftEntry();
      setEntryId(entryId);
    } catch (e:any) {
      console.error(e);
      window.alert(e.message || 'Failed to create draft');
    }
  }

  async function handleLoadClassifierStatus() {
    setClfError(null);
    setClfLoading(true);
    try {
      const data = await getClassifierStatus();
      setClfStatus(data);
    } catch (e: any) {
      setClfError(e.message || 'Failed to load classifier status');
    } finally {
      setClfLoading(false);
    }
  }

  return (
    <>
      <div className="nav">
        <div className="nav-inner">
          {!import.meta.env.PROD && <a href="#/">Home</a>}
          <a href="#/app">App</a>
          {!import.meta.env.PROD && <a href="#journal">Journal</a>}
          {!import.meta.env.PROD && <a href="#media">Media</a>}
          {!import.meta.env.PROD && <a href="#diagnostics">Diagnostics</a>}
          <a href="#community">Community</a>
          {!import.meta.env.PROD && <a href="#analytics">Analytics</a>}
          <a href="#/user">User</a>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
            <label htmlFor="reduced-motion-toggle" style={{ opacity: 0.85 }}>Reduce motion</label>
            <input
              id="reduced-motion-toggle"
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => {
                const v = e.currentTarget.checked;
                setReducedMotion(v);
                localStorage.setItem('reduced-motion', String(v));
                if (v) {
                  // center glow and reduce strength
                  document.documentElement.style.setProperty('--mx', '50%');
                  document.documentElement.style.setProperty('--my', '50%');
                }
              }}
              title="Toggle reduced motion"
            />
          </span>
        </div>
      </div>
      <div className="layout">
      {route === '#/user' ? (
        <UserPage
          uid={uid}
          counts={counts}
          stats={stats}
          countsLoading={countsLoading}
          statsLoading={statsLoading}
          displayNameDraft={displayNameDraft}
          setDisplayNameDraft={setDisplayNameDraft}
          savingName={savingName}
          onRefreshCounts={async () => {
            if (!auth.currentUser) return;
            setCountsLoading(true);
            try { setCounts(await getUserCounts(auth.currentUser.uid)); } finally { setCountsLoading(false); }
          }}
          onRefreshStats={async () => {
            if (!auth.currentUser) return;
            setStatsLoading(true);
            try { setStats(await getUserStats(auth.currentUser.uid)); } finally { setStatsLoading(false); }
          }}
          onAfterLogout={() => { setUid(null); setCounts(null); setStats(null); setEntryId(null); window.location.hash = '#/app'; }}
        />
      ) : route === '#/app' ? (
        <AppPage
          uid={uid}
          entryId={entryId}
          setEntryId={setEntryId}
          submitting={submitting}
          handleSubmit={handleSubmit}
          handleCreateDraft={handleCreateDraft}
          capsule={capsule}
          loading={loading}
        />
      ) : (
        <>
      <h1>MindScribe</h1>
      <p style={{opacity:0.8, fontSize:'0.9rem'}}>
        UID: {uid || '...'} {entryId && <>| Current Entry: {entryId}</>}
      </p>
      <div id="journal">
        <JournalInput onSubmit={handleSubmit} onCreateDraft={handleCreateDraft} hasDraft={!!entryId} disabled={submitting} />
      </div>
      {/* Only show media section when we have both an entry and a user session to avoid transient permission errors */}
      <div id="media">
      {entryId && uid ? (
        <div className="panel">
          <div className="section-header" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Media for this entry</h3>
            <div className="toolbar">
              <MediaUploadButton entryId={entryId} />
            </div>
          </div>
          <MediaAssetsList entryId={entryId} />
        </div>
      ) : (
        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Submit a journal entry to enable media upload.</p>
      )}
      </div>
      {/* Show enforcement mode when available for quick validation */}
      <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
        Insight enforcement: <b>{(insight as any)?.enforcement ?? 'n/a'}</b>
        {entryId && (
          <>
            {' '}|{' '}
            <button
              onClick={async () => {
                if (!entryId) return;
                setBundleError(null);
                setBundleLoading(true);
                try {
                  const b = await fetchEntryBundle(entryId);
                  setBundleJson(b);
                } catch (e: any) {
                  setBundleError(e.message || 'Failed to fetch bundle');
                } finally {
                  setBundleLoading(false);
                }
              }}
              disabled={bundleLoading}
              style={{ marginLeft: 8 }}
            >
              {bundleLoading ? 'Loading bundle…' : 'View current bundle'}
            </button>
          </>
        )}
      </p>
      {bundleError && <p style={{ color: 'crimson' }}>{bundleError}</p>}
      {bundleJson && (
        <details style={{ margin: '4px 0' }}>
          <summary>Current bundle JSON</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(bundleJson, null, 2)}</pre>
        </details>
      )}
      <CapsuleDisplay capsule={capsule} loading={loading}/>
      <AccountUpgrade/>
      {alert && showAlert && <AlertModal alert={alert} onClose={() => setShowAlert(false)} />}

      {/* Diagnostics: Classifier flags + recent decisions */}
  <div id="diagnostics" className="panel" style={{ marginTop: 16 }}>
        <div className="section-header" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Classifier diagnostics</h3>
          <div className="toolbar">
            <button onClick={handleLoadClassifierStatus} disabled={clfLoading}>
              {clfLoading ? 'Loading…' : 'Load status'}
            </button>
            <button onClick={async () => {
              try {
                setSubmitting(true);
                // Force a new entry for diagnostics to avoid reusing an existing processed entryId
                const r = await submitEntry(`Diagnostics test ${new Date().toISOString()}`);
                setEntryId(r.entryId);
              } catch (e:any) {
                console.error(e);
                window.alert(e.message || 'Submit failed');
              } finally {
                setSubmitting(false);
              }
            }} disabled={submitting} style={{ marginLeft: 8 }}>
              {submitting ? 'Submitting…' : 'Submit test entry'}
            </button>
          </div>
        </div>
        {clfError && <p style={{ color: 'crimson' }}>{clfError}</p>}
        {clfStatus && (
          <div style={{ fontSize: '0.9rem' }}>
            <p style={{ margin: '4px 0' }}>
              Path: <b>{clfStatus.flags.CLASSIFIER_PATH}</b> | Enforce: <b>{clfStatus.flags.CLASSIFIER_ENFORCE}</b> | Model: <b>{clfStatus.flags.CLASSIFIER_MODEL_VERSION}</b>
            </p>
            {Array.isArray(clfStatus.recent) && clfStatus.recent.length > 0 ? (
              <details>
                <summary>Recent decisions ({clfStatus.recent.length})</summary>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(clfStatus.recent.slice(0,5), null, 2)}</pre>
              </details>
            ) : (
              <p style={{ opacity: 0.8 }}>No recent decisions.</p>
            )}
          </div>
        )}
      </div>

      {/* Swarm Narrative (public) */}
  <div id="community" className="panel" style={{ marginTop: 16 }}>
        <div className="section-header" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Community narrative</h3>
          <div className="toolbar">
            <button
              onClick={async () => {
                setSwarmLoading(true);
                try {
                  const latest = await getLatestSwarmNarrative();
                  if (latest) setSwarm({ createdAt: latest.createdAt, narrative: latest.narrative });
                } finally {
                  setSwarmLoading(false);
                }
              }}
              disabled={swarmLoading}
            >
              {swarmLoading ? 'Loading…' : 'Load narrative'}
            </button>
          </div>
        </div>
        {swarm ? (
          <div style={{ fontSize: '0.95rem', lineHeight: 1.4 }}>
            <p style={{ margin: '4px 0', opacity: 0.8 }}>Updated: {swarm.createdAt || 'n/a'}</p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{swarm.narrative || 'No narrative yet.'}</p>
          </div>
        ) : (
          <p style={{ opacity: 0.8 }}>Load the latest community narrative.</p>
        )}
      </div>

      {/* Tiny Analytics (public) */}
      <div id="analytics" className="panel" style={{ marginTop: 16 }}>
        <div className="section-header" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Analytics (last 14 days)</h3>
          <div className="toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'inline-flex', border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden' }}>
              {[7,14,30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  disabled={analyticsLoading}
                  style={{
                    padding: '4px 8px',
                    border: 'none',
                    background: days === d ? '#eef5ff' : '#fff',
                    color: '#222',
                    cursor: 'pointer'
                  }}
                  title={`Show last ${d} days`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                setAnalyticsLoading(true);
                try {
                  const data = await getAnalyticsSummary(days);
                  setAnalytics(data?.rows ?? null);
                  setAnalyticsUpdatedAt(new Date().toISOString());
                } finally {
                  setAnalyticsLoading(false);
                }
              }}
              disabled={analyticsLoading}
            >
              {analyticsLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: '0.85rem', opacity: 0.75, marginBottom: 6 }}>
          Last updated: {analyticsUpdatedAt ? new Date(analyticsUpdatedAt).toLocaleString() : 'n/a'}
        </div>
        {analytics ? (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 4 }}>Insights/day</div>
                <Sparkline
                  values={analytics.map(r => r.insights_count)}
                  width={260}
                  height={42}
                  stroke="#4a90e2"
                  fill="#4a90e2"
                  ariaLabel="Insights per day"
                />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 4 }}>Avg sentiment</div>
                <Sparkline
                  values={analytics.map(r => r.avg_sentiment)}
                  width={260}
                  height={42}
                  stroke="#27ae60"
                  fill="#27ae60"
                  min={-1}
                  max={1}
                  ariaLabel="Average sentiment"
                />
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Day</th>
                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Insights</th>
                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Avg sentiment</th>
                  <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: '4px 6px' }}>Capsules</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map((r) => (
                  <tr key={r.day}>
                    <td style={{ padding: '4px 6px' }}>{r.day}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{r.insights_count}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{r.avg_sentiment === null ? '—' : r.avg_sentiment.toFixed(3)}</td>
                    <td style={{ padding: '4px 6px', textAlign: 'right' }}>{r.capsules_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ opacity: 0.8 }}>Load analytics to view daily counts and average sentiment.</p>
        )}
      </div>

      {/* Optional: Bundle viewer for deep inspection */}
      <details style={{ marginTop: 12 }}>
        <summary>Open Entry Bundle Viewer</summary>
        <Suspense fallback={<div style={{ padding: 8, opacity: 0.8 }}>Loading bundle viewer…</div>}>
          <EntryBundleViewer />
        </Suspense>
      </details>
        </>
      )}
      </div>
    </>
  );
}