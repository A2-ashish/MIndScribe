import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { evaluateRisk } from '../lib/riskRules';

/**
 * Safety Agent
 * Watches new insights and decides if an alert or gentle resource prompt should be created.
 * This is a lightweight rule-based first version; can be upgraded with ML or pattern history.
 */
export const onSafetyCheck = onDocumentCreated(
  {
    region: 'asia-south2',
    document: 'insights/{insightId}',
    retry: false
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data: any = snap.data();
    if (!data) return;

    const { risk, sentiment, userId, insightId } = data;
    if (!risk || typeof risk !== 'object') return;

    const suicidal = Number(risk.suicidal || 0);
    const selfHarm = Number(risk.self_harm || 0);
    const compound = Number(sentiment?.compound || 0);

    // Idempotency: skip if alert already exists
    const existing = await db.collection('alerts')
      .where('insightId', '==', insightId)
      .limit(1)
      .get();
    if (!existing.empty) return;

    const decision = evaluateRisk({ suicidal, selfHarm, compound });
    if (decision.action === 'none') return;

    const alertRef = db.collection('alerts').doc();
    await alertRef.set({
      alertId: alertRef.id,
      userId,
      insightId,
      level: decision.action,
      score: decision.score,
      reasons: decision.reasons,
      createdAt: Timestamp.now(),
      resolved: false,
      resourcesShown: decision.action === 'soft'
    });
  }
);
