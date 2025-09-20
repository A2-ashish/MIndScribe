import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/firestore';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Emotional Twin Agent
 * Maintains a rolling state document representing the user's evolving emotional profile.
 * First implementation: simple rolling averages; future: vector embeddings + trajectory.
 */
export const onTwinUpdate = onDocumentCreated(
  {
    region: 'asia-south2',
    document: 'insights/{insightId}',
    retry: false
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const insight: any = snap.data();
    if (!insight) return;

    const { userId, sentiment, emotions } = insight;
    if (!userId) return;

    const twinRef = db.collection('twinStates').doc(userId);
    const twinSnap = await twinRef.get();

    interface TwinState {
      userId: string;
      entries: number;
      moodSum: number;
      lastUpdated: any;
      primaryEmotionCounts: Record<string, number>;
      streak: number;
      lastDay: string | null;
      avgMood?: number;
      dominantEmotion?: string;
    }

    const prev: TwinState = twinSnap.exists ? twinSnap.data() as TwinState : {
      userId,
      entries: 0,
      moodSum: 0,
      lastUpdated: null,
      primaryEmotionCounts: {},
      streak: 0,
      lastDay: null
    };

    const compound = Number(sentiment?.compound || 0);
    const primary = (emotions && emotions[0]?.label) || 'neutral';

    const today = new Date().toISOString().slice(0,10);
    let streak = prev.streak || 0;
    if (!prev.lastDay) {
      streak = 1;
    } else if (prev.lastDay === today) {
      // no change
    } else {
      const prevDate = new Date(prev.lastDay);
      const diff = (Date.now() - prevDate.getTime()) / 86400000;
      if (diff < 2) streak += 1; else streak = 1;
    }

    const newEmotionCounts: Record<string, number> = {
      ...prev.primaryEmotionCounts,
      [primary]: (prev.primaryEmotionCounts[primary] || 0) + 1
    };

    const dominantEmotion = Object.entries(newEmotionCounts)
      .sort((a:[string,number], b:[string,number]) => b[1] - a[1])[0]?.[0] || 'neutral';

    const updated: TwinState = {
      ...prev,
      entries: prev.entries + 1,
      moodSum: prev.moodSum + compound,
      avgMood: Number(((prev.moodSum + compound) / (prev.entries + 1)).toFixed(3)),
      primaryEmotionCounts: newEmotionCounts,
      dominantEmotion,
      lastUpdated: Timestamp.now(),
      streak,
      lastDay: today
    };

    await twinRef.set(updated, { merge: true });
  }
);
