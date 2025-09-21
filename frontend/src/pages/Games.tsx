import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/toast';

export function Games() {
  return (
    <div className="games-page">
      <div className="games-section">
        <MemoryGameCard />
        <BreathingCard />

        <Card className="games-card" style={{ marginTop: 16 }}>
          <div className="games-coming">
            <div className="games-coming-icon" aria-hidden>✨</div>
            <h3>More Games Coming Soon!</h3>
            <p>We're developing more interactive games to support your mental wellness journey.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function MemoryGameCard() {
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<'idle' | 'showing' | 'input' | 'win' | 'fail'>('idle');
  const colors = [
    { key: 'green', label: 'Green', bg: '#c8f1d6', active: '#86efac' },
    { key: 'coral', label: 'Coral', bg: '#ffd5cc', active: '#fecaca' },
    { key: 'purple', label: 'Purple', bg: '#e2d9ff', active: '#ddd6fe' },
    { key: 'orange', label: 'Orange', bg: '#fde6c9', active: '#fed7aa' },
  ] as const;

  const seqRef = useRef<number[]>([]);
  const inputRef = useRef<number[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const playingRef = useRef<boolean>(false);

  const start = async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    setStatus('showing');
    // generate next sequence item
    seqRef.current.push(Math.floor(Math.random() * colors.length));
    inputRef.current = [];
    await playSequence(seqRef.current);
    setStatus('input');
    playingRef.current = false;
  };

  const playSequence = (seq: number[]) => new Promise<void>((resolve) => {
    let i = 0;
    const flash = () => {
      if (i >= seq.length) {
        setActiveIdx(null);
        resolve();
        return;
      }
      const idx = seq[i] ?? 0;
      setActiveIdx(idx);
      setTimeout(() => {
        setActiveIdx(null);
        i++;
        setTimeout(flash, 250);
      }, 550);
    };
    flash();
  });

  const press = async (idx: number) => {
    if (status !== 'input') return;
    inputRef.current.push(idx);
    setActiveIdx(idx);
    setTimeout(() => setActiveIdx(null), 150);
    const pos = inputRef.current.length - 1;
    const correct = seqRef.current[pos] === idx;
    if (!correct) {
      setStatus('fail');
      // reset for retry
      seqRef.current = [];
      setLevel(1);
      setTimeout(() => setStatus('idle'), 1000);
      return;
    }
    // finished current level
    if (inputRef.current.length === seqRef.current.length) {
      setStatus('win');
      setLevel((l) => l + 1);
      setTimeout(() => setStatus('idle'), 800);
    }
  };

  return (
    <Card className="games-card">
      <div className="games-card-header">
        <div className="games-card-icon" aria-hidden>🧠</div>
        <div>
          <h2 className="games-card-title">Memory Challenge</h2>
          <p className="games-card-subtitle">Watch the sequence and repeat it back</p>
        </div>
      </div>

      <div className="memory-level">
        <div className="memory-level-title">Level {level}</div>
        <div className="memory-level-sub">
          {status === 'idle' && 'Ready to start?'}
          {status === 'showing' && 'Memorize the sequence…'}
          {status === 'input' && 'Now tap the tiles in order'}
          {status === 'win' && 'Great! Next level ready.'}
          {status === 'fail' && 'Oops! Try again.'}
        </div>
      </div>

      <div className="memory-grid">
        {colors.map((c, idx) => (
          <button
            key={c.key}
            className="memory-tile"
            onClick={() => press(idx)}
            style={{
              background: activeIdx === idx ? c.active : c.bg,
            }}
          >
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="memory-cta">
        <Button variant="success" onClick={start} disabled={status === 'showing'}>
          ▶ Start Game
        </Button>
      </div>
    </Card>
  );
}

function BreathingCard() {
  type Phase = 'inhale' | 'hold' | 'exhale';
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<Phase>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);
  const timerRef = useRef<number | null>(null);

  const cycle = useMemo(() => ({ inhale: 4, hold: 4, exhale: 6 }), []); // 4-4-6

  useEffect(() => {
    if (!running) {
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    setPhase('inhale');
    setSecondsLeft(cycle.inhale);
    const tick = () => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // advance phase
        setPhase((p) => {
          if (p === 'inhale') { setSecondsLeft(cycle.hold); return 'hold'; }
          if (p === 'hold') { setSecondsLeft(cycle.exhale); return 'exhale'; }
          setSecondsLeft(cycle.inhale); return 'inhale';
        });
        return 0; // will be immediately replaced next render
      });
    };
    timerRef.current = window.setInterval(tick, 1000);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [running, cycle]);

  const phaseColor = phase === 'inhale' ? '#8b5cf6' : phase === 'hold' ? '#a78bfa' : '#34d399';
  const label = phase === 'inhale' ? 'Inhale' : phase === 'hold' ? 'Hold' : 'Exhale';

  return (
    <Card className="p-6 wellness-card">
      <div className="section-header" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Mindful Breathing</h3>
        <div style={{ opacity: 0.8 }}>4–4–6 pattern</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            aria-label="breathing-visual"
            style={{
              width: 64, height: 64, borderRadius: 9999,
              background: phaseColor,
              transform: `scale(${phase === 'inhale' ? 1.1 : phase === 'hold' ? 1.0 : 0.9})`,
              transition: 'transform 800ms ease, background 200ms ease'
            }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{label}</div>
            <div style={{ opacity: 0.8, fontVariantNumeric: 'tabular-nums' }}>{secondsLeft}s</div>
          </div>
        </div>
        <Button variant={running ? 'secondary' : 'primary'} onClick={() => setRunning(v => !v)}>
          {running ? 'Stop' : 'Start'}
        </Button>
      </div>
    </Card>
  );
}

function ReactionCard() {
  type Phase = 'idle' | 'waiting' | 'ready' | 'result' | 'toosoon';
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const startRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); }, []);

  const start = () => {
    setResult(null);
    setPhase('waiting');
    const delay = 1000 + Math.random() * 2000;
    timeoutRef.current = window.setTimeout(() => {
      setPhase('ready');
      startRef.current = performance.now();
      timeoutRef.current = null;
    }, delay);
  };

  const click = () => {
    if (phase === 'waiting') {
      if (timeoutRef.current) { window.clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      setPhase('toosoon');
      return;
    }
    if (phase === 'ready') {
      const ms = Math.round(performance.now() - startRef.current);
      setResult(ms);
      setBest((b) => (b == null ? ms : Math.min(b, ms)));
      setPhase('result');
      return;
    }
  };

  return (
    <Card className="p-6 wellness-card">
      <div className="section-header" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Reaction Time</h3>
        <div style={{ opacity: 0.8 }}>Tap as soon as the card turns green</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
        <div
          onClick={click}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') click(); }}
          style={{
            userSelect: 'none', cursor: 'pointer',
            padding: 16, borderRadius: 12,
            background: phase === 'ready' ? '#d1fae5' : phase === 'waiting' ? '#fee2e2' : '#f3f4f6',
            border: '1px solid var(--color-outline)'
          }}
        >
          {phase === 'idle' && <div>Press Start, then click when it turns green</div>}
          {phase === 'waiting' && <div>Wait for green…</div>}
          {phase === 'ready' && <div>Tap!</div>}
          {phase === 'result' && <div>Reaction: <b>{result} ms</b>{best != null && <> • Best: <b>{best} ms</b></>}</div>}
          {phase === 'toosoon' && <div>Too soon! Press Start to try again.</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => { setPhase('idle'); setResult(null); }}>Reset</Button>
          <Button onClick={start}>Start</Button>
        </div>
      </div>
    </Card>
  );
}

function GratitudeCard() {
  const { show } = useToast();
  const prompts = useMemo(() => ([
    'Name one thing you’re grateful for today.',
    'Recall a small kindness you experienced recently.',
    'What made you smile in the last 24 hours?',
    'Who is someone you appreciate and why?',
    'Describe a personal strength you used this week.'
  ] as string[]), []);
  const [current, setCurrent] = useState<string>(() => prompts[0] ?? '');

  const spin = () => {
  const idx = Math.floor(Math.random() * Math.max(1, prompts.length));
  setCurrent(prompts[idx] ?? current);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current);
      show({ title: 'Copied!', description: 'Prompt copied to clipboard.', variant: 'success' });
    } catch (e:any) {
      show({ title: 'Copy failed', description: e?.message || 'Could not copy to clipboard.', variant: 'error' });
    }
  };

  return (
    <Card className="p-6 wellness-card">
      <div className="section-header" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Gratitude Prompt</h3>
        <div style={{ opacity: 0.8 }}>Generate a positive reflection prompt</div>
      </div>
      <div style={{ background: '#f8fafc', border: '1px solid var(--color-outline)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
        {current}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={spin}>New Prompt</Button>
        <Button onClick={copy}>Copy</Button>
      </div>
    </Card>
  );
}
