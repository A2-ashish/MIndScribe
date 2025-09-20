import { useState } from 'react';

type Props = {
  onSubmit: (text: string) => void | Promise<void>;
  onCreateDraft?: () => void | Promise<void>;
  hasDraft?: boolean;
  disabled: boolean;
};

export function JournalInput({ onSubmit, onCreateDraft, hasDraft, disabled }: Props) {
  const [text, setText] = useState('');
  const MAX = 5000;
  const len = text.length;
  const canSubmit = !disabled && text.trim().length >= 3 && len <= MAX;
  const percent = Math.min(100, Math.round((len / MAX) * 100));
  const counterColor = len > MAX ? 'crimson' : percent > 90 ? '#ffb84d' : '#8aa0b3';

  return (
    <div className="panel">
      <div className="section-header">
        <h2 style={{ margin: 0 }}>New Entry</h2>
        <div className="toolbar" style={{ gap: 8 }}>
          {!hasDraft && (
            <button
              className="secondary"
              type="button"
              onClick={() => onCreateDraft && onCreateDraft()}
              disabled={disabled}
              title="Create a draft to attach media before submitting"
            >
              Create draft for media
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={async () => {
              await onSubmit(text.trim());
              setText('');
            }}
          >
            {disabled ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>

      <textarea
        rows={6}
        placeholder="How are you feeling today?"
        value={text}
        onChange={e => setText(e.target.value)}
        maxLength={MAX + 1}
      />

      <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: counterColor }}>{len}/{MAX} characters</span>
        {!hasDraft && (
          <span style={{ opacity: 0.75 }}>Tip: Create a draft to upload media before submitting</span>
        )}
      </div>
    </div>
  );
}