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