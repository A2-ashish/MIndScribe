import React from 'react';

type Item = { key: string; href: string; label: string; icon: React.ReactNode };

const items: Item[] = [
  { key: '#/', href: '#/', label: 'Home', icon: <span aria-hidden>🏠</span> },
  { key: '#/journal', href: '#/journal', label: 'Journal', icon: <span aria-hidden>📖</span> },
  { key: '#/insights', href: '#/insights', label: 'Insights', icon: <span aria-hidden>📊</span> },
  { key: '#/games', href: '#/games', label: 'Games', icon: <span aria-hidden>🎮</span> },
  { key: '#/community', href: '#/community', label: 'Community', icon: <span aria-hidden>👥</span> },
  { key: '#/user', href: '#/user', label: 'Account', icon: <span aria-hidden>🙍</span> },
];

export function BottomNav({ active }: { active: string }) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Primary">
      <div className="bottom-nav-inner">
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <a key={it.key} href={it.href} className={isActive ? 'bn-item active' : 'bn-item'}>
              <span className="bn-icon" aria-hidden>{it.icon}</span>
              <span className="bn-label">{it.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
