import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
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
  guidance?: { word?: string; suggestion?: string; cta?: { label?: string; route?: string }; safety?: 'ok'|'caution'|'high-risk' };
};

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

export async function getUserRecentInsightsWithCapsules(uid: string, maxItems = 5): Promise<Array<{ insight: InsightDoc; capsule?: CapsuleDoc | undefined }>> {
  const results: Array<{ insight: InsightDoc; capsule?: CapsuleDoc | undefined }> = [];
  try {
    const iq = query(
      collection(db, 'insights'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );
    const snaps = await getDocs(iq);
    for (const d of snaps.docs) {
      const insight = d.data() as InsightDoc;
      // Try to load a capsule for this insight
      try {
        const cq = query(
          collection(db, 'capsules'),
          where('insightId', '==', insight.insightId),
          limit(1)
        );
        const cSnaps = await getDocs(cq);
        const cDoc = cSnaps.docs[0];
  const capsule = cDoc ? (cDoc.data() as CapsuleDoc) : undefined;
  results.push({ insight, capsule });
      } catch (_) {
        results.push({ insight });
      }
    }
  } catch (_) {
    // Swallow errors and return what we have
  }
  return results;
}
