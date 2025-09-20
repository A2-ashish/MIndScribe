import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../lib/firestore';
import { EMBEDDING_VERSION, embedText } from '../lib/embeddings';
import { HttpError, errorResponse } from '../lib/httpError';
import { REGION } from '../config/region';

// Environment variable that stores the expected admin key.
// Set in deployment environment: e.g., firebase functions:config:set admin.key="YOUR_KEY"
const ADMIN_KEY = process.env.ADMIN_KEY;

interface BackfillResult {
  scanned: number;
  updated: number;
  skipped: number;
  nextPageAfter?: string; // last capsuleId processed for pagination
}

export const reembedCapsules = onRequest({ region: REGION, timeoutSeconds: 300, memory: '512MiB' }, async (req, res) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');

    const headerKey = req.headers['x-admin-key'];
    if (!ADMIN_KEY || headerKey !== ADMIN_KEY) {
      throw new HttpError(403, 'Forbidden');
    }

    const { limit = 25, after, dryRun = false } = req.body || {};
    if (limit < 1 || limit > 100) throw new HttpError(400, 'Invalid limit');

    // Strategy: query recent capsules; for each, check embedding doc
    let query = db.collection('capsules').orderBy('createdAt', 'desc');
    if (after) {
      const afterSnap = await db.collection('capsules').doc(after).get();
      if (!afterSnap.exists) throw new HttpError(400, 'Invalid after cursor');
      query = query.startAfter(afterSnap);
    }
    query = query.limit(limit);
    const capsSnap = await query.get();

    let scanned = 0, updated = 0, skipped = 0; let lastId: string | undefined;

    for (const doc of capsSnap.docs) {
      scanned++; lastId = doc.id;
      const capsule: any = doc.data();
      if (!capsule?.payload?.story) { skipped++; continue; }
      const embSnap = await db.collection('capsuleEmbeddings').doc(doc.id).get();
      const needs = !embSnap.exists || embSnap.get('version') !== EMBEDDING_VERSION;
      if (!needs) { skipped++; continue; }
      if (dryRun) { updated++; continue; }
      try {
        const emb = await embedText(capsule.payload.story);
        await db.collection('capsuleEmbeddings').doc(doc.id).set({
          capsuleId: doc.id,
          insightId: capsule.insightId,
          userId: capsule.userId,
          type: capsule.type,
          vector: emb.vector,
          dims: emb.dims,
          model: emb.model,
          version: EMBEDDING_VERSION,
          createdAt: new Date()
        }, { merge: true });
        updated++;
      } catch (e) {
        skipped++;
      }
    }

    const result: BackfillResult = { scanned, updated, skipped, nextPageAfter: lastId };
    res.json({ ok: true, result });
  } catch (e: any) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'Internal Error');
    const formatted = errorResponse(err);
    res.status(formatted.status).json(formatted.body);
  }
});
