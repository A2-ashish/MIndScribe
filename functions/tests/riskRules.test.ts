import { evaluateRisk } from '../src/lib/riskRules';

interface Metrics { suicidal: number; selfHarm: number; compound: number; }
function makeMetrics(overrides: Partial<Metrics> = {}): Metrics {
  return { suicidal: 0, selfHarm: 0, compound: 0, ...overrides };
}

describe('evaluateRisk', () => {
  it('returns hard for suicidal >= 0.8', () => {
    const res = evaluateRisk(makeMetrics({ suicidal: 0.81 }));
    expect(res.action).toBe('hard');
    expect(res.reasons).toContain('suicidal>=0.8');
  });

  it('returns soft for medium suicidal and negative sentiment', () => {
    const res = evaluateRisk(makeMetrics({ suicidal: 0.65, compound: -0.5 }));
    expect(res.action).toBe('soft');
  });

  it('returns soft for high selfHarm', () => {
    const res = evaluateRisk(makeMetrics({ selfHarm: 0.71 }));
    expect(res.action).toBe('soft');
  });

  it('returns none for low metrics', () => {
    const res = evaluateRisk(makeMetrics({ suicidal: 0.1, selfHarm: 0.1, compound: 0.2 }));
    expect(res.action).toBe('none');
  });
});
