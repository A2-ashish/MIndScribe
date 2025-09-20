const fetch = require('node-fetch');

const API_URL = process.env.TEST_REQUEST_UPLOAD_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/requestMediaUpload';
const SUBMIT_URL = process.env.TEST_SUBMIT_ENTRY_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/submitEntry';
const USER_TOKEN = process.env.TEST_ID_TOKEN || '';
let ENTRY_ID = process.env.TEST_ENTRY_ID || '';
const TYPE = process.env.TEST_TYPE || 'image';
const MIME = process.env.TEST_MIME || 'image/png';

async function createEntry() {
  const text = `Smoke test entry ${new Date().toISOString()}`;
  const resp = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${USER_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`submitEntry failed: ${resp.status} ${t}`);
  }
  const j = await resp.json();
  if (!j || !j.entryId) throw new Error('submitEntry did not return entryId');
  return j.entryId;
}

async function requestUpload(entryId) {
  const body = { entryId, type: TYPE, mime: MIME, sizeBytes: 128 };
  const req = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${USER_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await req.text();
  if (!req.ok) {
    // Try to parse structured error for 409/processed cases
    try {
      const err = JSON.parse(text);
      if (req.status === 409 && err && err.error && /already processed/i.test(err.error)) {
        return { retryWithNewEntry: true };
      }
    } catch {}
    throw new Error(`requestMediaUpload failed: ${req.status} ${text}`);
  }
  const json = JSON.parse(text);
  const grant = json && json.grant;
  if (!grant || !grant.uploadUrl) throw new Error('No uploadUrl in response');
  return { grant };
}

async function main() {
  if (!USER_TOKEN) {
    console.error('Missing TEST_ID_TOKEN env');
    process.exit(1);
  }

  // Ensure we have a fresh entry if none provided
  if (!ENTRY_ID) {
    ENTRY_ID = await createEntry();
    console.log('Created entry:', ENTRY_ID);
  }

  let { grant, retryWithNewEntry } = await requestUpload(ENTRY_ID);
  if (retryWithNewEntry) {
    ENTRY_ID = await createEntry();
    console.log('Previous entry was processed; created new entry:', ENTRY_ID);
    ({ grant } = await requestUpload(ENTRY_ID));
  }

  const { uploadUrl, headers, assetId, storagePath } = grant;
  const sample = TYPE === 'audio' ? Buffer.from([0x52,0x49,0x46,0x46]) : Buffer.from([0x89,0x50,0x4e,0x47]);

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
  console.log('Signed URL upload OK:', { assetId, storagePath, entryId: ENTRY_ID });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
