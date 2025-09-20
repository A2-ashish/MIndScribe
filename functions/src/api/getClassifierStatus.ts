import { onRequest } from 'firebase-functions/v2/https';
import { verifyAuth } from '../lib/auth';
import { db } from '../lib/firestore';
import { HttpError, errorResponse } from '../lib/httpError';
import { CLASSIFIER_MODEL_VERSION } from '../lib/classifier';
import { REGION } from '../config/region';

const ADMIN_KEY = process.env.ADMIN_KEY;

export const getClassifierStatus = onRequest({ region: REGION }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Method Not Allowed');

    // Default: authenticated user's recent decisions
    const auth = await verifyAuth(req);
    let uid = auth.uid;

    // Admin override to inspect a specific user
    const maybeAdminKey = req.headers['x-admin-key'];
    const overrideUser = (req.query.userId || '').toString();
    if (ADMIN_KEY && maybeAdminKey === ADMIN_KEY && overrideUser) {
      uid = overrideUser;
    }

    const path = (process.env.CLASSIFIER_PATH || 'gemini');
    const enforce = (process.env.CLASSIFIER_ENFORCE || 'off');

    let decisions: any[] = [];
    try {
      const snap = await db.collection('classifierDecisions')
        .where('userId', '==', uid)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      decisions = snap.docs.map(d => d.data());
    } catch (err) {
      const snap = await db.collection('classifierDecisions')
        .where('userId', '==', uid)
        .limit(10)
        .get();
      decisions = snap.docs.map(d => d.data());
    }

    res.status(200).json({
      flags: { CLASSIFIER_PATH: path, CLASSIFIER_ENFORCE: enforce, CLASSIFIER_MODEL_VERSION },
      recent: decisions
    });
  } catch (e) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});
