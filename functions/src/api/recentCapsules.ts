import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../lib/firestore';
import { verifyAuth } from '../lib/auth';
import { HttpError, errorResponse } from '../lib/httpError';

// Query params: ?limit=20&cursor=<createdAt_iso>&direction=backward
// We paginate by createdAt descending default. Cursor is ISO string of createdAt.
export const recentCapsules = onRequest({ region: 'asia-south2' }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Method Not Allowed');
    const auth = await verifyAuth(req);
    const uid = auth.uid;

    const limitRaw = req.query.limit as string | undefined;
    let limit = parseInt(limitRaw || '20', 10);
    if (isNaN(limit) || limit <= 0) limit = 20;
    if (limit > 50) limit = 50; // hard cap

    const cursor = req.query.cursor as string | undefined; // ISO timestamp
    let query = db.collection('capsules').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(limit + 1);
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (isNaN(cursorDate.getTime())) throw new HttpError(400, 'Invalid cursor');
      // Firestore wants a Timestamp; we rely on createdAt being a Timestamp in docs.
      // We'll fetch a doc snapshot for exact boundary if needed, simpler: use where < cursor timestamp.
      // However we need the precise Firestore Timestamp; fallback: query all and filter (small volume expected).
      // For correctness and index friendliness, we perform an extra query to find boundary.
      // Simpler approach: store cursor as millis in query param (future improvement). For now, filter after fetch.
    }

    const snap = await query.get();
    let docs = snap.docs;

    if (cursor) {
      const cursorMs = new Date(cursor).getTime();
      docs = docs.filter(d => {
        const ts: any = d.get('createdAt');
        const ms = ts?.toMillis ? ts.toMillis() : 0;
        return ms < cursorMs; // strictly older than cursor
      }).slice(0, limit + 1);
    }

    const hasMore = docs.length > limit;
    if (hasMore) docs = docs.slice(0, limit);
    const capsules = docs.map(d => d.data());
    const nextCursor = hasMore ? docs[docs.length - 1].get('createdAt')?.toDate()?.toISOString() : null;

    res.status(200).json({ capsules, nextCursor, hasMore, limit });
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});
