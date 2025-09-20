import { db } from '../firebaseCore';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';

export type UserCounts = {
  entries: number;
  insights: number;
  capsules: number;
};

export async function getUserCounts(uid: string): Promise<UserCounts> {
  const entriesQ = query(collection(db, 'entries'), where('uid', '==', uid));
  const insightsQ = query(collection(db, 'insights'), where('uid', '==', uid));
  const capsulesQ = query(collection(db, 'capsules'), where('uid', '==', uid));

  const [e, i, c] = await Promise.all([
    getCountFromServer(entriesQ).catch(() => ({ data: () => ({ count: 0 }) } as any)),
    getCountFromServer(insightsQ).catch(() => ({ data: () => ({ count: 0 }) } as any)),
    getCountFromServer(capsulesQ).catch(() => ({ data: () => ({ count: 0 }) } as any)),
  ]);

  // Firestore returns { data().count }
  const entries = (e as any)?.data?.().count ?? 0;
  const insights = (i as any)?.data?.().count ?? 0;
  const capsules = (c as any)?.data?.().count ?? 0;

  return { entries, insights, capsules };
}
