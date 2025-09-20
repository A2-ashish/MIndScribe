/**
 * Embeddings module with best-effort real Gemini embeddings and graceful fallback.
 * Uses the @google/generative-ai client if available and GEMINI_API_KEY configured as a secret.
 * Falls back to deterministic placeholder for local/dev or failure cases.
 */
// Bump when embedding backend/model/dims meaningfully change
export const EMBEDDING_VERSION = 'v2';
export interface EmbeddingResult { model: string; vector: number[]; dims: number; }

let geminiClient: any | null = null;
async function getGeminiClient() {
  if (geminiClient !== null) return geminiClient;
  try {
    // Lazy import to avoid cold start penalty if never used.
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      geminiClient = null; // no key => skip
      return null;
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
    return geminiClient;
  } catch {
    geminiClient = null;
    return null;
  }
}

function placeholderVector(text: string, dims = 128): number[] {
  // Simple hashed character rolling scheme for deterministic pseudo-embeddings.
  const v = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = code % dims;
    v[idx] = (v[idx] + (code % 31) + 1) % 97; // keep small-ish magnitude
  }
  return v;
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return { model: 'empty-text', vector: placeholderVector('empty'), dims: 128 };
  }

  // Attempt real embedding.
  try {
    const client = await getGeminiClient();
    if (client) {
      // Model name may change; using published embed model id.
      const model = client.getGenerativeModel({ model: 'text-embedding-004' });
      // The embeddings API shape differs; adapt to current SDK.
      // Some SDK versions expose model.embedContent; using a defensive pattern.
      // @ts-ignore dynamic method check
      if (typeof model.embedContent === 'function') {
        // @ts-ignore - embedContent signature
        const result = await model.embedContent({ content: { parts: [{ text: trimmed }] } });
        const vector: number[] | undefined = result?.embedding?.values || result?.data?.[0]?.embedding;
        if (Array.isArray(vector) && vector.length > 0) {
          return { model: 'gemini-text-embedding-004', vector, dims: vector.length };
        }
      }
    }
  } catch (err) {
    // Swallow and fallback
  }

  // Fallback deterministic vector
  const vector = placeholderVector(trimmed);
  return { model: 'placeholder-fallback', vector, dims: vector.length };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]; const bv = b[i];
    dot += av * bv; na += av * av; nb += bv * bv;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
