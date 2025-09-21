import React, { useState } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { JournalInput } from '../components/JournalInput';
import { submitEntry } from '../services/submitEntry';
import { createDraftEntry } from '../services/createDraftEntry';
import { useToast } from '../components/ui/toast';

export const Journal: React.FC = () => {
  const [entryId, setEntryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice' | 'drawing'>('text');
  const [mood, setMood] = useState<'happy' | 'calm' | 'thoughtful' | 'energetic' | 'neutral'>('neutral');
  const { show } = useToast();

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
