import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../lib/firestore';
import { verifyAuth } from '../lib/auth';
import { HttpError, errorResponse } from '../lib/httpError';
import { Timestamp } from 'firebase-admin/firestore';

export const createDraftEntry = onRequest({ region: 'asia-south2' }, async (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method Not Allowed');
    const { uid } = await verifyAuth(req);
    const ref = db.collection('entries').doc();
    await ref.set({
      entryId: ref.id,
      userId: uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      processed: false,
      submitted: false
    });
    res.json({ ok: true, entryId: ref.id });
  } catch (e: any) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});
