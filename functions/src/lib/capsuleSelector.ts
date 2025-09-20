// backend/src/lib/capsuleSelector.ts
export function decideCapsuleType(primaryEmotion: string): string {
  if (['anxiety', 'stress'].includes(primaryEmotion)) return 'breathing';
  if (['sadness', 'loneliness'].includes(primaryEmotion)) return 'story';
  if (['anger'].includes(primaryEmotion)) return 'breathing';
  return 'playlist';
}