import React, { useEffect, useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { JournalInput } from '../components/JournalInput';
import { submitEntry } from '../services/submitEntry';
import { createDraftEntry } from '../services/createDraftEntry';
import { useToast } from '../components/ui/toast';
import { useAuthUser } from '../hooks/useAuthUser';
import { collection, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseCore';

export const Journal: React.FC = () => {
  const [entryId, setEntryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice' | 'drawing'>('text');
  const [mood, setMood] = useState<'happy' | 'calm' | 'thoughtful' | 'energetic' | 'neutral'>('neutral');
  const { show } = useToast();
  const user = useAuthUser();
  const [guidance, setGuidance] = useState<{ word?: string; suggestion?: string; cta?: { label?: string; route?: string } } | null>(null);
  const [showGuidance, setShowGuidance] = useState<boolean>(true);
  const [guidanceLoading, setGuidanceLoading] = useState<boolean>(false);
  const [stopGuidanceListen, setStopGuidanceListen] = useState<null | (() => void)>(null);

  function listenForInsightGuidance(uid: string, entId: string, timeoutMs = 20000) {
    setGuidanceLoading(true);
    const iq = query(collection(db, 'insights'), where('userId', '==', uid), where('entryId', '==', entId), limit(1));
    const unsub = onSnapshot(iq, (snap) => {
      const d = snap.docs[0];
      if (!d) return;
      const data = d.data() as any;
      if (data?.guidance) {
        setGuidance({ word: data.guidance.word, suggestion: data.guidance.suggestion, cta: data.guidance.cta });
        setGuidanceLoading(false);
        // Provide an extra breathing CTA toast for caution/high-risk guidance
        const safety = data.guidance?.safety as 'ok'|'caution'|'high-risk'|undefined;
        if (safety === 'caution' || safety === 'high-risk') {
          show({
            title: 'Try breathing now?',
            description: 'A few steady breaths might help. Inhale 4, hold 2, exhale 6.',
            variant: 'success',
            duration: 6000,
            action: { label: 'Open Calming Games', href: '#/games', variant: 'primary' }
          });
        }
        // Notify BottomNav to show a short-lived guidance pill
        try {
          const evt = new CustomEvent('ms:guidance-pill', {
            detail: {
              word: data.guidance.word,
              safety: data.guidance.safety as 'ok'|'caution'|'high-risk'|undefined,
              route: data.guidance?.cta?.route || '#/insights'
            }
          });
          window.dispatchEvent(evt);
        } catch {}
      }
    });
    setStopGuidanceListen(() => unsub);
    // Optional timeout to stop listening if nothing arrives
    const to = setTimeout(() => {
      setGuidanceLoading(false);
      try { unsub(); } catch {}
      setStopGuidanceListen(null);
    }, timeoutMs);
    return () => { clearTimeout(to); try { unsub(); } catch {}; setStopGuidanceListen(null); };
  }

  async function handleSubmit(text: string) {
    try {
      setSubmitting(true);
      const { entryId: submittedId } = await submitEntry(text, entryId || undefined);
      setEntryId(submittedId);
      show({
        title: 'Entry submitted',
        description: 'Your journal entry is processing.',
        variant: 'success',
        duration: 5000,
        action: { label: 'Go to Insights', href: '#/insights', variant: 'primary' }
      });
      if (user?.uid && submittedId) {
        setShowGuidance(true);
        setGuidance(null);
        // Stop any previous listener
        if (stopGuidanceListen) { try { stopGuidanceListen(); } catch {} }
        // Start realtime listener for quick guidance
        listenForInsightGuidance(user.uid, submittedId);
      }
    } catch (e:any) {
      show({ title: 'Submit failed', description: e?.message || 'Submit failed', variant: 'error', duration: 4000 });
    } finally { setSubmitting(false); }
  }

  async function handleCreateDraft() {
    try {
      const { entryId } = await createDraftEntry();
      setEntryId(entryId);
      show({ title: 'Draft created', description: 'You can now attach media to this entry.' });
    } catch (e:any) { window.alert(e?.message || 'Failed to create draft'); }
  }

  return (
    <div className="min-h-screen pb-20 px-4 pt-8" style={{ background: 'linear-gradient(180deg,#fff,#f6f7fb)' }}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Inline Quick Guidance banner */}
        {showGuidance && guidance && (
          <Card className="p-4 wellness-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{guidance.word || 'Guidance'}</div>
                <div style={{ opacity: 0.9 }}>{guidance.suggestion}</div>
                {guidance.cta?.route && (
                  <div style={{ marginTop: 8 }}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const r = guidance.cta?.route || '#/insights';
                        if (r.startsWith('#')) { window.location.hash = r.slice(1); }
                        else { window.location.href = r; }
                      }}
                    >{guidance.cta?.label || 'Open'}</Button>
                  </div>
                )}
              </div>
              <button aria-label="Dismiss" className="text-sm" onClick={() => setShowGuidance(false)}>✖</button>
            </div>
          </Card>
        )}
        <div className="text-center space-y-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span aria-hidden>📖</span>
            <h1 className="text-2xl font-bold">Journal</h1>
          </div>
          <p className="text-muted-foreground text-sm" style={{ opacity: 0.8 }}>
            Your safe space to express thoughts and feelings
          </p>
        </div>

        <Card className="p-6 wellness-card">
          <div className="text-center">
            <h2 className="text-lg font-semibold" style={{ marginBottom: 12 }}>How are you feeling?</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              {([
                { key: 'happy', label: 'Happy', icon: '😊' },
                { key: 'calm', label: 'Calm', icon: '💚' },
                { key: 'thoughtful', label: 'Thoughtful', icon: '✨' },
                { key: 'energetic', label: 'Energetic', icon: '⚡' },
                { key: 'neutral', label: 'Neutral', icon: '😐' },
              ] as const).map((m) => (
                <Button key={m.key} variant={mood === m.key ? 'secondary' : 'ghost'} onClick={() => setMood(m.key as any)}>
                  <span style={{ marginRight: 6 }}>{m.icon}</span> {m.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4 wellness-card">
          <h3 className="font-semibold" style={{ marginBottom: 10 }}>How would you like to express yourself?</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {(['text','voice','drawing'] as const).map(mode => (
              <Button key={mode} variant={inputMode === mode ? 'secondary' : 'ghost'} onClick={() => setInputMode(mode)}>
                {mode.charAt(0).toUpperCase()+mode.slice(1)}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="p-6 wellness-card">
          <div className="section-header" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Today's Entry</h3>
            <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>{new Date().toLocaleDateString()}</div>
          </div>
          {/* Reuse existing pipeline component */}
          <JournalInput onSubmit={handleSubmit} onCreateDraft={handleCreateDraft} hasDraft={!!entryId} disabled={submitting} />
        </Card>
      </div>
    </div>
  );
};
