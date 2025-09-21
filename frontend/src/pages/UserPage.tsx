import React from 'react';
import { auth } from '../auth';
import { disconnectBackend } from '../services/connectBackend';
import { LoginPanel } from '../components/LoginPanel';
import { updateProfile, signOut } from 'firebase/auth';
import type { UserCounts } from '../services/getUserCounts';
import type { UserStats } from '../services/getUserStats';
import { useAuthUser } from '../hooks/useAuthUser';

type Props = {
  uid: string | null;
  counts: UserCounts | null;
  stats: UserStats | null;
  countsLoading: boolean;
  statsLoading: boolean;
  displayNameDraft: string;
  setDisplayNameDraft: (v: string) => void;
  savingName: boolean;
  onRefreshCounts: () => void | Promise<void>;
  onRefreshStats: () => void | Promise<void>;
  onAfterLogout: () => void;
};

export const UserPage: React.FC<Props> = ({ uid, counts, stats, countsLoading, statsLoading, displayNameDraft, setDisplayNameDraft, savingName, onRefreshCounts, onRefreshStats, onAfterLogout }) => {
  const currentUser = useAuthUser();
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <h1 className="m-0">User</h1>
      </div>
      <p className="text-muted">UID: {uid || '...'}</p>

      {/* Anonymous banner to direct users to the save progress action */}
      {(!currentUser || currentUser.isAnonymous) && (
        <div className="panel" style={{ background: 'var(--color-secondary-bg, #f6f3ff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600 }}>You’re playing as a guest</div>
              <div style={{ opacity: 0.85 }}>Link your email to save progress across devices.</div>
            </div>
            <button
              className="secondary"
              onClick={() => {
                const el = document.getElementById('save-progress');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >Save your progress</button>
          </div>
        </div>
      )}

      {/* Login panel for anonymous users */}
      {(!currentUser || currentUser.isAnonymous) && (
        <LoginPanel />
      )}

      {/* Account panel (moved to top) */}
      {currentUser && !currentUser.isAnonymous && (
      <div className="panel">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Account</h3>
          <div className="toolbar">
            <button
              className="secondary"
              onClick={async () => {
                try { await signOut(auth); await disconnectBackend(); onAfterLogout(); } catch (e:any) { window.alert(e?.message || 'Failed to sign out'); }
              }}
            >Logout</button>
          </div>
        </div>
        <div style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Display name:</span>
            <b>{currentUser?.displayName || '(anonymous user)'}</b>
            <input
              type="text"
              placeholder="Edit display name"
              value={displayNameDraft}
              onChange={(e) => setDisplayNameDraft(e.target.value)}
              style={{ width: 220 }}
            />
            <button
              onClick={async () => {
                if (!auth.currentUser) return;
                const name = displayNameDraft.trim();
                if (!name) return;
                try { await updateProfile(auth.currentUser, { displayName: name }); setDisplayNameDraft(''); }
                catch (e:any) { window.alert(e?.message || 'Failed to update display name'); }
              }}
              disabled={savingName || !displayNameDraft.trim()}
            >
              {savingName ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div>UID: <code style={{ opacity: 0.9 }}>{uid || '...'}</code></div>
        </div>
      </div>
      )}

      {/* Activity panel (counts and stats) */}
      <div className="panel">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Your activity</h3>
          <div className="toolbar">
            <button className="secondary" onClick={onRefreshCounts} disabled={countsLoading || !uid}>{countsLoading ? 'Loading…' : 'Refresh counts'}</button>
            <button className="secondary" onClick={onRefreshStats} disabled={statsLoading || !uid}>{statsLoading ? 'Loading…' : 'Refresh stats'}</button>
          </div>
        </div>
        <div style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>Entries</div>
              <div style={{ fontSize: '1.2rem' }}>{counts?.entries ?? '—'}</div>
            </div>
            <div>
              <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>Insights</div>
              <div style={{ fontSize: '1.2rem' }}>{counts?.insights ?? '—'}</div>
            </div>
            <div>
              <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>Capsules</div>
              <div style={{ fontSize: '1.2rem' }}>{counts?.capsules ?? '—'}</div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>Last entry</div>
              <div style={{ fontSize: '1rem' }}>{stats?.lastEntryAt ? new Date(stats.lastEntryAt).toLocaleString() : '—'}</div>
            </div>
            <div>
              <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>Media items</div>
              <div style={{ fontSize: '1rem' }}>{stats?.mediaCount ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
