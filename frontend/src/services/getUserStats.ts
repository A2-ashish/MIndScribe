import { db } from '../firebaseCore';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

export type UserStats = {
  lastEntryAt: string | null; // ISO string when available
  mediaCount: number;
};

export async function getUserStats(uid: string): Promise<UserStats> {
  let lastEntryAt: string | null = null;
  let mediaCount = 0;

  try {
    const lastEntryQ = query(collection(db, 'entries'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(lastEntryQ);
    const doc = snap.docs[0];
    if (doc) {
      const d = doc.data() as any;
      const ts = d.createdAt;
      if (ts?.toDate) lastEntryAt = ts.toDate().toISOString();
      else if (typeof ts === 'string') lastEntryAt = ts;
    }
  } catch (_) {
    // ignore
  }

  try {
    const mediaQ = query(collection(db, 'mediaAssets'), where('userId', '==', uid));
    const cnt = await getCountFromServer(mediaQ);
    mediaCount = (cnt as any)?.data?.().count ?? 0;
  } catch (_) {
    // ignore
  }

  return { lastEntryAt, mediaCount };
}
