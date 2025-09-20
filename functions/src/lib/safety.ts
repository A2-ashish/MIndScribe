// backend/src/lib/safety.ts
interface Risk {
  suicidal: number;
  self_harm: number;
}

export function computeRiskAction(risk: Risk, sentiment: number, text: string) {
  const suicidalKeywords = /(end it|disappear|kill myself|no reason)/i;
  let keywordBoost = suicidalKeywords.test(text) ? 0.15 : 0;
  const composite =
    0.5 * risk.suicidal +
    0.3 * risk.self_harm +
    0.2 * (sentiment < -0.4 ? Math.abs(sentiment) : 0) +
    keywordBoost;

  if (composite > 0.85) return { action: 'hard_escalate', score: composite };
  if (composite > 0.55) return { action: 'soft_nudge', score: composite };
  if (composite > 0.4) return { action: 'pattern_watch', score: composite };
  return { action: 'none', score: composite };
}