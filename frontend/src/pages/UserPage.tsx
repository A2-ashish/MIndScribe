import React from 'react';
import { auth } from '../auth';
import { updateProfile, signOut } from 'firebase/auth';
import type { UserCounts } from '../services/getUserCounts';
import type { UserStats } from '../services/getUserStats';

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
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <h1 className="m-0">User</h1>
        <div>
          <button
            className="secondary"
            onClick={async () => {
              try { await signOut(auth); onAfterLogout(); } catch (e:any) { window.alert(e?.message || 'Failed to sign out'); }
            }}
          >Logout</button>
        </div>
      </div>
      <p className="text-muted">UID: {uid || '...'}</p>

      <div className="panel">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Profile</h3>
          <div className="toolbar">
            <button className="secondary" onClick={onRefreshCounts} disabled={countsLoading || !uid}>{countsLoading ? 'Loading…' : 'Refresh counts'}</button>
            <button className="secondary" onClick={onRefreshStats} disabled={statsLoading || !uid}>{statsLoading ? 'Loading…' : 'Refresh stats'}</button>
          </div>
        </div>
        <div style={{ fontSize: '0.95rem', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>User:</span>
            <b>{auth.currentUser?.displayName || '(anonymous user)'}</b>
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
          <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
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
          <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
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
