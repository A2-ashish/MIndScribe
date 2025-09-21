import { useEffect, useState } from 'react';
import { ensureUser } from './auth';
import { auth } from './auth';
import { submitEntry } from './services/submitEntry';
import { createDraftEntry } from './services/createDraftEntry';
import { useEntryPipeline } from './hooks/useEntryPipeline';
import { AppPage } from './pages/AppPage';
import { UserPage } from './pages/UserPage';
import { Home } from './pages/Home';
import { Journal } from './pages/Journal';
import { Insights } from './pages/Insights';
import { Community } from './pages/Community';
import { Games } from './pages/Games';
import { BottomNav } from './components/BottomNav';
import { getUserCounts, type UserCounts } from './services/getUserCounts';
import { getUserStats, type UserStats } from './services/getUserStats';
import { Toaster } from './components/ui/toast';
import { Tooltip } from './components/ui/tooltip';

export default function App() {
  const [entryId, setEntryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { capsule, loading } = useEntryPipeline(entryId);
  const [uid, setUid] = useState<string | null>(null);
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
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'system');
  const [showTheme, setShowTheme] = useState(false);

  useEffect(() => {
    ensureUser().then(u => setUid(u.uid)).catch(console.error);
    const html = document.documentElement;
    if (theme === 'system') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    // Apply reduced motion selection
    localStorage.setItem('reduced-motion', reducedMotion ? 'true' : 'false');
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
  }, [reducedMotion, theme]);

  function setThemeValue(val: string) {
    setTheme(val);
  }

  function toggleReduceMotion() {
    setReducedMotion(v => !v);
  }

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

  return (
    <Toaster>
      <div className="bg-app">
        <div className="layout">
          {/* Floating theme control */}
          <div style={{position:'fixed', right:12, bottom:64, zIndex:100}}>
            <button className="secondary" onClick={() => setShowTheme(s => !s)} title="Theme & Accessibility">
              Theme & A11y
            </button>
          </div>
          {showTheme && (
            <div className="theme-popover" role="dialog" aria-label="Theme and accessibility settings">
              <h3>Appearance</h3>
              <div className="radio-group" role="radiogroup" aria-label="Theme selection">
                <label className="radio">
                  <input type="radio" name="theme" checked={theme === 'system'} onChange={() => setThemeValue('system')} />
                  System (auto)
                </label>
                <label className="radio">
                  <input type="radio" name="theme" checked={theme === 'light'} onChange={() => setThemeValue('light')} />
                  Light
                </label>
                <label className="radio">
                  <input type="radio" name="theme" checked={theme === 'dark'} onChange={() => setThemeValue('dark')} />
                  Dark
                </label>
                <label className="radio">
                  <input type="radio" name="theme" checked={theme === 'lavender'} onChange={() => setThemeValue('lavender')} />
                  Lavender
                </label>
              </div>
              <div className="settings-row">
                <div>Reduce motion</div>
                <label className="radio">
                  <input type="checkbox" checked={reducedMotion} onChange={toggleReduceMotion} />
                </label>
              </div>
              <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:10}}>
                <button className="secondary" onClick={() => setShowTheme(false)}>Close</button>
              </div>
            </div>
          )}

          {route === '#/' ? (
            <Home />
          ) : route === '#/journal' ? (
            <Journal />
          ) : route === '#/insights' ? (
            <Insights />
          ) : route === '#/community' ? (
            <Community />
          ) : route === '#/games' ? (
            <Games />
          ) : route === '#/user' ? (
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
          ) : null}
        </div>
        <BottomNav active={route} />
      </div>
    </Toaster>
  );
}