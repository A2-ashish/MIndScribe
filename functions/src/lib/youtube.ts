/** YouTube Data API integration (search-based). */
export interface PlaylistRecommendation {
  query: string;
  playlistUrls: string[]; // full watch URLs
}

type SearchOpts = { max?: number };

// Simple in-memory cache to reduce API calls across warm invocations
const cache = new Map<string, { ts: number; urls: string[] }>();
const FIVE_MIN = 5 * 60 * 1000;

function normalizeQuery(moodOrTopic: string): string {
  const t = (moodOrTopic || '').toLowerCase().trim();
  if (!t) return 'calm focus lofi';
  // Map common moods to search-intent phrases
  const map: Record<string, string> = {
    sad: 'uplifting calm indian music',
    anxious: 'anxiety relief indian instrumental',
    stressed: 'calm indian ambient focus music',
    angry: 'soothing slow indian classical instrumental',
    neutral: 'lofi calm indian background music',
    happy: 'positive relaxing indian instrumental',
    focus: 'lofi focus indian beats',
    calm: 'calm indian ambient music',
    tired: 'gentle indian piano relaxation'
  };
  return map[t] || `${t} relaxing indian music`;
}

export async function recommendPlaylists(moodOrTopic: string, opts: SearchOpts = {}): Promise<PlaylistRecommendation> {
  const max = Math.min(Math.max(opts.max || 5, 1), 10);
  const q = normalizeQuery(moodOrTopic);

  // Cache
  const hit = cache.get(q);
  const now = Date.now();
  if (hit && now - hit.ts < FIVE_MIN && hit.urls.length >= max) {
    return { query: q, playlistUrls: hit.urls.slice(0, max) };
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    // Graceful fallback to curated static URLs
    const fallback = [
      'https://www.youtube.com/watch?v=jfKfPfyJRdk', // lofi hip hop radio
      'https://www.youtube.com/watch?v=5qap5aO4i9A', // lofi beats
      'https://www.youtube.com/watch?v=DWcJFNfaw9c', // ambient study
      'https://www.youtube.com/watch?v=lTRiuFIWV54', // synthwave radio
      'https://www.youtube.com/watch?v=2OEL4P1Rz04'  // piano relaxing
    ];
    cache.set(q, { ts: now, urls: fallback });
    return { query: q, playlistUrls: fallback.slice(0, max) };
  }

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('key', key);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('maxResults', String(max));
    url.searchParams.set('q', q);
  url.searchParams.set('type', 'video');
    url.searchParams.set('videoCategoryId', '10'); // Music
    url.searchParams.set('videoEmbeddable', 'true');
    url.searchParams.set('safeSearch', 'moderate');
  url.searchParams.set('regionCode', 'IN');

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`YouTube API error: ${resp.status}`);
    const json: any = await resp.json();
    const ids: string[] = (json.items || [])
      .map((it: any) => it?.id?.videoId)
      .filter((v: any) => typeof v === 'string');
    const urls = ids.map((id) => `https://www.youtube.com/watch?v=${id}`);
    if (urls.length) cache.set(q, { ts: now, urls });
    return { query: q, playlistUrls: urls.slice(0, max) };
  } catch (e) {
    console.warn('[youtube] search failed, using fallback', (e as any)?.message || e);
    const fallback = [
      'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      'https://www.youtube.com/watch?v=5qap5aO4i9A'
    ];
    cache.set(q, { ts: now, urls: fallback });
    return { query: q, playlistUrls: fallback.slice(0, max) };
  }
}
