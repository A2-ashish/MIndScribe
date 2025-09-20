import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/firestore';
import { decideCapsuleType } from '../lib/capsuleSelector';
import { generateStory } from '../lib/gemini';
import { Timestamp } from 'firebase-admin/firestore';
import { findSimilarCapsule, storeCapsuleEmbedding, logSimilarityDecision } from '../lib/similarity';

interface InsightDoc {
  insightId: string;
  userId: string;
  entryId?: string;
  emotions?: { label: string; score: number }[];
  topics?: string[];
  sentiment?: { compound: number };
}

interface CapsulePayload {
  story?: string;
  steps?: string[];
  tracks?: string[];
  artPrompt?: string;
  reusedFrom?: string; // capsuleId reused
  similarityScore?: number;
}

export const onInsightCreated = onDocumentCreated(
  {
    region: 'asia-south2',
    document: 'insights/{insightId}',
    retry: false,
    secrets: ['GEMINI_API_KEY']
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const paramsInsightId = event.params?.insightId;
    const raw = snap.data() as Partial<InsightDoc> | undefined;
    if (!raw) {
      console.warn('[capsuleAgent] Empty snapshot data', { paramsInsightId });
      return;
    }

    const insightId = raw.insightId || paramsInsightId;
  const userId = raw.userId || 'unknownUser';
  const entryId = (raw as any).entryId as string | undefined;
    if (!insightId) {
      console.error('[capsuleAgent] Missing insightId', { raw, paramsInsightId });
      return;
    }

    // Idempotency check
    const existing = await db.collection('capsules')
      .where('insightId', '==', insightId)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.log('[capsuleAgent] Capsule already exists, skipping', { insightId });
      return;
    }

    const primaryEmotion = raw.emotions?.[0]?.label || 'neutral';
    const primaryTopic = raw.topics?.[0];
    const capsuleType = decideCapsuleType(primaryEmotion);

    const reservationRef = db.collection('capsules').doc();
    const now = Timestamp.now();
    await reservationRef.set({
      capsuleId: reservationRef.id,
      userId,
      insightId,
      type: capsuleType,
      status: 'generating',
      createdAt: now,
      updatedAt: now
    });

    let payload: CapsulePayload = {};
    let fallbackUsed = false;
    let errorMessage: string | null = null;

    async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
      let to: NodeJS.Timeout;
      return await Promise.race([
        p,
        new Promise<T>((_, reject) => { to = setTimeout(() => reject(new Error('timeout')), ms); })
      ]).finally(() => clearTimeout(to));
    }

    try {
      // Enhanced similarity reuse path (only for story capsules)
      if (capsuleType === 'story') {
        const textForMatch = primaryTopic || primaryEmotion || '';
        const sim = await findSimilarCapsule(userId, textForMatch, { baseMin: 0.9 });
        if (sim.reused && sim.best) {
          const existingCapsuleSnap = await db.collection('capsules').doc(sim.best.capsuleId).get();
          if (existingCapsuleSnap.exists) {
            const existingCapsule = existingCapsuleSnap.data() as any;
            payload = { ...(existingCapsule.payload || {}), reusedFrom: sim.best.capsuleId, similarityScore: sim.best.score };
            await logSimilarityDecision({ userId, entryId: insightId, reusedCapsuleId: sim.best.capsuleId, score: sim.best.score, threshold: sim.appliedThreshold, reused: true });
          }
        } else {
          await logSimilarityDecision({ userId, entryId: insightId, reusedCapsuleId: undefined, score: sim.best?.score, threshold: sim.appliedThreshold, reused: false });
        }
      }

      if (!payload.story && capsuleType === 'story') {
        const topicForStory = primaryTopic || primaryEmotion || 'your feelings';
        const story = await withTimeout(generateStory(topicForStory), 15000);
        payload.story = clampText(story, 1200);
      }

      if (capsuleType === 'breathing' && !payload.steps) {
        payload.steps = ['Inhale 4', 'Hold 2', 'Exhale 6', 'Repeat 6x'];
      } else if (capsuleType === 'playlist' && !payload.tracks) {
        payload.tracks = [ 'https://youtube.com/lofi1', 'https://youtube.com/lofi2' ];
      } else if (capsuleType === 'art' && !payload.artPrompt) {
        payload.artPrompt = `Abstract calming visual about ${primaryEmotion}`;
      }
    } catch (e: any) {
      errorMessage = e?.message || 'unknown_error';
      console.error('[capsuleAgent] Generation error', { insightId, capsuleType, error: errorMessage });
      fallbackUsed = true;
      payload.story = payload.story || 'You are capable. This difficult moment will pass; a small act of self-kindness counts.';
    }

    await reservationRef.set({
      capsuleId: reservationRef.id,
      userId,
      insightId,
      type: capsuleType,
      payload,
      fallbackUsed,
      error: errorMessage,
      status: 'ready',
      createdAt: now,
      updatedAt: Timestamp.now()
    }, { merge: true });

    // Mark entry as having a ready capsule (for easier UI/state tracking)
    if (entryId) {
      try {
        await db.collection('entries').doc(entryId).set({ capsuleReady: true, capsuleId: reservationRef.id, capsuleType }, { merge: true });
      } catch (e:any) {
        console.warn('[capsuleAgent] Failed to update entry with capsuleReady', { entryId, error: e?.message });
      }
    }

    // Store embedding if we have a story
    if (payload.story) {
      try {
        await storeCapsuleEmbedding({
          capsuleId: reservationRef.id,
          insightId,
            userId,
            type: capsuleType,
            text: payload.story
        });
      } catch (e:any) {
        console.warn('[capsuleAgent] embedding store failed', { insightId, capsuleId: reservationRef.id, error: e?.message });
      }
    }

    console.log('[capsuleAgent] Capsule created', {
      insightId,
      capsuleId: reservationRef.id,
      type: capsuleType,
      fallbackUsed,
      reusedFrom: payload.reusedFrom,
      similarityScore: payload.similarityScore
    });
  }
);

function clampText(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastPeriod = clipped.lastIndexOf('.');
  if (lastPeriod > max * 0.6) { return clipped.slice(0, lastPeriod + 1); }
  return clipped + '...';
}