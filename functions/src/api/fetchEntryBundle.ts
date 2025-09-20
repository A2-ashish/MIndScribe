import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../lib/firestore';
import { verifyAuth } from '../lib/auth';

interface BundleResponse {
  entry?: any;
  insight?: any;
  capsule?: any;
  alerts?: any[];
  twin?: any;
}

export const fetchEntryBundle = onRequest({ region: 'asia-south2' }, async (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).send('Method Not Allowed'); return; }

  let uid: string;
  try {
    const auth = await verifyAuth(req);
    uid = auth.uid;
  } catch (e: any) {
    res.status(e.status || 401).json({ error: e.message || 'Unauthorized' });
    return;
  }

  const entryId = (req.query.entryId || '').toString();
  if (!entryId) { res.status(400).json({ error: 'Missing entryId' }); return; }

  const entrySnap = await db.collection('entries').doc(entryId).get();
  if (!entrySnap.exists) { res.status(404).json({ error: 'Entry not found' }); return; }
  const entry = entrySnap.data();
  if (entry?.userId !== uid) { res.status(403).json({ error: 'Forbidden' }); return; }

  const insightSnap = await db.collection('insights').where('entryId', '==', entryId).limit(1).get();
  const insight = insightSnap.empty ? undefined : insightSnap.docs[0].data();

  let capsule: any = undefined;
  if (insight?.insightId) {
    const capsuleSnap = await db.collection('capsules').where('insightId', '==', insight.insightId).limit(1).get();
    capsule = capsuleSnap.empty ? undefined : capsuleSnap.docs[0].data();
  }

  const alertsSnap = insight?.insightId ? await db.collection('alerts').where('insightId', '==', insight.insightId).get() : null;
  const alerts = alertsSnap ? alertsSnap.docs.map(d => d.data()) : [];

  const twinSnap = await db.collection('twinStates').doc(uid).get();
  const twin = twinSnap.exists ? twinSnap.data() : undefined;

  const bundle: BundleResponse = { entry, insight, capsule, alerts, twin };
  res.status(200).json(bundle);
});
