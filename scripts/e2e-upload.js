/*
 End-to-end media upload test without requiring ADC.
 - Signs in anonymously via Firebase Auth REST (using API key)
 - Creates a new entry via submitEntry function
 - Requests a media upload grant via requestMediaUpload
 - Uploads a tiny buffer to the signed URL

 Env overrides (optional):
   FIREBASE_API_KEY
   FUNCTION_SUBMIT_ENTRY_URL
   FUNCTION_REQUEST_MEDIA_UPLOAD_URL
   TEST_TYPE (image|audio)
   TEST_MIME (default image/png)
*/
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

function loadDotEnvLocal() {
  const file = path.join(__dirname, '..', 'frontend', '.env.local');
  if (!fs.existsSync(file)) return {};
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      out[key] = val;
    }
  }
  return out;
}

async function signInAnonymously(apiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anonymous sign-in failed: ${res.status} ${text}`);
  const json = JSON.parse(text);
  if (!json.idToken) throw new Error('No idToken in signIn response');
  return { idToken: json.idToken, uid: json.localId };
}

async function submitEntry(url, idToken) {
  const body = { text: `E2E test ${new Date().toISOString()}` };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`submitEntry failed: ${res.status} ${text}`);
  const json = JSON.parse(text);
  if (!json.entryId) throw new Error('No entryId in submitEntry response');
  return json.entryId;
}

async function requestGrant(url, idToken, entryId, type, mime) {
  const body = { entryId, type, mime, sizeBytes: 128 };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    // If entry already processed (race), signal caller to create a fresh one
    try {
      const err = JSON.parse(text);
      if (res.status === 409 && err && err.error && /already processed/i.test(err.error)) {
        return { retryWithNewEntry: true };
      }
    } catch {}
    throw new Error(`requestMediaUpload failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text);
  const grant = json && json.grant;
  if (!grant || !grant.uploadUrl) throw new Error('Invalid grant response');
  return { grant };
}

async function putSigned(url, headers, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...(headers || {}), 'Content-Type': headers?.['Content-Type'] || 'application/octet-stream' },
    body
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PUT to signed URL failed: ${res.status} ${text}`);
  return true;
}

(async () => {
  const env = loadDotEnvLocal();
  const API_KEY = process.env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY;
  const SUBMIT_URL = process.env.FUNCTION_SUBMIT_ENTRY_URL || env.VITE_FUNCTION_SUBMIT_ENTRY_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/submitEntry';
  const REQ_UPLOAD_URL = process.env.FUNCTION_REQUEST_MEDIA_UPLOAD_URL || env.VITE_FUNCTION_REQUEST_MEDIA_UPLOAD_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/requestMediaUpload';
  const TYPE = process.env.TEST_TYPE || 'image';
  const MIME = process.env.TEST_MIME || (TYPE === 'audio' ? 'audio/mpeg' : 'image/png');

  if (!API_KEY) {
    console.error('Missing FIREBASE_API_KEY and no VITE_FIREBASE_API_KEY found in frontend/.env.local');
    process.exit(1);
  }

  console.log('Signing in anonymously...');
  const { idToken, uid } = await signInAnonymously(API_KEY);
  console.log('UID:', uid.slice(0,8) + '…');

  console.log('Creating entry via submitEntry...');
  const entryId = await submitEntry(SUBMIT_URL, idToken);
  console.log('Entry ID:', entryId);

  console.log('Requesting upload grant...');
  let { grant, retryWithNewEntry } = await requestGrant(REQ_UPLOAD_URL, idToken, entryId, TYPE, MIME);
  if (retryWithNewEntry) {
    console.log('Entry was already processed, creating a new one and retrying...');
    const newEntryId = await submitEntry(SUBMIT_URL, idToken);
    console.log('New Entry ID:', newEntryId);
    entryId = newEntryId;
    ({ grant } = await requestGrant(REQ_UPLOAD_URL, idToken, entryId, TYPE, MIME));
  }
  console.log('Grant received for asset:', grant.assetId);

  const sample = TYPE === 'audio' ? Buffer.from([0x52,0x49,0x46,0x46]) : Buffer.from([0x89,0x50,0x4e,0x47]);
  console.log('Uploading tiny payload to signed URL...');
  await putSigned(grant.uploadUrl, grant.headers, sample);
  console.log('Upload OK:', { assetId: grant.assetId, entryId, storagePath: grant.storagePath });
})();
