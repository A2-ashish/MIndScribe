import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../lib/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyAuth } from '../lib/auth';
import { enforceRateLimit } from '../lib/rateLimit';
import { HttpError, errorResponse } from '../lib/httpError';
import { moderatePlainText } from '../lib/moderation';

export const submitEntry = onRequest(
  { region: 'asia-south2' },
  async (req, res): Promise<void> => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Method Not Allowed');
      if (!req.is('application/json')) throw new HttpError(400, 'Expected application/json');

      const auth = await verifyAuth(req);
      const uid = auth.uid;

      await enforceRateLimit(uid, 'entrySubmit');

  const { text, entryId: providedId } = (req.body || {}) as { text?: string; entryId?: string };
  if (!text || text.trim().length < 3) throw new HttpError(400, 'Journal text too short');

      const flags = moderatePlainText(text);
      // Policy: Allow submission unless enforcement is explicitly set to HARD.
      // This ensures high‑risk entries still generate insights/capsules in soft/off modes.
      const CLASSIFIER_ENFORCE = (process.env.CLASSIFIER_ENFORCE || 'off').toLowerCase();
      const enforcement: 'off'|'soft'|'hard' = (CLASSIFIER_ENFORCE === 'soft' || CLASSIFIER_ENFORCE === 'hard') ? (CLASSIFIER_ENFORCE as any) : 'off';
      if (flags.selfHarm && enforcement === 'hard') {
        throw new HttpError(400, 'Content indicates self-harm intent; please reach out for immediate help.', 'moderation_self_harm');
      }

      if (providedId) {
        // Submit existing draft if owned by user
        const ref = db.collection('entries').doc(providedId);
        const snap = await ref.get();
        if (!snap.exists) throw new HttpError(404, 'Entry not found');
        if (snap.get('userId') !== uid) throw new HttpError(403, 'Forbidden');
        await ref.update({
          text: text.trim(),
          submitted: true,
          moderation: flags,
          updatedAt: Timestamp.now()
        });
        res.status(200).json({ status: 'ok', entryId: providedId });
      } else {
        // Create new submitted entry
        const ref = db.collection('entries').doc();
        await ref.set({
          entryId: ref.id,
          userId: uid,
          text: text.trim(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          processed: false,
          submitted: true,
          moderation: flags,
          // For visibility in the UI/ops when high-risk content is allowed to proceed
          requiresHumanReview: flags.selfHarm || flags.violence || false
        });
        res.status(200).json({ status: 'ok', entryId: ref.id });
      }
    } catch (err: any) {
      const { status, body } = errorResponse(err);
      if (body?.code === 'rate_limit' && body.details?.retryAfterMs) {
        const retryAfterSec = Math.ceil(body.details.retryAfterMs / 1000);
        res.setHeader('Retry-After', String(retryAfterSec));
      }
      res.status(status).json(body);
    }
  }
);