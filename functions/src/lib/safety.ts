// backend/src/lib/safety.ts
interface Risk {
  suicidal: number;
  self_harm: number;
}

export function computeRiskAction(risk: Risk, sentiment: number, text: string) {
  const suicidalKeywords = /(end it( all)?|disappear|kill myself|no reason to live|life (is|'s)? not worth living|i (just )?want to die|don'?t want to (be here|live)|suicidal(\b|[^a-z]))/i;
  const selfHarmKeywords = /(cut(ting)? myself|burn(ing)? myself|self[-\s]?harm|self[-\s]?injur(y|ies)|hurt myself on purpose)/i;
  let keywordBoost = 0;
  if (suicidalKeywords.test(text)) keywordBoost += 0.18;
  if (selfHarmKeywords.test(text)) keywordBoost += 0.12;
  const composite =
    0.55 * risk.suicidal +
    0.25 * risk.self_harm +
    0.2 * (sentiment < -0.35 ? Math.abs(sentiment) : 0) +
    keywordBoost;

  if (composite > 0.85) return { action: 'hard_escalate', score: composite };
  if (composite > 0.58) return { action: 'soft_nudge', score: composite };
  if (composite > 0.42) return { action: 'pattern_watch', score: composite };
  return { action: 'none', score: composite };
}