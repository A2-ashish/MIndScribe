import { useEffect, useState } from 'react';
import { Card } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Tooltip } from '../components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ensureUser } from '../auth';
import { getUserRecentInsightsWithCapsules } from '../services/getUserInsights';
import { listUserInsightsPage, type InsightDoc } from '../services/listUserInsights';
import { listUserCapsulesPage, type CapsuleDoc } from '../services/listUserCapsules';
import { CapsuleDisplay } from '../components/CapsuleDisplay';

export function Insights() {
  const [period, setPeriod] = useState<'week'|'month'|'quarter'>('week');
  const wellness = { current: 78, prev: 65, streak: 7, entries: 23 };
  const [uid, setUid] = useState<string | null>(null);
  const [recent, setRecent] = useState<Array<{ insight: any; capsule?: any }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [insightsAll, setInsightsAll] = useState<InsightDoc[]>([]);
  const [insightsCursor, setInsightsCursor] = useState<any | null>(null);
  const [insightsLoadingMore, setInsightsLoadingMore] = useState(false);
  const [capsulesAll, setCapsulesAll] = useState<CapsuleDoc[]>([]);
  const [capsulesCursor, setCapsulesCursor] = useState<any | null>(null);
  const [capsulesLoadingMore, setCapsulesLoadingMore] = useState(false);

  function deriveInsightTitle(ins: any): string {
    if (!ins) return 'Insight';
    // Prefer sentiment thresholds to derive mood label, fallback to top emotion
    const sent: number = typeof ins.sentiment?.compound === 'number' ? ins.sentiment.compound : 0;
    let mood: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (sent >= 0.25) mood = 'positive';
    else if (sent <= -0.25) mood = 'negative';
    else {
      const emo = Array.isArray(ins.emotions) && ins.emotions[0]?.label ? ins.emotions[0].label : 'neutral';
      if (emo === 'positive' || emo === 'negative' || emo === 'neutral') mood = emo as any;
    }
    const topics: string[] = Array.isArray(ins.topics) ? ins.topics.slice(0, 2) : [];
    const risk = ins.risk || {};
    const riskBad = (risk.suicidal >= 0.75) ? 'suicidal risk' : (risk.self_harm >= 0.7) ? 'self-harm risk' : (risk.violence >= 0.6) ? 'violence risk' : '';
    const cap = (s: string) => s ? (s.charAt(0).toUpperCase() + s.slice(1)) : s;
    const parts: string[] = [];
    parts.push(`${cap(mood)} mood`);
    if (topics.length) parts.push(`topics: ${topics.join(', ')}`);
    parts.push(`sentiment ${(sent >= 0 ? '+' : '')}${sent.toFixed(2)}`);
    if (riskBad) parts.push(riskBad);
    return parts.join(' • ');
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await ensureUser();
        if (!mounted) return;
        setUid(u.uid);
        setLoading(true);
        const items = await getUserRecentInsightsWithCapsules(u.uid, 5);
        if (!mounted) return;
        setRecent(items);
  // Prime first pages for full history sections
        const ins = await listUserInsightsPage(u.uid, 10);
        const caps = await listUserCapsulesPage(u.uid, 10);
  if (!mounted) return;
  setInsightsAll(ins.items);
  setInsightsCursor(ins.nextCursor);
  setCapsulesAll(caps.items);
  setCapsulesCursor(caps.nextCursor);
        setError(null);
      } catch (e:any) {
        console.error('[Insights] load error', e);
        const code = e?.code || '';
        const msg = code === 'failed-precondition'
          ? 'A Firestore index is required to list insights/capsules. Open the console link in your browser error to create it, or create a composite index on (userId ASC, createdAt DESC) for collections insights and capsules.'
          : (e?.message || 'Failed to load insights.');
        setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="min-h-screen pb-20 px-4 pt-8" style={{ background: 'linear-gradient(180deg,#fff,#f6f7fb)' }}>
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span aria-hidden>📊</span>
            <h1 className="text-2xl font-bold">Your Insights</h1>
          </div>
          <p className="text-muted-foreground text-sm" style={{ opacity: 0.8 }}>Understanding your mental wellness journey</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="grid grid-cols-3 gap-1 p-1" style={{ background: '#f2f4f7', borderRadius: 12 }}>
            {(['week','month','quarter'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={period===p? 'secondary-active':'secondary'} style={{ padding: '6px 10px' }}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3" />
          <div className="segmented" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="achievements">Rewards</TabsTrigger>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {error && (
              <Card className="p-4">
                <div style={{ color: '#b00020' }}>{error}</div>
              </Card>
            )}
            <Card className="p-6 wellness-card space-y-3">
              <div className="section-header">
                <Tooltip content="A composite of mood, reflection frequency, and AI-detected stability.">
                  <h3 style={{ margin: 0, cursor: 'help' }}>Wellness Score</h3>
                </Tooltip>
                <b style={{ color: '#6b4fd8', fontSize: '1.25rem' }}>{wellness.current}%</b>
              </div>
              <Progress
                value={wellness.current}
                trackColor="#eef2ff"
                filledColor="#8b5cf6"
                remainderColor="#a7f3d0"
                remainderStyle="cap"
                capRatio={0.3}
                capMin={6}
                capMax={18}
              />
              <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Up from {wellness.prev}% last week</div>
            </Card>

            {/* Latest Capsule response */}
            <Card className="p-6 wellness-card space-y-3">
              <div className="section-header" style={{ marginBottom: 6 }}>
                <h3 style={{ margin: 0 }}>Latest AI Response</h3>
              </div>
              {loading && <div style={{ opacity: 0.8 }}>Loading your latest insights…</div>}
              {!loading && recent.length === 0 && <div style={{ opacity: 0.8 }}>No insights yet. Create a journal entry to see AI responses here.</div>}
              {!loading && recent.length > 0 && recent[0]?.capsule && (
                <CapsuleDisplay capsule={recent[0].capsule} loading={false} />
              )}
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Card className="p-4 text-center">
                <div style={{ fontSize: '1.5rem', color: '#27ae60', fontWeight: 700 }}>{wellness.streak}</div>
                <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Day Streak</div>
              </Card>
              <Card className="p-4 text-center">
                <div style={{ fontSize: '1.5rem', color: '#f2994a', fontWeight: 700 }}>{wellness.entries}</div>
                <div style={{ opacity: 0.8, fontSize: '0.9rem' }}>Total Entries</div>
              </Card>
            </div>

            <div>
              <h3 style={{ margin: '6px 0' }}>AI Insights</h3>
              {loading && <Card className="p-4"><div style={{ opacity: 0.8 }}>Loading previous insights…</div></Card>}
              {!loading && recent.slice(1).length === 0 && (
                <Card className="p-4"><div style={{ opacity: 0.8 }}>No previous insights yet.</div></Card>
              )}
              {!loading && recent.slice(1).map((item, idx) => (
                <Card key={item.insight.insightId || idx} className="p-4" style={{ marginTop: idx === 0 ? 0 : 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <b>{item.insight?.summary || deriveInsightTitle(item.insight)}</b>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(() => {
                        const r = (item.insight?.risk || {}) as { suicidal?: number; self_harm?: number; violence?: number };
                        const high = (r.suicidal ?? 0) >= 0.75 || (r.self_harm ?? 0) >= 0.7 || (r.violence ?? 0) >= 0.6;
                        return high ? <span style={{ background: '#fff1f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 9999, fontSize: '0.75rem' }}>High risk</span> : null;
                      })()}
                      {item.insight?.createdAt?.toDate && (
                        <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>{item.insight.createdAt.toDate().toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                  {item.capsule ? (
                    <div style={{ marginTop: 6 }}>
                      {/* Cover all capsule shapes: summary/content/payload.story */}
                      {item.capsule.summary && <div>{item.capsule.summary}</div>}
                      {item.capsule.content && <pre style={{ whiteSpace: 'pre-wrap' }}>{item.capsule.content}</pre>}
                      {item.capsule?.payload?.story && (
                        <pre style={{ whiteSpace: 'pre-wrap' }}>{item.capsule.payload.story}</pre>
                      )}
                      {!item.capsule.summary && !item.capsule.content && !item.capsule?.payload?.story && (
                        <div style={{ opacity: 0.8 }}>Capsule available</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ opacity: 0.8, marginTop: 6 }}>No AI capsule for this insight.</div>
                  )}
                </Card>
              ))}
              {/* Full history of insights */}
              <h4 style={{ margin: '12px 0 6px' }}>All Insights</h4>
              {insightsAll.length === 0 && !loading && (
                <Card className="p-4"><div style={{ opacity: 0.8 }}>No insights yet.</div></Card>
              )}
              {insightsAll.map((ins, idx) => (
                <Card key={ins.insightId || idx} className="p-4" style={{ marginTop: idx === 0 ? 0 : 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <b>{ins.summary || deriveInsightTitle(ins)}</b>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {(() => {
                        const r = (ins?.risk || {}) as { suicidal?: number; self_harm?: number; violence?: number };
                        const high = (r.suicidal ?? 0) >= 0.75 || (r.self_harm ?? 0) >= 0.7 || (r.violence ?? 0) >= 0.6;
                        return high ? <span style={{ background: '#fff1f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 9999, fontSize: '0.75rem' }}>High risk</span> : null;
                      })()}
                      {ins.createdAt?.toDate && (
                        <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>{ins.createdAt.toDate().toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <button
                  className="secondary"
                  disabled={insightsLoadingMore || !insightsCursor}
                  onClick={async () => {
                    if (!uid || !insightsCursor) return;
                    setInsightsLoadingMore(true);
                    try {
                      const next = await listUserInsightsPage(uid, 10, insightsCursor);
                      setInsightsAll(prev => [...prev, ...next.items]);
                      setInsightsCursor(next.nextCursor);
                    } finally {
                      setInsightsLoadingMore(false);
                    }
                  }}
                >{insightsCursor ? (insightsLoadingMore ? 'Loading…' : 'Load more') : 'No more insights'}</button>
              </div>
            </div>

            {/* All Capsules generated */}
            <div>
              <h3 style={{ margin: '12px 0 6px' }}>AI Capsules</h3>
              {capsulesAll.length === 0 && !loading && (
                <Card className="p-4"><div style={{ opacity: 0.8 }}>No capsules yet.</div></Card>
              )}
              {capsulesAll.map((cap, idx) => (
                <Card key={cap.capsuleId || idx} className="p-4" style={{ marginTop: idx === 0 ? 0 : 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b>{cap.summary || cap.type || 'Capsule'}</b>
                    {cap.createdAt?.toDate && (
                      <div style={{ opacity: 0.75, fontSize: '0.85rem' }}>{cap.createdAt.toDate().toLocaleString()}</div>
                    )}
                  </div>
                  {cap.content && <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{cap.content}</pre>}
                  {/* Story (or breathing script stored as story) */}
                  {cap?.payload?.story && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Story</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{cap.payload.story}</div>
                    </div>
                  )}
                  {/* Breathing steps */}
                  {Array.isArray(cap?.payload?.steps) && cap.payload.steps.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Steps</div>
                      <ul>
                        {cap.payload.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {/* Playlist embed + links */}
                  {Array.isArray(cap?.payload?.tracks) && cap.payload.tracks.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Playlist</div>
                      {/* Simple YouTube embed of first track if possible */}
                      {(() => {
                        const extractYouTubeId = (url: string): string | null => {
                          if (!url) return null;
                          try {
                            const u = new URL(url);
                            if (u.hostname.includes('youtube.com')) {
                              if (u.pathname === '/watch') return u.searchParams.get('v');
                              const parts = u.pathname.split('/').filter(Boolean);
                              if (parts[0] === 'shorts' && parts[1]) return parts[1];
                              if (parts[0] === 'embed' && parts[1]) return parts[1];
                            }
                            if (u.hostname === 'youtu.be') {
                              const parts = u.pathname.split('/').filter(Boolean);
                              if (parts[0]) return parts[0];
                            }
                          } catch {}
                          return null;
                        };
                        const id = extractYouTubeId(cap.payload.tracks[0]);
                        return id ? (
                          <div style={{ position: 'relative', paddingTop: '56.25%', marginBottom: 8 }}>
                            <iframe
                              title="Playlist Video"
                              src={`https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                            />
                          </div>
                        ) : null;
                      })()}
                      <ul>
                        {cap.payload.tracks.map((t: string, i: number) => <li key={i}><a href={t} target="_blank" rel="noreferrer">{t}</a></li>)}
                      </ul>
                    </div>
                  )}
                  {/* Art prompt */}
                  {cap?.payload?.artPrompt && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Art Prompt</div>
                      <div>{cap.payload.artPrompt}</div>
                    </div>
                  )}
                  {(cap?.payload?.reusedFrom || cap?.payload?.similarityScore != null) && (
                    <div style={{ opacity: 0.7, fontSize: '0.85rem', marginTop: 6 }}>
                      {cap.payload.reusedFrom ? `Reused from: ${cap.payload.reusedFrom}` : ''}
                      {cap.payload.similarityScore != null ? ` (similarity: ${cap.payload.similarityScore.toFixed?.(3) ?? cap.payload.similarityScore})` : ''}
                    </div>
                  )}
                </Card>
              ))}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <button
                  className="secondary"
                  disabled={capsulesLoadingMore || !capsulesCursor}
                  onClick={async () => {
                    if (!uid || !capsulesCursor) return;
                    setCapsulesLoadingMore(true);
                    try {
                      const next = await listUserCapsulesPage(uid, 10, capsulesCursor);
                      setCapsulesAll(prev => [...prev, ...next.items]);
                      setCapsulesCursor(next.nextCursor);
                    } finally {
                      setCapsulesLoadingMore(false);
                    }
                  }}
                >{capsulesCursor ? (capsulesLoadingMore ? 'Loading…' : 'Load more') : 'No more capsules'}</button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            <Card className="p-6 wellness-card">
              <div style={{ opacity: 0.85 }}>Patterns view coming soon.</div>
            </Card>
          </TabsContent>

          <TabsContent value="achievements" className="space-y-6">
            <Card className="p-6 wellness-card">
              <div style={{ opacity: 0.85 }}>Rewards view coming soon.</div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
