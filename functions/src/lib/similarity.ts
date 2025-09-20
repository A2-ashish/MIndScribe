import { embedText, cosineSimilarity, EMBEDDING_VERSION } from './embeddings';
import { db } from './firestore';
import { Timestamp } from 'firebase-admin/firestore';
interface SimilarityCandidate { capsuleId: string; score: number; model?: string; version?: string; }
export interface SimilarityResult {
  best?: SimilarityCandidate;
  candidates: SimilarityCandidate[];
  targetModel: string;
  embeddingVersion: string;
  reused: boolean;
  appliedThreshold: number;
}

export interface CapsuleEmbeddingDoc {
  capsuleId: string;
  insightId: string;
  userId: string;
  vector: number[]; // placeholder; in production store base64 or compressed
  type: string;
  dims?: number;
  createdAt: FirebaseFirestore.Timestamp;
}

/** Store an embedding for the final capsule story text (or other modality). */
export async function storeCapsuleEmbedding(params: { capsuleId: string; insightId: string; userId: string; type: string; text: string; }) {
  const { capsuleId, insightId, userId, type, text } = params;
  const emb = await embedText(text);
  await db.collection('capsuleEmbeddings').doc(capsuleId).set({
    capsuleId,
    insightId,
    userId,
    type,
    vector: emb.vector,
    dims: emb.dims,
    model: emb.model,
    version: EMBEDDING_VERSION,
    createdAt: new Date()
  });
}
/** Enhanced similarity search with candidate list and dynamic thresholds. */
export async function findSimilarCapsule(
  userId: string,
  text: string,
  opts: { baseMin?: number; limit?: number; maxCandidates?: number; requireSameVersion?: boolean } = {}
): Promise<SimilarityResult> {
  const { baseMin = 0.9, limit = 50, maxCandidates = 5, requireSameVersion = true } = opts;
  const snap = await db.collection('capsuleEmbeddings')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  if (snap.empty) {
    return { candidates: [], targetModel: 'unknown', embeddingVersion: EMBEDDING_VERSION, reused: false, appliedThreshold: baseMin };
  }
  const targetEmb = await embedText(text);
  const candidates: SimilarityCandidate[] = [];
  snap.forEach(doc => {
    const d = doc.data() as any;
    if (requireSameVersion && d.version && d.version !== EMBEDDING_VERSION) return;
    // Skip if dims mismatch (prevents skewed cosine due to different sizes)
    if (Array.isArray(d.vector) && d.vector.length > 0 && d.vector.length !== targetEmb.vector.length) return;
    const score = cosineSimilarity(targetEmb.vector, d.vector || []);
    candidates.push({ capsuleId: d.capsuleId, score, model: d.model, version: d.version });
  });
  candidates.sort((a,b) => b.score - a.score);
  const top = candidates.slice(0, maxCandidates);

  // Dynamic threshold curve: if top score very high, accept; if moderate, stricter checks.
  let appliedThreshold = baseMin;
  const best = top[0];
  let reused = false;
  if (best) {
    if (best.score >= 0.95) {
      appliedThreshold = 0.95;
      reused = true;
    } else if (best.score >= baseMin) {
      // mid band – keep original threshold
      reused = true;
    }
  }
  if (!reused) {
    return { best, candidates: top, targetModel: targetEmb.model, embeddingVersion: EMBEDDING_VERSION, reused: false, appliedThreshold };
  }
  return { best, candidates: top, targetModel: targetEmb.model, embeddingVersion: EMBEDDING_VERSION, reused: true, appliedThreshold };
}

/** Log a similarity reuse decision (fire-and-forget). */
export async function logSimilarityDecision(params: { userId: string; entryId: string; reusedCapsuleId?: string; score?: number; threshold: number; reused: boolean; }) {
  try {
    const ref = db.collection('similarityDecisions').doc();
    await ref.set({
      decisionId: ref.id,
      userId: params.userId,
      entryId: params.entryId,
      reusedCapsuleId: params.reusedCapsuleId || null,
      score: params.score ?? null,
      threshold: params.threshold,
      reused: params.reused,
      embeddingVersion: EMBEDDING_VERSION,
      createdAt: Timestamp.now()
    });
  } catch (e) {
    // Swallow; non-critical logging.
  }
}

/** Find the most similar existing capsule (same user) above a threshold */
