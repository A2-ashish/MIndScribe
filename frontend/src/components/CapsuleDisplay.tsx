export function CapsuleDisplay({ capsule, loading }: { capsule: any; loading: boolean }) {
  if (loading) return <div className="panel"><p>Analyzing...</p></div>;
  if (!capsule) return <div className="panel"><p>No capsule yet.</p></div>;

  const payload = capsule.payload || {};
  return (
    <div className="panel">
      <h3>Capsule ({capsule.type || 'summary'})</h3>
      {/* Support multiple capsule shapes */}
      {capsule.summary && <p>{capsule.summary}</p>}
      {capsule.content && <pre>{capsule.content}</pre>}
      {payload.story && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Story</h4>
          <p style={{ whiteSpace: 'pre-wrap' }}>{payload.story}</p>
        </div>
      )}
      {Array.isArray(payload.steps) && payload.steps.length > 0 && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Steps</h4>
          <ul>
            {payload.steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {Array.isArray(payload.tracks) && payload.tracks.length > 0 && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Playlist</h4>
          <ul>
            {payload.tracks.map((t: string, i: number) => <li key={i}><a href={t} target="_blank" rel="noreferrer">{t}</a></li>)}
          </ul>
        </div>
      )}
      {payload.artPrompt && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Art Prompt</h4>
          <p>{payload.artPrompt}</p>
        </div>
      )}
      {(payload.reusedFrom || payload.similarityScore != null) && (
        <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>
          {payload.reusedFrom ? `Reused from: ${payload.reusedFrom}` : ''}
          {payload.similarityScore != null ? ` (similarity: ${payload.similarityScore.toFixed?.(3) ?? payload.similarityScore})` : ''}
        </p>
      )}
      {capsule.fallbackUsed && <p style={{ color: '#946200' }}>Fallback used</p>}
      {capsule.error && <p style={{ color: 'crimson' }}>Error: {capsule.error}</p>}
    </div>
  );
}