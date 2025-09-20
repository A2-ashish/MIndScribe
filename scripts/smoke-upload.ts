import fetch from 'node-fetch';

// Simple smoke test: hit requestMediaUpload, then PUT to the signed URL
// Requires: a valid TEST_ID_TOKEN (Firebase Auth) for Authorization

const API_URL = process.env.TEST_REQUEST_UPLOAD_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/requestMediaUpload';
const USER_TOKEN = process.env.TEST_ID_TOKEN || '';
const ENTRY_ID = process.env.TEST_ENTRY_ID || '';
const TYPE = process.env.TEST_TYPE || 'image';
const MIME = process.env.TEST_MIME || 'image/png';

async function main() {
  if (!USER_TOKEN || !ENTRY_ID) {
    console.error('Missing TEST_ID_TOKEN or TEST_ENTRY_ID env');
    process.exit(1);
  }

  // Prepare the request body
  const body = {
    entryId: ENTRY_ID,
    type: TYPE,
    mime: MIME,
    sizeBytes: 128, // tiny sample
  };

  // Call requestMediaUpload
  const req = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${USER_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!req.ok) {
    const txt = await req.text();
    throw new Error(`requestMediaUpload failed: ${req.status} ${txt}`);
  }

  const json: any = await req.json();
  if (!json?.grant?.uploadUrl) throw new Error('No uploadUrl in response');
  const { uploadUrl, headers, assetId, storagePath } = json.grant;

  // Create a tiny in-memory buffer
  const sample = TYPE === 'audio' ? Buffer.from([0x52,0x49,0x46,0x46]) : Buffer.from([0x89,0x50,0x4e,0x47]);

  // Upload to signed URL
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': MIME,
      ...(headers || {})
    },
    body: sample
  });

  if (!put.ok) {
    const txt = await put.text();
    throw new Error(`PUT to signed URL failed: ${put.status} ${txt}`);
  }

  console.log('Signed URL upload OK:', { assetId, storagePath });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
