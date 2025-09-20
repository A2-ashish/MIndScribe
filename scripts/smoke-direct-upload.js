const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');

// Smoke test: directly upload a tiny object to GCS to trigger onMediaUploaded
// This bypasses requestMediaUpload and does not require a Firebase ID token.
// Prereq: Application Default Credentials (ADC) available on this machine.
// If needed, run: gcloud auth application-default login

const BUCKET = process.env.MEDIA_BUCKET || 'mindscribe-472408-media';
const ENTRY_ID = process.env.TEST_ENTRY_ID || '';
const UID = process.env.TEST_UID || 'smoke-tester';
const TYPE = process.env.TEST_TYPE || 'image'; // 'image' or 'audio'
const MIME = process.env.TEST_MIME || (TYPE === 'audio' ? 'audio/mpeg' : 'image/png');

async function main() {
  if (!ENTRY_ID) {
    console.error('Missing TEST_ENTRY_ID. Set env TEST_ENTRY_ID to an existing or dummy entry id.');
    process.exit(1);
  }
  const storage = new Storage();
  const bucket = storage.bucket(BUCKET);
  const assetId = `smoke_${crypto.randomBytes(6).toString('hex')}`;
  const storagePath = `media/${UID}/${ENTRY_ID}/${assetId}`;
  const file = bucket.file(storagePath);

  const sample = TYPE === 'audio' ? Buffer.from([0x52,0x49,0x46,0x46]) : Buffer.from([0x89,0x50,0x4e,0x47]);

  await file.save(sample, {
    contentType: MIME,
    metadata: {
      contentType: MIME,
      metadata: {
        userId: UID,
        entryId: ENTRY_ID,
        type: TYPE,
        assetId: assetId,
      }
    }
  });

  console.log('Direct upload OK ->', `gs://${BUCKET}/${storagePath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
