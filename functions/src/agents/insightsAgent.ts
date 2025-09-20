import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { db } from '../lib/firestore';
import { analyzeText } from '../lib/gemini';
import { classifyText, CLASSIFIER_MODEL_VERSION, computeGatingShadow } from '../lib/classifier';
import { MEDIA_PIPELINE_VERSION } from '../lib/media';
import { computeRiskAction } from '../lib/safety';
import { Timestamp } from 'firebase-admin/firestore';

export const onEntryCreated = onDocumentWritten(
  {
    region: 'asia-south2',
    document: 'entries/{entryId}',
    retry: false,
    secrets: ['GEMINI_API_KEY']
  },
  async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists) return;
    const entry: any = after.data();
    // Only process when explicitly submitted
    if (entry.submitted !== true) return;

    // Idempotency
    const existing = await db.collection('insights')
      .where('entryId', '==', entry.entryId)
      .limit(1)
      .get();
    if (!existing.empty) return;

    // Gather media enrichment (completed assets for this entry)
    const mediaSnap = await db.collection('mediaAssets')
      .where('entryId', '==', entry.entryId)
      .where('status', '==', 'complete')
      .limit(25)
      .get();
    let enrichedText = entry.text;
    if (!mediaSnap.empty) {
      const fragments: string[] = [];
      mediaSnap.forEach(doc => {
        const m: any = doc.data();
        if (m.type === 'audio' && m.transcript) {
          fragments.push(`(Audio Transcript) ${m.transcript}`);
        }
        if (m.type === 'image') {
          if (m.caption) fragments.push(`(Image Caption) ${m.caption}`);
          if (Array.isArray(m.labels) && m.labels.length) {
            fragments.push(`(Image Labels) ${m.labels.slice(0,5).join(', ')}`);
          }
        }
      });
      if (fragments.length) {
        enrichedText += `\n\n--- MEDIA CONTEXT (v:${MEDIA_PIPELINE_VERSION}) ---\n` + fragments.join('\n');
      }
    }

    // Run analysis & classifier in parallel for latency optimization
    const [analysis, classifierScores] = await Promise.all([
      analyzeText(enrichedText),
      classifyText(enrichedText)
    ]);

    const insightRef = db.collection('insights').doc();
    const CLASSIFIER_ENFORCE = (process.env.CLASSIFIER_ENFORCE || 'off').toLowerCase();
    const enforcement: 'off'|'soft'|'hard' = (CLASSIFIER_ENFORCE === 'soft' || CLASSIFIER_ENFORCE === 'hard') ? CLASSIFIER_ENFORCE as any : 'off';

    await insightRef.set({
      insightId: insightRef.id,
      entryId: entry.entryId,
      userId: entry.userId,
      emotions: analysis.emotions,
      sentiment: analysis.sentiment,
      topics: analysis.topics,
      risk: analysis.risk,
      confidence: analysis.confidence,
      enforcement,
      createdAt: Timestamp.now()
    });

  await after.ref.update({ processed: true });

    // Log classifier decision (shadow mode)
    try {
      const shadow = computeGatingShadow(classifierScores);
      const cRef = db.collection('classifierDecisions').doc();
      await cRef.set({
        decisionId: cRef.id,
        userId: entry.userId,
        entryId: entry.entryId,
        modelVersion: CLASSIFIER_MODEL_VERSION,
        classifierPath: (process.env.CLASSIFIER_PATH || 'gemini'),
        scores: classifierScores,
        combinedRisk: {
          suicidal: Math.max(classifierScores.suicidal, analysis.risk.suicidal),
          selfHarm: Math.max(classifierScores.selfHarm, analysis.risk.self_harm),
          violence: Math.max(classifierScores.violence, analysis.risk.violence)
        },
        gatingShadow: shadow,
        createdAt: Timestamp.now()
      });
    } catch (e) {
      console.warn('[insightsAgent] classifier logging failed', { error: (e as any)?.message });
    }

    const decision = computeRiskAction(
      analysis.risk,
      analysis.sentiment.compound,
      enrichedText
    );

    if (decision.action !== 'none') {
      const alertRef = db.collection('alerts').doc();
      await alertRef.set({
        alertId: alertRef.id,
        userId: entry.userId,
        insightId: insightRef.id,
        riskType: decision.action,
        score: decision.score,
        action: decision.action === 'hard_escalate' ? 'escalated' : 'shown_resources',
        createdAt: Timestamp.now(),
        resolved: false
      });
    }

    // Enforcement behavior: if 'hard', stop downstream capsule generation by marking the entry and exiting
    if (enforcement === 'hard') {
      await after.ref.update({ requiresHumanReview: true });
      console.log('[insightsAgent] Hard enforcement active: skipping capsule generation', { entryId: entry.entryId, insightId: insightRef.id });
      return;
    }
  }
);