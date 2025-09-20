import { onRequest } from 'firebase-functions/v2/https';
import { BigQuery } from '@google-cloud/bigquery';
import { REGION } from '../config/region';
import { errorResponse, HttpError } from '../lib/httpError';

const BQ_DATASET = process.env.BQ_DATASET || 'analytics';
const BQ_TABLE_INSIGHTS = process.env.BQ_TABLE_INSIGHTS || 'insights';
const BQ_TABLE_CAPSULES = process.env.BQ_TABLE_CAPSULES || 'capsules';

export const getAnalyticsSummary = onRequest({ region: REGION }, async (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    // Cache for 5 minutes on clients and 10 minutes on shared caches
    'Cache-Control': 'public, max-age=300, s-maxage=600'
  });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Method Not Allowed');

    const daysRaw = (req.query.days as string) || '14';
    let days = Math.max(1, Math.min(90, Number(daysRaw) || 14));

    const bq = new BigQuery();
    const projectId = await bq.getProjectId();
    const insightsFq = `\`${projectId}.${BQ_DATASET}.${BQ_TABLE_INSIGHTS}\``;
    const capsulesFq = `\`${projectId}.${BQ_DATASET}.${BQ_TABLE_CAPSULES}\``;

    const insightsQuery = {
      query: `
        SELECT FORMAT_DATE('%Y-%m-%d', DATE(createdAt)) AS day,
               COUNT(1) AS insights_count,
               AVG(CAST(sentiment_compound AS FLOAT64)) AS avg_sentiment
        FROM ${insightsFq}
        WHERE createdAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
        GROUP BY day
      `,
      params: { days }
    };

    const capsulesQuery = {
      query: `
        SELECT FORMAT_DATE('%Y-%m-%d', DATE(updatedAt)) AS day,
               COUNT(1) AS capsules_count
        FROM ${capsulesFq}
        WHERE updatedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
        GROUP BY day
      `,
      params: { days }
    };

    const [[insightsRows], [capsulesRows]] = await Promise.all([
      bq.query(insightsQuery),
      bq.query(capsulesQuery)
    ]);

    // Build complete day range
    const byDay: Record<string, { day: string; insights_count: number; avg_sentiment: number | null; capsules_count: number }> = {};
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const iso = d.toISOString().slice(0,10);
      byDay[iso] = { day: iso, insights_count: 0, avg_sentiment: null, capsules_count: 0 };
    }

    for (const r of (insightsRows as any[])) {
      const day = String(r.day);
      const existing = byDay[day] || { day, insights_count: 0, avg_sentiment: null, capsules_count: 0 };
      existing.insights_count = Number(r.insights_count || 0);
      existing.avg_sentiment = r.avg_sentiment !== null && r.avg_sentiment !== undefined ? Number(r.avg_sentiment) : null;
      byDay[day] = existing;
    }
    for (const r of (capsulesRows as any[])) {
      const day = String(r.day);
      const existing = byDay[day] || { day, insights_count: 0, avg_sentiment: null, capsules_count: 0 };
      existing.capsules_count = Number(r.capsules_count || 0);
      byDay[day] = existing;
    }

    const rows = Object.values(byDay).sort((a,b) => a.day.localeCompare(b.day));

    res.status(200).json({
      status: 'ok',
      days,
      rows
    });
  } catch (e) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});
