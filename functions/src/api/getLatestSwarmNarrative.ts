import { onRequest } from 'firebase-functions/v2/https';
import { REGION } from '../config/region';
import { db } from '../lib/firestore';
import { errorResponse, HttpError } from '../lib/httpError';

export const getLatestSwarmNarrative = onRequest({ region: REGION }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Method Not Allowed');

    const snap = await db.collection('swarmNarratives')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {
      res.status(200).json({ id: null, createdAt: null, narrative: '', snapshotRef: null });
      return;
    }

    const doc = snap.docs[0];
    const data: any = doc.data();
    res.status(200).json({
      id: doc.id,
      createdAt: data?.createdAt?.toDate?.()?.toISOString?.() || null,
      narrative: data?.narrative || '',
      snapshotRef: data?.snapshotRef || null,
    });
  } catch (e) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});
