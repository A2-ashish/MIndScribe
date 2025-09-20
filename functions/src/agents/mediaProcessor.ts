import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { REGION } from '../config/region';
import { db } from '../lib/firestore';
import { MEDIA_PIPELINE_VERSION, nowTs } from '../lib/media';
import { transcribeAudioPlaceholder, generateImageLabelsAndCaptionPlaceholder } from '../lib/mediaProcessing';

// Note: Do NOT bind to a specific bucket at deploy time to avoid region lookup errors
// when a default Firebase Storage bucket does not exist. Instead, filter events at runtime.
export const onMediaUploaded = onObjectFinalized({ region: REGION, cpu: 1 }, async (event) => {
  const TARGET_BUCKET = process.env.MEDIA_BUCKET; // e.g. "mindscribe-472408-media"
  if (!TARGET_BUCKET) {
    // Configuration missing; skip processing gracefully (avoid deploy-time failure)
    console.warn('MEDIA_BUCKET environment variable not set; skipping media processing for this event');
    return;
  }

  const { name, contentType, metadata } = event.data || {} as any;
  // Only handle events from the configured media bucket
  if (event.data?.bucket !== TARGET_BUCKET) return;
  if (!name || !metadata) return; // ignore
  // Expect path: media/{uid}/{entryId}/{assetId}
  if (!name.startsWith('media/')) return; // not a media asset
  const parts = name.split('/');
  if (parts.length !== 4) return; // media, uid, entryId, assetId
  const [, userId, entryId, assetId] = parts;

  const assetRef = db.collection('mediaAssets').doc(assetId);
  const snap = await assetRef.get();
  if (!snap.exists) {
    // Create minimal doc; mark processing
    await assetRef.set({
      assetId,
      userId,
      entryId,
      type: metadata?.type || 'unknown',
      mime: contentType || 'application/octet-stream',
      status: 'processing',
      sizeBytes: event.data?.size || 0,
      createdAt: nowTs(),
      updatedAt: nowTs(),
      version: MEDIA_PIPELINE_VERSION,
    }, { merge: true });
  } else {
    await assetRef.update({ status: 'processing', updatedAt: nowTs() });
  }

  try {
    if (metadata?.type === 'audio') {
      const { transcript, confidence } = await transcribeAudioPlaceholder(name, contentType || 'audio/unknown');
      await assetRef.update({
        transcript,
        transcriptConfidence: confidence,
        status: 'complete',
        updatedAt: nowTs(),
      });
    } else if (metadata?.type === 'image') {
      const { labels, caption } = await generateImageLabelsAndCaptionPlaceholder(name, contentType || 'image/unknown');
      await assetRef.update({
        labels,
        caption,
        status: 'complete',
        updatedAt: nowTs(),
      });
    } else {
      // Unknown type: mark failed
      await assetRef.update({ status: 'failed', error: 'unsupported_type', updatedAt: nowTs() });
    }
  } catch (e) {
    await assetRef.update({ status: 'failed', error: (e as Error).message, updatedAt: nowTs() });
  }
});
