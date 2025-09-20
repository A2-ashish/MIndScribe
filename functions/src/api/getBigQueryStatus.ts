import { onRequest } from 'firebase-functions/v2/https';
import { BigQuery } from '@google-cloud/bigquery';
import { REGION } from '../config/region';
import { errorResponse, HttpError } from '../lib/httpError';

const ADMIN_KEY = process.env.ADMIN_KEY;
const BQ_DATASET = process.env.BQ_DATASET || 'analytics';
const BQ_TABLE_INSIGHTS = process.env.BQ_TABLE_INSIGHTS || 'insights';
const BQ_TABLE_CAPSULES = process.env.BQ_TABLE_CAPSULES || 'capsules';

export const getBigQueryStatus = onRequest({ region: REGION }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, 'Method Not Allowed');

    // Require admin key (avoid logging or echoing the key)
    const maybeKey = req.headers['x-admin-key'];
    if (!maybeKey || maybeKey !== ADMIN_KEY) {
      throw new HttpError(401, 'Unauthorized');
    }

  const create = (req.method === 'POST') && (req.query.create === 'true' || req.body?.create === true);
  const includeCounts = (req.query.counts === 'true') || (!!req.body && req.body.counts === true);
  const includeSchema = (req.query.schema === 'true') || (!!req.body && req.body.schema === true);
  const hoursParam = req.query.hours ?? req.body?.hours;
  const hours = hoursParam !== undefined ? Number(hoursParam) : 24;
  const fix = (req.method === 'POST') && (req.query.fix === 'true' || req.body?.fix === true);

  const bq = new BigQuery();
    const dataset = bq.dataset(BQ_DATASET);

    // Dataset check/create
    const [datasetExists] = await dataset.exists();
    let createdDataset = false;
    if (!datasetExists && create) {
      // Default to asia-south2 to colocate with functions/Firestore unless overridden in env via LOCATION
      const location = process.env.BQ_LOCATION || 'asia-south2';
      await dataset.create({ location });
      createdDataset = true;
    }

    // Table checks/creates (only if dataset exists at this point)
  let insightsExists = false;
  let capsulesExists = false;
  let createdInsights = false;
  let createdCapsules = false;
  let insightsHasSchema: boolean | null = null;
  let capsulesHasSchema: boolean | null = null;
  let fixedInsights = false;
  let fixedCapsules = false;

    const d = bq.dataset(BQ_DATASET);
    let insightsSchema: any = undefined;
    let capsulesSchema: any = undefined;
    if (datasetExists || createdDataset) {
  const insightsTable = d.table(BQ_TABLE_INSIGHTS);
  const capsulesTable = d.table(BQ_TABLE_CAPSULES);

      const [iExists] = await insightsTable.exists();
      insightsExists = iExists;
      if (!iExists && create) {
        await insightsTable.create({
          schema: {
            fields: [
              { name: 'insightId', type: 'STRING', mode: 'REQUIRED' },
              { name: 'entryId', type: 'STRING' },
              { name: 'userHash', type: 'STRING', mode: 'REQUIRED' },
              { name: 'createdAt', type: 'TIMESTAMP', mode: 'REQUIRED' },
              { name: 'sentiment_compound', type: 'FLOAT' },
              { name: 'top_emotion', type: 'STRING' },
              { name: 'risk_suicidal', type: 'FLOAT' },
              { name: 'risk_self_harm', type: 'FLOAT' },
              { name: 'risk_violence', type: 'FLOAT' },
              { name: 'enforcement', type: 'STRING' }
            ]
          }
        });
        createdInsights = true;
        insightsExists = true;
      }
      if (insightsExists) {
        try {
          const [meta] = await insightsTable.getMetadata();
          insightsHasSchema = Array.isArray(meta?.schema?.fields) && meta.schema.fields.length > 0;
          if (includeSchema) {
            insightsSchema = meta?.schema?.fields || [];
          }
          if (!insightsHasSchema && fix) {
            await insightsTable.setMetadata({
              schema: {
                fields: [
                  { name: 'insightId', type: 'STRING', mode: 'REQUIRED' },
                  { name: 'entryId', type: 'STRING' },
                  { name: 'userHash', type: 'STRING', mode: 'REQUIRED' },
                  { name: 'createdAt', type: 'TIMESTAMP', mode: 'REQUIRED' },
                  { name: 'sentiment_compound', type: 'FLOAT' },
                  { name: 'top_emotion', type: 'STRING' },
                  { name: 'risk_suicidal', type: 'FLOAT' },
                  { name: 'risk_self_harm', type: 'FLOAT' },
                  { name: 'risk_violence', type: 'FLOAT' },
                  { name: 'enforcement', type: 'STRING' }
                ]
              }
            });
            fixedInsights = true;
            insightsHasSchema = true;
          }
        } catch (_) {
          insightsHasSchema = null;
        }
      }

      const [cExists] = await capsulesTable.exists();
      capsulesExists = cExists;
      if (!cExists && create) {
        await capsulesTable.create({
          schema: {
            fields: [
              { name: 'capsuleId', type: 'STRING', mode: 'REQUIRED' },
              { name: 'insightId', type: 'STRING' },
              { name: 'userHash', type: 'STRING', mode: 'REQUIRED' },
              { name: 'updatedAt', type: 'TIMESTAMP', mode: 'REQUIRED' },
              { name: 'type', type: 'STRING' },
              { name: 'fallbackUsed', type: 'BOOL' },
              { name: 'reusedFrom', type: 'STRING' },
              { name: 'similarityScore', type: 'FLOAT' }
            ]
          }
        });
        createdCapsules = true;
        capsulesExists = true;
      }
      if (capsulesExists) {
        try {
          const [meta] = await capsulesTable.getMetadata();
          capsulesHasSchema = Array.isArray(meta?.schema?.fields) && meta.schema.fields.length > 0;
          if (includeSchema) {
            capsulesSchema = meta?.schema?.fields || [];
          }
          if (!capsulesHasSchema && fix) {
            await capsulesTable.setMetadata({
              schema: {
                fields: [
                  { name: 'capsuleId', type: 'STRING', mode: 'REQUIRED' },
                  { name: 'insightId', type: 'STRING' },
                  { name: 'userHash', type: 'STRING', mode: 'REQUIRED' },
                  { name: 'updatedAt', type: 'TIMESTAMP', mode: 'REQUIRED' },
                  { name: 'type', type: 'STRING' },
                  { name: 'fallbackUsed', type: 'BOOL' },
                  { name: 'reusedFrom', type: 'STRING' },
                  { name: 'similarityScore', type: 'FLOAT' }
                ]
              }
            });
            fixedCapsules = true;
            capsulesHasSchema = true;
          }
        } catch (_) {
          capsulesHasSchema = null;
        }
      }
    }

    let counts: any = undefined;
    if (includeCounts) {
      counts = { insights: {}, capsules: {} };
      try {
        const projectId = await bq.getProjectId();
        const fqInsights = `\`${projectId}.${BQ_DATASET}.${BQ_TABLE_INSIGHTS}\``;
        const fqCapsules = `\`${projectId}.${BQ_DATASET}.${BQ_TABLE_CAPSULES}\``;

        if (insightsExists) {
          // All-time count
          const [iAll] = await bq.query({ query: `SELECT COUNT(1) AS c FROM ${fqInsights}` });
          // Recent by createdAt if column exists; ignore error if not
          let iRecent: Array<{ c: string | number }>|null = null;
          try {
            const [rows] = await bq.query({
              query: `SELECT COUNT(1) AS c FROM ${fqInsights} WHERE createdAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours HOUR)`,
              params: { hours: hours || 24 }
            });
            iRecent = rows as any;
          } catch (_) {
            iRecent = null;
          }
          counts.insights = {
            all: Number((iAll?.[0] as any)?.c ?? 0),
            recentHours: hours || 24,
            recent: Number((iRecent?.[0] as any)?.c ?? 0)
          };
        }

        if (capsulesExists) {
          const [cAll] = await bq.query({ query: `SELECT COUNT(1) AS c FROM ${fqCapsules}` });
          let cRecent: Array<{ c: string | number }>|null = null;
          try {
            const [rows] = await bq.query({
              query: `SELECT COUNT(1) AS c FROM ${fqCapsules} WHERE updatedAt >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours HOUR)`,
              params: { hours: hours || 24 }
            });
            cRecent = rows as any;
          } catch (_) {
            cRecent = null;
          }
          counts.capsules = {
            all: Number((cAll?.[0] as any)?.c ?? 0),
            recentHours: hours || 24,
            recent: Number((cRecent?.[0] as any)?.c ?? 0)
          };
        }
      } catch (e) {
        // If counting fails for any reason, include an error but don't fail the endpoint
        counts = { error: (e as Error).message };
      }
    }

    res.status(200).json({
      status: 'ok',
      dataset: BQ_DATASET,
      tables: {
        insights: { name: BQ_TABLE_INSIGHTS, exists: insightsExists, created: createdInsights, hasSchema: insightsHasSchema, fixed: fixedInsights, schema: includeSchema ? insightsSchema : undefined },
        capsules: { name: BQ_TABLE_CAPSULES, exists: capsulesExists, created: createdCapsules, hasSchema: capsulesHasSchema, fixed: fixedCapsules, schema: includeSchema ? capsulesSchema : undefined }
      },
      createdDataset,
      datasetExists: datasetExists || createdDataset,
      counts
    });
  } catch (e) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});
