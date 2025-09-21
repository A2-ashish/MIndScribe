import { useEffect, useState } from 'react';
import { getUserCounts, type UserCounts } from '../services/getUserCounts';
import { getUserStats, type UserStats } from '../services/getUserStats';
import { ensureUser } from '../auth';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';

export function Home() {
  const [uid, setUid] = useState<string | null>(null);
  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const u = await ensureUser();
      if (!mounted) return;
      setUid(u.uid);
      try { setCounts(await getUserCounts(u.uid)); } catch { /* ignore */ }
      try { setStats(await getUserStats(u.uid)); } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, []);

  const quickActions = [
    { label: 'Quick Journal', path: '#/journal', description: 'Express your thoughts' },
    { label: 'Play Game', path: '#/games', description: 'Boost your mood' },
    { label: 'View Insights', path: '#/insights', description: 'Track your progress' }
  ];

  return (
    <div className="min-h-screen pb-20 px-4 pt-8" style={{
      background: 'linear-gradient(180deg,#ffffff,#f6f7fb)',
      backgroundImage: 'radial-gradient(1200px 600px at 50% -10%, rgba(139,92,246,0.15), transparent 60%), radial-gradient(800px 400px at 80% 0%, rgba(52,211,153,0.12), transparent 55%), radial-gradient(900px 500px at 10% 0%, rgba(147,197,253,0.12), transparent 55%)'
    }}>
      {/* Optional: hero image background. Place a file named mind-hero.jpg in /public to enable. */}
      <div className="max-w-5xl mx-auto" style={{ paddingTop: 4, marginBottom: 16 }}>
        <div style={{
          position: 'relative',
          height: 220,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-2)'
        }}>
          {/* Image layer (served from /public/mind-hero.jpg when present) */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: "url('/mind-hero.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'saturate(1.02)'
          }}/>
          {/* Soft overlay for readability */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.95))' }} />
        </div>
      </div>
      <Card className="p-6 text-center wellness-card" /* simple card look */>
        <div style={{ fontSize: 42 }}>☁️</div>
        <h1 style={{ marginBottom: 4 }}>Welcome to MindScribe</h1>
        <p style={{ opacity: 0.8 }}>Your private space to grow stronger, every day.</p>
      </Card>

      <Card className="p-6 wellness-card">
        <div className="section-header" style={{ marginBottom: 10 }}>
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Wellness</h3>
          <div style={{ opacity: 0.75, fontSize: '0.9rem' }}>UID: {uid || '…'}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Card className="p-4" style={{ margin: 0 }}>
            <div style={{ opacity: 0.8, fontSize: '0.85rem' }}>Wellness Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Progress
                value={78}
                trackColor="#eef2ff"
                filledColor="#8b5cf6"
                remainderColor="#a7f3d0"
                remainderStyle="cap"
                capRatio={0.3}
                capMin={6}
                capMax={18}
              />
              <b>78%</b>
            </div>
          </Card>
          <Card className="p-4 text-center" style={{ margin: 0 }}>
            <div style={{ opacity: 0.8, fontSize: '0.85rem' }}>Day Streak</div>
            <div style={{ fontSize: '1.4rem' }}>{counts?.entries ?? 7}</div>
          </Card>
          <Card className="p-4 text-center" style={{ margin: 0 }}>
            <div style={{ opacity: 0.8, fontSize: '0.85rem' }}>Insights</div>
            <div style={{ fontSize: '1.4rem' }}>{counts?.insights ?? 5}</div>
          </Card>
        </div>
        <h3 style={{ marginTop: 8 }}>Quick Actions</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {quickActions.map(a => (
            <a key={a.path} href={a.path} className="secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, textDecoration: 'none' }}>
              <span>{a.label}</span>
              <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>{a.description}</span>
            </a>
          ))}
        </div>
      </Card>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Daily Inspiration</h3>
        <p style={{ fontStyle: 'italic', opacity: 0.9 }}>
          "Every step forward, no matter how small, is progress worth celebrating."
        </p>
      </div>
    </div>
  );
}
