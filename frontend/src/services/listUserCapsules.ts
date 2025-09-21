import { collection, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../firebaseCore';

export type CapsuleDoc = {
  capsuleId: string;
  insightId: string;
  userId: string;
  summary?: string;
  type?: string;
  content?: string;
  payload?: any;
  createdAt?: any;
};

export type CapsulesPage = {
  items: CapsuleDoc[];
  nextCursor: any | null; // createdAt of last item
};

export async function listUserCapsulesPage(uid: string, pageSize = 5, startAfterCreatedAt?: any): Promise<CapsulesPage> {
  const base = [
    collection(db, 'capsules'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  ] as const;
  const q = startAfterCreatedAt
    ? query(...base, startAfter(startAfterCreatedAt), limit(pageSize))
    : query(...base, limit(pageSize));
  const snaps = await getDocs(q);
  const items = snaps.docs.map(d => d.data() as CapsuleDoc);
  const last = snaps.docs[snaps.docs.length - 1]?.data() as CapsuleDoc | undefined;
  return { items, nextCursor: last?.createdAt ?? null };
}
