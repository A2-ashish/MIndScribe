import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/toast';

export function Community() {
  const { show } = useToast();
  const copyPrompt = async () => {
    const prompt = 'Share a brief, positive reflection or a lesson learned this week.';
    try {
      await navigator.clipboard.writeText(prompt);
      show({ title: 'Copied!', description: 'Prompt copied to clipboard.', variant: 'success' });
    } catch (e:any) {
      show({ title: 'Copy failed', description: e?.message || 'Could not copy to clipboard.', variant: 'error' });
    }
  };
  return (
    <div className="min-h-screen pb-20 px-4 pt-8" style={{ background: 'linear-gradient(180deg,#fff,#f6f7fb)' }}>
      <div className="max-w-lg mx-auto" style={{ textAlign: 'left', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Anonymous Community</h1>
        <p style={{ opacity: 0.8, display: 'flex', alignItems: 'center', gap: 6 }}>🛡️ Safe • Anonymous • Moderated by AI</p>
      </div>

      <div className="max-w-lg mx-auto" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
        <Card className="p-4 text-center" style={{ margin: 0 }}>
          <div style={{ fontSize: 24 }}>👥</div>
          <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#6b4fd8' }}>2.3K</div>
          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Active Members</div>
        </Card>
        <Card className="p-4 text-center" style={{ margin: 0 }}>
          <div style={{ fontSize: 24 }}>💬</div>
          <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#6b4fd8' }}>47</div>
          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Posts Today</div>
        </Card>
        <Card className="p-4 text-center" style={{ margin: 0 }}>
          <div style={{ fontSize: 24 }}>💜</div>
          <div style={{ fontWeight: 700, fontSize: '1.3rem', color: '#6b4fd8' }}>156</div>
          <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Support Given</div>
        </Card>
      </div>

      <Card className="max-w-lg mx-auto p-6 wellness-card" style={{ marginBottom: 16 }}>
        <div className="section-header" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Share Your Reflection</h3>
          <span aria-label="locked" title="Moderated">🔒</span>
        </div>
        <textarea placeholder="Share something positive, a lesson learned, encouragement… (Your identity stays completely anonymous)" rows={4} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ opacity: 0.8 }}>AI moderation ensures a safe, supportive space</span>
          <Button variant="success">Share Anonymously</Button>
        </div>
      </Card>

      <div className="max-w-lg mx-auto" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a className="chip" href="#/community">All Posts <span style={{ background: '#e7dfff', padding: '2px 6px', borderRadius: 999 }}>42</span></a>
        <a className="chip" href="#/community">Gratitude <span style={{ background: '#e7dfff', padding: '2px 6px', borderRadius: 999 }}>15</span></a>
        <a className="chip" href="#/community">Growth <span style={{ background: '#e7dfff', padding: '2px 6px', borderRadius: 999 }}>18</span></a>
        <a className="chip" href="#/community">Support <span style={{ background: '#e7dfff', padding: '2px 6px', borderRadius: 999 }}>9</span></a>
      </div>
      <Card className="max-w-lg mx-auto p-6 wellness-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Latest Community Narrative</h3>
        <p style={{ opacity: 0.8, marginBottom: 8 }}>An anonymized, aggregated reflection generated from recent posts.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="#community" className="secondary">Load latest narrative</a>
          <Button variant="secondary" onClick={copyPrompt}>Copy share prompt</Button>
        </div>
      </Card>
    </div>
  );
}
