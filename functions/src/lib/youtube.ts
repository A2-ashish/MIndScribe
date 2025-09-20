/** Placeholder for YouTube Data API integration */
export interface PlaylistRecommendation {
  mood: string;
  playlistUrls: string[];
}

export async function recommendPlaylists(mood: string): Promise<PlaylistRecommendation> {
  // Hard-coded stub; later call YouTube API with mood keywords.
  const base = 'https://youtube.com/watch?v=';
  const ids = mood === 'sad' ? ['lofiSad1','uplift2','calm3'] : ['focus1','breathe2','energy3'];
  return { mood, playlistUrls: ids.map(id => base + id) };
}
