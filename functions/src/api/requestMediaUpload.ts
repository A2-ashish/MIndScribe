import { onRequest } from 'firebase-functions/v2/https';
import { HttpError, errorResponse } from '../lib/httpError';
import { verifyAuth } from '../lib/auth';
import { db } from '../lib/firestore';
import { REGION } from '../config/region';
import { generateAssetId, maxBytesForType, validateMime, UploadGrant, UploadRequestInput, MEDIA_PIPELINE_VERSION, nowTs } from '../lib/media';
import { Storage } from '@google-cloud/storage';
import * as functions from 'firebase-functions';
const storage = new Storage();

/**
 * requestMediaUpload
 * Returns a placeholder upload grant (signed URL integration TBD) and creates a pending mediaAssets doc.
 */
// Resolve target bucket from env (preferred) or functions config (media.bucket)
const BUCKET = process.env.MEDIA_BUCKET || (functions.config()?.media?.bucket as string | undefined);

export const requestMediaUpload = onRequest({ region: REGION, maxInstances: 5 }, async (req, res) => {
  try {
    // CORS
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const user = await verifyAuth(req);
    console.log('[requestMediaUpload] user', user.uid);

    const body: UploadRequestInput = req.body || {};
    if (!body.entryId || !body.type || !body.mime) {
      throw new HttpError(400, 'Missing required fields: entryId, type, mime');
    }
    if (!['audio','image'].includes(body.type)) throw new HttpError(400, 'Invalid type');
    if (!validateMime(body.type, body.mime)) throw new HttpError(400, 'Unsupported mime');

    // Basic entry ownership check
  const entryRef = db.collection('entries').doc(body.entryId);
    const entrySnap = await entryRef.get();
    if (!entrySnap.exists) throw new HttpError(404, 'Entry not found');
    if (entrySnap.get('userId') !== user.uid) throw new HttpError(403, 'Forbidden');
    if (entrySnap.get('processed') === true) throw new HttpError(409, 'Entry already processed');

  const assetId = generateAssetId();
    const storagePath = `media/${user.uid}/${body.entryId}/${assetId}`;
  console.log('[requestMediaUpload] storagePath', storagePath);

    const maxBytes = maxBytesForType(body.type);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Quota placeholder: future implement counters (daily) per user in rateLimits or dedicated doc
  // if (exceedsQuota) throw new HttpError(429, 'Media quota exceeded');

    // Placeholder upload URL (future: signed URL via GCS admin SDK or callable)
    // Generate a signed URL for PUT upload
  const bucketName = BUCKET;
  if (!bucketName) throw new HttpError(500, 'Storage bucket not configured', 'config_missing');
    console.log('[requestMediaUpload] bucket', bucketName, 'mime', body.mime);
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(storagePath);
    let url: string;
    try {
      const extensionHeaders: Record<string, string> = {
        'x-goog-meta-userId': user.uid,
        'x-goog-meta-entryId': body.entryId,
        'x-goog-meta-type': body.type,
        'x-goog-meta-assetId': assetId,
      };
      const [signed] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType: body.mime,
        extensionHeaders,
      });
      url = signed;
    } catch (err: any) {
      console.error('[requestMediaUpload] getSignedUrl failed', err?.message || err, err?.code, err?.errors);
      throw new HttpError(500, 'Internal Error', 'sign_url_failed', { message: err?.message || String(err), code: err?.code, errors: err?.errors });
    }
    const uploadUrl = url;
    console.log('[requestMediaUpload] signedUrl generated');

    const mediaDoc = {
      assetId,
      userId: user.uid,
      entryId: body.entryId,
      type: body.type,
      mime: body.mime,
      status: 'pending',
      sizeBytes: body.sizeBytes || 0,
      createdAt: nowTs(),
      updatedAt: nowTs(),
      version: MEDIA_PIPELINE_VERSION,
    };

    await db.collection('mediaAssets').doc(assetId).set(mediaDoc);

    const grant: UploadGrant = {
      assetId,
      uploadUrl,
      storagePath,
      headers: {
        'Content-Type': body.mime,
        'x-goog-meta-userId': user.uid,
        'x-goog-meta-entryId': body.entryId,
        'x-goog-meta-type': body.type,
        'x-goog-meta-assetId': assetId,
      },
      expiresAt,
      maxBytes,
    };

    res.json({ ok: true, grant });
  } catch (e: any) {
    console.error('[requestMediaUpload] error', e?.message || e, e?.stack || '');
    const err = e instanceof HttpError
      ? e
      : new HttpError(500, 'Internal Error', 'internal', { message: e?.message || String(e) });
    const formatted = errorResponse(err);
    res.status(formatted.status).json(formatted.body);
  }
});
