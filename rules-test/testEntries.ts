import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';

async function main() {
  // Emulator-friendly config (apiKey etc. are arbitrary in emulator mode)
  const app = initializeApp({
    apiKey: 'demo',
    projectId: 'demo-project',
  });

  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');

  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080); // change port if you changed it

  await signInAnonymously(auth);
  console.log('Signed in anonymously as', auth.currentUser?.uid);

  // 1. Valid entry
  await setDoc(doc(db, 'entries', 'e_valid'), {
    entryId: 'e_valid',
    userId: auth.currentUser?.uid,
    text: 'Feeling alright today.',
    createdAt: Date.now(),
    processed: false
  });
  console.log('Valid entry write: OK');

  // 2. Invalid (processed true)
  try {
    await setDoc(doc(db, 'entries', 'e_bad'), {
      entryId: 'e_bad',
      userId: auth.currentUser?.uid,
      text: 'Trying to sneak processed true',
      createdAt: Date.now(),
      processed: true
    });
    console.error('ERROR: processed=true entry was allowed (should be blocked)');
  } catch {
    console.log('Correctly blocked processed=true');
  }

  // 3. Direct insight (should fail)
  try {
    await setDoc(doc(db, 'insights', 'i_direct'), {
      insightId: 'i_direct',
      userId: auth.currentUser?.uid,
      emotions: []
    });
    console.error('ERROR: direct insight write succeeded (should be blocked)');
  } catch {
    console.log('Correctly blocked direct insight write');
  }

  console.log('Done.');
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});