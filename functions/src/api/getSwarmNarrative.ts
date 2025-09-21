import { onRequest } from 'firebase-functions/v2/https';
import { db } from '../lib/firestore';
import { HttpError, errorResponse } from '../lib/httpError';
import { REGION } from '../config/region';
import { Timestamp } from 'firebase-admin/firestore';
// Lazy-load Gemini client to avoid heavy initialization at module load time

const ADMIN_KEY = process.env.ADMIN_KEY;

function fallbackNarrative(topEmotion: string, avgMood: number, total: number): string {
  const mood = avgMood > 0.15 ? 'generally positive' : avgMood < -0.15 ? 'somewhat low' : 'mixed';
  return `Over the last week, the community mood was ${mood}. The most common emotion was ${topEmotion}. We aggregated ${total} recent reflections to build this snapshot. If you're having a tough day, small acts of care—like a short walk or a calming breath—can help.`;
}

export const getSwarmNarrative = onRequest({ region: REGION }, async (req, res) => {
  res.set({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-key' });
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method Not Allowed');
    if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) throw new HttpError(403, 'Forbidden');

    const snap = await db.collection('swarmSnapshots').orderBy('createdAt', 'desc').limit(1).get();
    if (snap.empty) throw new HttpError(404, 'No swarm snapshot available');
    const s: any = snap.docs[0].data();

    const topEmotion = s.topEmotion || 'neutral';
    const avgMood = Number(s.avgMood || 0);
    const total = Number(s.totalInsights || 0);

    let narrative = fallbackNarrative(topEmotion, avgMood, total);
    try {
      const key = process.env.GEMINI_API_KEY;
      if (key) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const gen = new GoogleGenerativeAI(key);
        const model = gen.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Write a 3-4 sentence, empathetic weekly community mood note based on: topEmotion=${topEmotion}, avgMood=${avgMood.toFixed(3)}, totalInsights=${total}. Be supportive, non-clinical, avoid triggers. Return plain text.`;
        const resp = await model.generateContent(prompt);
        const txt = resp.response.text().trim();
        if (txt && txt.length > 20) narrative = txt.slice(0, 800);
      }
    } catch (e) {
      // fall back silently
    }

    const ref = db.collection('swarmNarratives').doc();
    await ref.set({
      narrativeId: ref.id,
      createdAt: Timestamp.now(),
      snapshotId: s.snapshotId,
      avgMood,
      topEmotion,
      totalInsights: total,
      narrative
    });

    res.status(200).json({ status: 'ok', narrativeId: ref.id, narrative });
  } catch (e) {
    const { status, body } = errorResponse(e);
    res.status(status).json(body);
  }
});