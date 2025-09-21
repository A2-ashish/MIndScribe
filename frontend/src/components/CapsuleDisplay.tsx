export function CapsuleDisplay({ capsule, loading }: { capsule: any; loading: boolean }) {
  if (loading) return <div className="panel"><p>Analyzing...</p></div>;
  if (!capsule) return <div className="panel"><p>No capsule yet.</p></div>;

  const payload = capsule.payload || {};

  // Try to extract a YouTube video ID from a URL
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

  const firstYouTubeId = Array.isArray(payload.tracks) && payload.tracks.length > 0
    ? extractYouTubeId(payload.tracks[0])
    : null;
  return (
    <div className="panel">
      <h3>{capsule.summary ? capsule.summary : `Capsule (${capsule.type || 'summary'})`}</h3>
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
          {firstYouTubeId && (
            <div style={{ position: 'relative', paddingTop: '56.25%', marginBottom: 8 }}>
              <iframe
                title="Playlist Video"
                src={`https://www.youtube.com/embed/${firstYouTubeId}?rel=0&modestbranding=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>
          )}
          <ul>
            {payload.tracks.map((t: string, i: number) => <li key={i}><a href={t} target="_blank" rel="noreferrer">{t}</a></li>)}
          </ul>
        </div>
      )}
      {Array.isArray(payload.songs) && payload.songs.length > 0 && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Songs</h4>
          <ul>
            {payload.songs.map((t: string, i: number) => <li key={i}><a href={t} target="_blank" rel="noreferrer">{t}</a></li>)}
          </ul>
        </div>
      )}
      {payload.artPrompt && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Art Prompt</h4>
          <p>{payload.artPrompt}</p>
        </div>
      )}
      {Array.isArray(payload.images) && payload.images.length > 0 && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Images</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {payload.images.map((desc: string, i: number) => {
              const isUrl = typeof desc === 'string' && /^(https?:)?\/\//.test(desc);
              return isUrl ? (
                <img key={i} src={desc} alt="Calming visual" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--color-outline)' }} />
              ) : (
                <div key={i}>{desc}</div>
              );
            })}
          </div>
        </div>
      )}
      {Array.isArray(payload.motivational) && payload.motivational.length > 0 && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Motivational</h4>
          <ul>
            {payload.motivational.map((line: string, i: number) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}
      {Array.isArray(payload.chat) && payload.chat.length > 0 && (
        <div>
          <h4 style={{ margin: '6px 0' }}>Support Chat</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {payload.chat.map((m: any, i: number) => (
              <div key={i} style={{
                justifySelf: m.role === 'you' ? 'end' : 'start',
                background: m.role === 'you' ? '#e8f0fe' : '#f1f3f4',
                border: '1px solid var(--color-outline)',
                borderRadius: 10,
                padding: '6px 10px',
                maxWidth: '80%'
              }}>
                <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: 2 }}>{m.role}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
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