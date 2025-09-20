import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../lib/firestore';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Swarm Insights Agent (Scheduled)
 * Aggregates recent insights to produce anonymized community mood metrics.
 * Later: feed result to Gemini for narrative summary.
 */
export const onSwarmAggregation = onSchedule({
  // Cloud Scheduler does not support asia-south2; use a nearby supported region
  region: 'asia-south1',
  schedule: 'every 60 minutes',
  timeZone: 'UTC'
}, async () => {
  const since = Date.now() - 1000 * 60 * 60 * 24 * 7; // last 7 days
  const boundary = new Date(since);

  const snap = await db.collection('insights')
    .where('createdAt', '>=', Timestamp.fromDate(boundary))
    .limit(500) // safeguard
    .get();

  let total = 0;
  let sumMood = 0;
  const emotionCounts: Record<string, number> = {};

  snap.forEach(doc => {
    const d: any = doc.data();
    const compound = Number(d?.sentiment?.compound || 0);
    sumMood += compound;
    total += 1;
    const primary = d?.emotions?.[0]?.label || 'neutral';
    emotionCounts[primary] = (emotionCounts[primary] || 0) + 1;
  });

  const avgMood = total ? sumMood / total : 0;
  const topEmotion = Object.entries(emotionCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'neutral';

  const ref = db.collection('swarmSnapshots').doc();
  await ref.set({
    snapshotId: ref.id,
    createdAt: Timestamp.now(),
    windowDays: 7,
    totalInsights: total,
    avgMood: Number(avgMood.toFixed(3)),
    topEmotion,
    emotions: emotionCounts
  });
});
