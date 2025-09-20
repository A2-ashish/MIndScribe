import { auth, ensureUser } from '../auth';
import {
  doc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebaseCore';

// Fallback: direct Firestore write ONLY IF function URL missing (dev only)
async function fallbackDirectWrite(text: string) {
  const user = await ensureUser();
  const entryId = crypto.randomUUID();
  await setDoc(doc(db, 'entries', entryId), {
    entryId,
    userId: user.uid,
    text,
    createdAt: Date.now(),
    processed: false,
    // serverTimestamp() optional if you need Firestore time
    createdAtServer: serverTimestamp()
  });
  return { entryId, fallback: true };
}

export async function submitEntry(text: string, entryId?: string): Promise<{ entryId: string; fallback?: boolean }> {
  if (text.trim().length < 3) {
    throw new Error('Entry too short.');
  }
  const fnUrl = import.meta.env.VITE_FUNCTION_SUBMIT_ENTRY_URL;
  if (!fnUrl) {
    console.warn('No function URL configured – using direct Firestore DEV fallback.');
    return fallbackDirectWrite(text);
  }

  const user = await ensureUser();
  const token = await user.getIdToken();
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type':'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ text, entryId })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`submitEntry failed (${res.status}) ${body}`);
  }
  return res.json();
}