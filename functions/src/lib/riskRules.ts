export interface RiskInputs {
  suicidal: number;
  selfHarm: number;
  compound: number; // sentiment compound
}

export type RiskAction = 'none' | 'soft' | 'hard';

export interface RiskDecision {
  action: RiskAction;
  score: number;
  reasons: string[];
}

/**
 * Central risk evaluation logic so it can be unit tested and evolved.
 */
export function evaluateRisk(inputs: RiskInputs): RiskDecision {
  const { suicidal, selfHarm, compound } = inputs;
  const reasons: string[] = [];
  let action: RiskAction = 'none';
  let score = 0;

  if (suicidal >= 0.8) {
    action = 'hard';
    score = suicidal;
    reasons.push('suicidal>=0.8');
  } else if (suicidal >= 0.6 && compound < -0.4) {
    action = 'soft';
    score = (suicidal + Math.abs(compound)) / 2;
    reasons.push('suicidal_mid + negative_sentiment');
  } else if (selfHarm >= 0.7) {
    action = 'soft';
    score = selfHarm;
    reasons.push('selfHarm_high');
  }

  return { action, score: Number(score.toFixed(3)), reasons };
}
