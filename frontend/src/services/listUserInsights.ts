import { collection, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../firebaseCore';

export type InsightDoc = {
  insightId: string;
  entryId: string;
  userId: string;
  createdAt?: any;
  summary?: string;
  emotions?: any;
  sentiment?: { compound?: number };
  risk?: { suicidal?: number; self_harm?: number; violence?: number };
};

export type InsightsPage = {
  items: InsightDoc[];
  nextCursor: any | null; // createdAt of last item
};

export async function listUserInsightsPage(uid: string, pageSize = 10, startAfterCreatedAt?: any): Promise<InsightsPage> {
  const base = [
    collection(db, 'insights'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  ] as const;
  const q = startAfterCreatedAt
    ? query(...base, startAfter(startAfterCreatedAt), limit(pageSize))
    : query(...base, limit(pageSize));
  const snaps = await getDocs(q);
  const items = snaps.docs.map(d => d.data() as InsightDoc);
  const last = snaps.docs[snaps.docs.length - 1]?.data() as InsightDoc | undefined;
  return { items, nextCursor: last?.createdAt ?? null };
}
