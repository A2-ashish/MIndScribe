import React, { useEffect, useState } from 'react';

type Item = { key: string; href: string; label: string; icon: React.ReactNode };

const items: Item[] = [
  { key: '#/', href: '#/', label: 'Home', icon: <span aria-hidden>🏠</span> },
  { key: '#/journal', href: '#/journal', label: 'Journal', icon: <span aria-hidden>📖</span> },
  { key: '#/insights', href: '#/insights', label: 'Insights', icon: <span aria-hidden>📊</span> },
  { key: '#/games', href: '#/games', label: 'Games', icon: <span aria-hidden>🎮</span> },
  { key: '#/community', href: '#/community', label: 'Community', icon: <span aria-hidden>👥</span> },
  { key: '#/user', href: '#/user', label: 'Account', icon: <span aria-hidden>🙍</span> },
];

type Pill = { word?: string; safety?: 'ok'|'caution'|'high-risk'; route?: string } | null;

export function BottomNav({ active }: { active: string }) {
  const [pill, setPill] = useState<Pill>(null);

  useEffect(() => {
    let hideTimer: any;
    const onEvt = (e: any) => {
      const detail = e?.detail || {};
      setPill({ word: detail.word, safety: detail.safety, route: detail.route });
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setPill(null), 1000 * 20); // show for 20s
    };
    window.addEventListener('ms:guidance-pill' as any, onEvt);
    return () => { window.removeEventListener('ms:guidance-pill' as any, onEvt); if (hideTimer) clearTimeout(hideTimer); };
  }, []);

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Primary">
      <div className="bottom-nav-inner">
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <a key={it.key} href={it.href} className={isActive ? 'bn-item active' : 'bn-item'}>
              <span className="bn-icon" aria-hidden>{it.icon}</span>
              <span className="bn-label">{it.label}</span>
              {/* Minimal guidance pill anchored near Games icon */}
              {it.key === '#/games' && pill && (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    const r = pill.route || '#/insights';
                    if (r.startsWith('#')) { window.location.hash = r.slice(1); } else { window.location.href = r; }
                  }}
                  title="View AI guidance"
                  style={{
                    position: 'absolute',
                    transform: 'translateY(-28px)',
                    background: pill.safety === 'high-risk' ? '#fff1f2' : pill.safety === 'caution' ? '#fffbeb' : '#eef2ff',
                    color: pill.safety === 'high-risk' ? '#b91c1c' : pill.safety === 'caution' ? '#92400e' : '#3730a3',
                    border: '1px solid ' + (pill.safety === 'high-risk' ? '#fecaca' : pill.safety === 'caution' ? '#fcd34d' : '#c7d2fe'),
                    padding: '4px 8px', borderRadius: 9999, fontSize: '0.75rem', cursor: 'pointer'
                  }}
                >
                  {pill.word ? `View: ${pill.word}` : 'View guidance'}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
