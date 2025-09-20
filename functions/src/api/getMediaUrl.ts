import { onRequest } from 'firebase-functions/v2/https';
import { REGION } from '../config/region';
import { verifyAuth } from '../lib/auth';
import { db } from '../lib/firestore';
import { HttpError, errorResponse } from '../lib/httpError';
import * as functions from 'firebase-functions';
import { Storage } from '@google-cloud/storage';

const storage = new Storage();
const BUCKET = process.env.MEDIA_BUCKET || (functions.config()?.media?.bucket as string | undefined);

export const getMediaUrl = onRequest({ region: REGION, maxInstances: 5 }, async (req, res) => {
  // CORS headers for browser fetch/XHR as needed
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    if (!BUCKET) throw new HttpError(500, 'Storage bucket not configured', 'config_missing');

    const { uid } = await verifyAuth(req);
    const { assetId } = (req.body || {}) as { assetId?: string };
    if (!assetId) throw new HttpError(400, 'Missing assetId');

    const snap = await db.collection('mediaAssets').doc(assetId).get();
    if (!snap.exists) throw new HttpError(404, 'Asset not found');
    if (snap.get('userId') !== uid) throw new HttpError(403, 'Forbidden');
    const entryId = snap.get('entryId');
    const userId = snap.get('userId');
  const status = snap.get('status');
  if (!entryId || !userId) throw new HttpError(500, 'Corrupt asset record');
  // Allow preview when uploaded/processing or complete; block failed
  if (status === 'failed') throw new HttpError(409, 'Asset failed');

    const storagePath = `media/${userId}/${entryId}/${assetId}`;
    const file = storage.bucket(BUCKET).file(storagePath);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    res.json({ ok: true, url, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
  } catch (e: any) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});
