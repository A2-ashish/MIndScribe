import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../lib/firestore';
import { HttpError, errorResponse } from '../lib/httpError';
import { Timestamp } from 'firebase-admin/firestore';
import { decideCapsuleType } from '../lib/capsuleSelector';
import { generateStory } from '../lib/gemini';
import { findSimilarCapsule, logSimilarityDecision, storeCapsuleEmbedding } from '../lib/similarity';

function assertAdmin(req: any) {
  const incoming = (req.headers['x-admin-key'] || req.headers['X-Admin-Key'] || '').toString();
  const expected = (process.env.ADMIN_KEY || '').toString();
  if (!expected || !incoming || incoming !== expected) {
    throw new HttpError(401, 'Unauthorized');
  }
}

export const backfillInsights = onRequest({ region: 'asia-south2', timeoutSeconds: 300, secrets: ['GEMINI_API_KEY'] }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method Not Allowed');
    assertAdmin(req);
    const limit = Math.min(Number(req.query.limit || 100), 500);

    // Find submitted entries that likely missed insights.
    // Prefer ordering by updatedAt desc; if composite index is missing, fallback to unordered query.
    let candidatesSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
    try {
      candidatesSnap = await db.collection('entries')
        .where('submitted', '==', true)
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
  const looksLikeIndexError = msg.includes('index') || msg.includes('failed_precondition');
      if (!looksLikeIndexError) throw e;
      candidatesSnap = await db.collection('entries')
        .where('submitted', '==', true)
        .limit(limit)
        .get();
    }

    let triggered = 0;
    for (const doc of candidatesSnap.docs) {
      const entry: any = doc.data();
      // Skip if an insight already exists
      const insSnap = await db.collection('insights').where('entryId', '==', entry.entryId).limit(1).get();
      if (!insSnap.empty) continue;
      // Touch the entry to trigger onEntryCreated (idempotent check there will protect duplicates)
      await doc.ref.set({ backfillKick: Timestamp.now(), processed: false }, { merge: true });
      triggered++;
    }
    res.json({ ok: true, triggered });
  } catch (e: any) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});

export const backfillCapsules = onRequest({ region: 'asia-south2', timeoutSeconds: 540, secrets: ['GEMINI_API_KEY'] }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method Not Allowed');
    assertAdmin(req);
    const limit = Math.min(Number(req.query.limit || 50), 200);

    // Fetch recent insights and create capsules if missing
    const insightsSnap = await db.collection('insights')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    let created = 0;
    for (const ins of insightsSnap.docs) {
      const insight: any = ins.data();
      const capSnap = await db.collection('capsules').where('insightId', '==', insight.insightId).limit(1).get();
      if (!capSnap.empty) continue;

      const userId = insight.userId;
      const entryId = insight.entryId as string | undefined;
      const primaryEmotion = insight.emotions?.[0]?.label || 'neutral';
      const primaryTopic = insight.topics?.[0];
      const capsuleType = decideCapsuleType(primaryEmotion);

      const reservationRef = db.collection('capsules').doc();
      const now = Timestamp.now();
      await reservationRef.set({
        capsuleId: reservationRef.id,
        userId,
        insightId: insight.insightId,
        type: capsuleType,
        status: 'generating',
        createdAt: now,
        updatedAt: now
      });

      let payload: any = {};
      let fallbackUsed = false;
      let errorMessage: string | null = null;

      try {
        if (capsuleType === 'story') {
          const textForMatch = primaryTopic || primaryEmotion || '';
          const sim = await findSimilarCapsule(userId, textForMatch, { baseMin: 0.9 });
          if (sim.reused && sim.best) {
            const existingCapsuleSnap = await db.collection('capsules').doc(sim.best.capsuleId).get();
            if (existingCapsuleSnap.exists) {
              const existingCapsule = existingCapsuleSnap.data() as any;
              payload = { ...(existingCapsule.payload || {}), reusedFrom: sim.best.capsuleId, similarityScore: sim.best.score };
              await logSimilarityDecision({ userId, entryId: insight.insightId, reusedCapsuleId: sim.best.capsuleId, score: sim.best.score, threshold: sim.appliedThreshold, reused: true });
            }
          } else {
            await logSimilarityDecision({ userId, entryId: insight.insightId, reusedCapsuleId: undefined, score: sim.best?.score, threshold: sim.appliedThreshold, reused: false });
          }
        }

        if (!payload.story && capsuleType === 'story') {
          const topicForStory = primaryTopic || primaryEmotion || 'your feelings';
          const story = await generateStory(topicForStory);
          payload.story = clampText(story, 1200);
        }

        if (capsuleType === 'breathing' && !payload.steps) {
          payload.steps = ['Inhale 4', 'Hold 2', 'Exhale 6', 'Repeat 6x'];
        } else if (capsuleType === 'playlist' && !payload.tracks) {
          payload.tracks = ['https://youtube.com/lofi1', 'https://youtube.com/lofi2'];
        } else if (capsuleType === 'art' && !payload.artPrompt) {
          payload.artPrompt = `Abstract calming visual about ${primaryEmotion}`;
        }
      } catch (e: any) {
        errorMessage = e?.message || 'unknown_error';
        fallbackUsed = true;
        payload.story = payload.story || 'You are capable. This difficult moment will pass; a small act of self-kindness counts.';
      }

      await reservationRef.set({
        payload,
        fallbackUsed,
        error: errorMessage,
        status: 'ready',
        updatedAt: Timestamp.now()
      }, { merge: true });

      if (entryId) {
        try { await db.collection('entries').doc(entryId).set({ capsuleReady: true, capsuleId: reservationRef.id, capsuleType }, { merge: true }); } catch {}
      }
      if (payload.story) {
        try {
          await storeCapsuleEmbedding({ capsuleId: reservationRef.id, insightId: insight.insightId, userId, type: capsuleType, text: payload.story });
        } catch {}
      }
      created++;
    }

    res.json({ ok: true, created });
  } catch (e: any) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});

// Scheduled backfill (no admin key) to keep the system healthy
export const backfillScheduled = onSchedule({ region: 'asia-south1', schedule: 'every 12 hours', timeZone: 'UTC', secrets: ['GEMINI_API_KEY'] }, async () => {
  const insightKickLimit = 200;
  const capsuleCreateLimit = 100;

  try {
    // 1) Re-kick submitted entries (idempotent)
    const entriesSnap = await db.collection('entries')
      .where('submitted', '==', true)
      .orderBy('updatedAt', 'desc')
      .limit(insightKickLimit)
      .get();
    for (const doc of entriesSnap.docs) {
      const entry: any = doc.data();
      const insSnap = await db.collection('insights').where('entryId', '==', entry.entryId).limit(1).get();
      if (!insSnap.empty) continue;
      await doc.ref.set({ backfillKick: Timestamp.now(), processed: false }, { merge: true });
    }

    // 2) Create missing capsules for recent insights
    const insightsSnap = await db.collection('insights')
      .orderBy('createdAt', 'desc')
      .limit(capsuleCreateLimit)
      .get();
    for (const ins of insightsSnap.docs) {
      const insight: any = ins.data();
      const capSnap = await db.collection('capsules').where('insightId', '==', insight.insightId).limit(1).get();
      if (!capSnap.empty) continue;

      const userId = insight.userId;
      const entryId = insight.entryId as string | undefined;
      const primaryEmotion = insight.emotions?.[0]?.label || 'neutral';
      const primaryTopic = insight.topics?.[0];
      const capsuleType = decideCapsuleType(primaryEmotion);

      const reservationRef = db.collection('capsules').doc();
      const now = Timestamp.now();
      await reservationRef.set({
        capsuleId: reservationRef.id,
        userId,
        insightId: insight.insightId,
        type: capsuleType,
        status: 'generating',
        createdAt: now,
        updatedAt: now
      });

      let payload: any = {};
      let fallbackUsed = false;
      let errorMessage: string | null = null;

      try {
        if (capsuleType === 'story') {
          const textForMatch = primaryTopic || primaryEmotion || '';
          const sim = await findSimilarCapsule(userId, textForMatch, { baseMin: 0.9 });
          if (sim.reused && sim.best) {
            const existingCapsuleSnap = await db.collection('capsules').doc(sim.best.capsuleId).get();
            if (existingCapsuleSnap.exists) {
              const existingCapsule = existingCapsuleSnap.data() as any;
              payload = { ...(existingCapsule.payload || {}), reusedFrom: sim.best.capsuleId, similarityScore: sim.best.score };
              await logSimilarityDecision({ userId, entryId: insight.insightId, reusedCapsuleId: sim.best.capsuleId, score: sim.best.score, threshold: sim.appliedThreshold, reused: true });
            }
          } else {
            await logSimilarityDecision({ userId, entryId: insight.insightId, reusedCapsuleId: undefined, score: sim.best?.score, threshold: sim.appliedThreshold, reused: false });
          }
        }

        if (!payload.story && capsuleType === 'story') {
          const topicForStory = primaryTopic || primaryEmotion || 'your feelings';
          const story = await generateStory(topicForStory);
          payload.story = clampText(story, 1200);
        }

        if (capsuleType === 'breathing' && !payload.steps) {
          payload.steps = ['Inhale 4', 'Hold 2', 'Exhale 6', 'Repeat 6x'];
        } else if (capsuleType === 'playlist' && !payload.tracks) {
          payload.tracks = ['https://youtube.com/lofi1', 'https://youtube.com/lofi2'];
        } else if (capsuleType === 'art' && !payload.artPrompt) {
          payload.artPrompt = `Abstract calming visual about ${primaryEmotion}`;
        }
      } catch (e: any) {
        errorMessage = e?.message || 'unknown_error';
        fallbackUsed = true;
        payload.story = payload.story || 'You are capable. This difficult moment will pass; a small act of self-kindness counts.';
      }

      await reservationRef.set({ payload, fallbackUsed, error: errorMessage, status: 'ready', updatedAt: Timestamp.now() }, { merge: true });

      if (entryId) {
        try { await db.collection('entries').doc(entryId).set({ capsuleReady: true, capsuleId: reservationRef.id, capsuleType }, { merge: true }); } catch {}
      }
      if (payload.story) {
        try { await storeCapsuleEmbedding({ capsuleId: reservationRef.id, insightId: insight.insightId, userId, type: capsuleType, text: payload.story }); } catch {}
      }
    }
  } catch (e) {
    console.error('[backfillScheduled] failed', e);
  }
});

// Admin-triggered backfill in asia-south1 to avoid regional quota saturation
export const backfillNow = onRequest({ region: 'asia-south1', timeoutSeconds: 540, secrets: ['GEMINI_API_KEY'] }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method Not Allowed');
    assertAdmin(req);
    const insightKickLimit = Math.min(Number(req.query.insightLimit || 200), 500);
    const capsuleCreateLimit = Math.min(Number(req.query.capsuleLimit || 100), 200);

    // Re-kick submitted entries missing insights
    let kicked = 0;
    let entriesSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
    try {
      entriesSnap = await db.collection('entries')
        .where('submitted', '==', true)
        .orderBy('updatedAt', 'desc')
        .limit(insightKickLimit)
        .get();
    } catch (e: any) {
      const msg = (e?.message || '').toLowerCase();
      if (!(msg.includes('index') || msg.includes('failed_precondition'))) throw e;
      entriesSnap = await db.collection('entries')
        .where('submitted', '==', true)
        .limit(insightKickLimit)
        .get();
    }
    for (const doc of entriesSnap.docs) {
      const entry: any = doc.data();
      const insSnap = await db.collection('insights').where('entryId', '==', entry.entryId).limit(1).get();
      if (!insSnap.empty) continue;
      await doc.ref.set({ backfillKick: Timestamp.now(), processed: false }, { merge: true });
      kicked++;
    }

    // Create missing capsules for recent insights
    let created = 0;
    const insightsSnap = await db.collection('insights')
      .orderBy('createdAt', 'desc')
      .limit(capsuleCreateLimit)
      .get();
    for (const ins of insightsSnap.docs) {
      const insight: any = ins.data();
      const capSnap = await db.collection('capsules').where('insightId', '==', insight.insightId).limit(1).get();
      if (!capSnap.empty) continue;

      const userId = insight.userId;
      const entryId = insight.entryId as string | undefined;
      const primaryEmotion = insight.emotions?.[0]?.label || 'neutral';
      const primaryTopic = insight.topics?.[0];
      const capsuleType = decideCapsuleType(primaryEmotion);

      const reservationRef = db.collection('capsules').doc();
      const now = Timestamp.now();
      await reservationRef.set({
        capsuleId: reservationRef.id,
        userId,
        insightId: insight.insightId,
        type: capsuleType,
        status: 'generating',
        createdAt: now,
        updatedAt: now
      });

      let payload: any = {};
      let fallbackUsed = false;
      let errorMessage: string | null = null;
      try {
        if (capsuleType === 'story') {
          const textForMatch = primaryTopic || primaryEmotion || '';
          const sim = await findSimilarCapsule(userId, textForMatch, { baseMin: 0.9 });
          if (sim.reused && sim.best) {
            const existingCapsuleSnap = await db.collection('capsules').doc(sim.best.capsuleId).get();
            if (existingCapsuleSnap.exists) {
              const existingCapsule = existingCapsuleSnap.data() as any;
              payload = { ...(existingCapsule.payload || {}), reusedFrom: sim.best.capsuleId, similarityScore: sim.best.score };
              await logSimilarityDecision({ userId, entryId: insight.insightId, reusedCapsuleId: sim.best.capsuleId, score: sim.best.score, threshold: sim.appliedThreshold, reused: true });
            }
          } else {
            await logSimilarityDecision({ userId, entryId: insight.insightId, reusedCapsuleId: undefined, score: sim.best?.score, threshold: sim.appliedThreshold, reused: false });
          }
        }
        if (!payload.story && capsuleType === 'story') {
          const topicForStory = primaryTopic || primaryEmotion || 'your feelings';
          const story = await generateStory(topicForStory);
          payload.story = clampText(story, 1200);
        }
        if (capsuleType === 'breathing' && !payload.steps) {
          payload.steps = ['Inhale 4', 'Hold 2', 'Exhale 6', 'Repeat 6x'];
        } else if (capsuleType === 'playlist' && !payload.tracks) {
          payload.tracks = ['https://youtube.com/lofi1', 'https://youtube.com/lofi2'];
        } else if (capsuleType === 'art' && !payload.artPrompt) {
          payload.artPrompt = `Abstract calming visual about ${primaryEmotion}`;
        }
      } catch (e: any) {
        errorMessage = e?.message || 'unknown_error';
        fallbackUsed = true;
        payload.story = payload.story || 'You are capable. This difficult moment will pass; a small act of self-kindness counts.';
      }
      await reservationRef.set({ payload, fallbackUsed, error: errorMessage, status: 'ready', updatedAt: Timestamp.now() }, { merge: true });
      if (entryId) {
        try { await db.collection('entries').doc(entryId).set({ capsuleReady: true, capsuleId: reservationRef.id, capsuleType }, { merge: true }); } catch {}
      }
      if (payload.story) {
        try { await storeCapsuleEmbedding({ capsuleId: reservationRef.id, insightId: insight.insightId, userId, type: capsuleType, text: payload.story }); } catch {}
      }
      created++;
    }

    res.json({ ok: true, kickedInsights: kicked, createdCapsules: created });
  } catch (e: any) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});

function clampText(text: string, max: number): string {
  if (!text) return '';
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastPeriod = clipped.lastIndexOf('.');
  if (lastPeriod > max * 0.6) { return clipped.slice(0, lastPeriod + 1); }
  return clipped + '...';
}
