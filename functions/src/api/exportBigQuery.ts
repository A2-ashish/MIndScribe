import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../lib/firestore';
import { verifyAuth } from '../lib/auth';
import { HttpError, errorResponse } from '../lib/httpError';
import { REGION } from '../config/region';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';

const ADMIN_KEY = process.env.ADMIN_KEY;
const BQ_DATASET = process.env.BQ_DATASET || 'analytics';
const BQ_TABLE_INSIGHTS = process.env.BQ_TABLE_INSIGHTS || 'insights';
const BQ_TABLE_CAPSULES = process.env.BQ_TABLE_CAPSULES || 'capsules';
const HMAC_SECRET = process.env.HMAC_SECRET || process.env.ADMIN_KEY || '';

function hashUser(uid: string): string {
  // HMAC-SHA256 over uid using server-side secret; prefix with version for future rotations
  // If secret is missing, fall back to empty string (still non-reversible but recommend setting HMAC_SECRET)
  const h = crypto.createHmac('sha256', HMAC_SECRET);
  h.update(uid || '');
  const digest = h.digest('hex');
  // Truncate for brevity while keeping enough entropy
  return `h1_${digest.slice(0,32)}`;
}

async function exportWindow(sinceMs: number) {
  // Lazy import BigQuery to avoid heavy module graph during init/deploy analyze
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BigQuery } = require('@google-cloud/bigquery');
  const bq = new BigQuery();
  const dataset = bq.dataset(BQ_DATASET);
  const insightsTable = dataset.table(BQ_TABLE_INSIGHTS);
  const capsulesTable = dataset.table(BQ_TABLE_CAPSULES);

  const sinceTs = Timestamp.fromMillis(sinceMs);

  // Insights
  const iSnap = await db.collection('insights')
    .where('createdAt', ">=", sinceTs)
    .limit(2000)
    .get();
  const iRows = iSnap.docs.map(d => {
    const x: any = d.data();
    return {
      insightId: x.insightId || d.id,
      entryId: x.entryId || null,
      userHash: hashUser(x.userId || ''),
      createdAt: (x.createdAt?.toDate?.() || new Date()).toISOString(),
      sentiment_compound: Number(x?.sentiment?.compound || 0),
      top_emotion: (x?.emotions?.[0]?.label || 'neutral').toString(),
      risk_suicidal: Number(x?.risk?.suicidal || 0),
      risk_self_harm: Number(x?.risk?.self_harm || 0),
      risk_violence: Number(x?.risk?.violence || 0),
      enforcement: x?.enforcement || 'off'
    };
  });
  let iInsertError: any = null;
  if (iRows.length) {
    try {
  await insightsTable.insert(iRows, { skipInvalidRows: true, ignoreUnknownValues: true });
    } catch (e: any) {
      iInsertError = e?.errors || e?.message || e;
      console.error('[exportBigQuery] insights insert failed', e);
    }
  }

  // Capsules
  const cSnap = await db.collection('capsules')
    .where('updatedAt', ">=", sinceTs)
    .limit(2000)
    .get();
  const cRows = cSnap.docs.map(d => {
    const x: any = d.data();
    return {
      capsuleId: x.capsuleId || d.id,
      insightId: x.insightId || null,
      userHash: hashUser(x.userId || ''),
      updatedAt: (x.updatedAt?.toDate?.() || new Date()).toISOString(),
      type: x.type || 'unknown',
      fallbackUsed: !!x.fallbackUsed,
      reusedFrom: x.payload?.reusedFrom || null,
      similarityScore: typeof x.payload?.similarityScore === 'number' ? x.payload.similarityScore : null
    };
  });
  let cInsertError: any = null;
  if (cRows.length) {
    try {
  await capsulesTable.insert(cRows, { skipInvalidRows: true, ignoreUnknownValues: true });
    } catch (e: any) {
      cInsertError = e?.errors || e?.message || e;
      console.error('[exportBigQuery] capsules insert failed', e);
    }
  }

  return {
    insightsFetched: iRows.length,
    capsulesFetched: cRows.length,
    insightsInsertError: iInsertError || null,
    capsulesInsertError: cInsertError || null
  };
}

export const exportBigQuery = onRequest({ region: REGION }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method Not Allowed');

    // Require admin key or admin user
    const maybeKey = req.headers['x-admin-key'];
    if (!maybeKey || maybeKey !== ADMIN_KEY) {
      // fall back to token-based check (require a token but we don't have roles; so lock to admin key by default)
      await verifyAuth(req);
      if (ADMIN_KEY) throw new HttpError(403, 'Forbidden');
    }

    const hours = Number((req.body?.hours || 24));
    const sinceMs = Date.now() - hours * 3600 * 1000;

    const result = await exportWindow(sinceMs);
    const anyError = result.insightsInsertError || result.capsulesInsertError;
    if (anyError) {
      res.status(207).json({ status: 'partial', ...result });
    } else {
      res.status(200).json({ status: 'ok', ...result });
    }
  } catch (e) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});

// Optional: nightly scheduled export of last 24h
export const exportBigQueryScheduled = onSchedule({ region: 'asia-south1', schedule: 'every 24 hours', timeZone: 'UTC' }, async () => {
  const sinceMs = Date.now() - 24 * 3600 * 1000;
  try {
    await exportWindow(sinceMs);
  } catch (e) {
    console.error('[exportBigQueryScheduled] failed', e);
  }
});