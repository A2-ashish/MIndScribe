import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../lib/firestore';
import { EMBEDDING_VERSION, embedText } from '../lib/embeddings';
import { HttpError, errorResponse } from '../lib/httpError';
import { REGION } from '../config/region';

const ADMIN_KEY = process.env.ADMIN_KEY;

interface BackfillResult {
  scanned: number;
  updated: number;
  skipped: number;
  nextPageAfter?: string;
}

export const reembedEntries = onRequest({ region: REGION, timeoutSeconds: 300, memory: '512MiB', secrets: ['GEMINI_API_KEY'] }, async (req, res) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const headerKey = req.headers['x-admin-key'];
    if (!ADMIN_KEY || headerKey !== ADMIN_KEY) throw new HttpError(403, 'Forbidden');

    const { limit = 25, after, dryRun = false } = req.body || {};
    if (limit < 1 || limit > 100) throw new HttpError(400, 'Invalid limit');

    let query = db.collection('entries').orderBy('createdAt', 'desc');
    if (after) {
      const afterSnap = await db.collection('entries').doc(after).get();
      if (!afterSnap.exists) throw new HttpError(400, 'Invalid after cursor');
      query = query.startAfter(afterSnap);
    }
    query = query.limit(limit);
    const snap = await query.get();

    let scanned = 0, updated = 0, skipped = 0; let lastId: string | undefined;
    for (const doc of snap.docs) {
      scanned++; lastId = doc.id;
      const entry: any = doc.data();
      const text = (entry?.text || '').toString();
      if (!text.trim()) { skipped++; continue; }
      const embSnap = await db.collection('entryEmbeddings').doc(doc.id).get();
      const needs = !embSnap.exists || embSnap.get('version') !== EMBEDDING_VERSION;
      if (!needs) { skipped++; continue; }
      if (dryRun) { updated++; continue; }
      const emb = await embedText(text);
      await db.collection('entryEmbeddings').doc(doc.id).set({
        entryId: doc.id,
        userId: entry.userId,
        vector: emb.vector,
        dims: emb.dims,
        model: emb.model,
        version: EMBEDDING_VERSION,
        createdAt: new Date(),
      }, { merge: true });
      updated++;
    }

    const result: BackfillResult = { scanned, updated, skipped, nextPageAfter: lastId };
    res.json({ ok: true, result });
  } catch (e: any) {
    const err = e instanceof HttpError ? e : new HttpError(500, 'Internal Error');
    const formatted = errorResponse(err);
    res.status(formatted.status).json(formatted.body);
  }
});
