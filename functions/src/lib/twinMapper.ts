// backend/src/lib/twinMapper.ts
export function mapSentimentToTwinState(sentiment: number) {
  if (sentiment > 0.25) return 'vibrant';
  if (sentiment < -0.25) return 'dim';
  return 'steady';
}