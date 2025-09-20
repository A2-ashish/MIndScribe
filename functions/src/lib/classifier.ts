import { GoogleGenerativeAI } from '@google/generative-ai';

export const CLASSIFIER_MODEL_VERSION = 'v1';
type ClassifierPath = 'heuristic' | 'gemini' | 'ft';

function getClassifierPath(): ClassifierPath {
  const raw = (process.env.CLASSIFIER_PATH || '').toLowerCase();
  if (raw === 'heuristic' || raw === 'gemini' || raw === 'ft') return raw;
  return 'gemini'; // default to gemini+fallback
}

export interface ClassifierScores {
  emotionalIntensity: number;
  distress: number;
  suicidal: number;
  selfHarm: number;
  violence: number;
  depth: number;
}

let client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI | null {
  if (client) return client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  client = new GoogleGenerativeAI(key);
  return client;
}

function clamp01(n: any): number {
  return typeof n === 'number' && isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function heuristicClassifier(text: string): ClassifierScores {
  const t = (text || '').toLowerCase();
  const intenseTokens = ['overwhelmed','shaking','panic','panicking','devastated','furious','numb','empty','exhausted'];
  const distressTokens = ['cant cope','can\'t cope','breaking down','collapse','screaming','crying','tears','anxiety','anxious','panic'];
  const ideationTokens = ['i want to die','end my life','kill myself','suicide','dont want to exist','don\'t want to exist'];
  const selfHarmTokens = ['cut myself','hurt myself','self-harm','self harm','bleed'];
  const violenceTokens = ['hurt them','kill them','attack','revenge'];

  function score(list: string[], base=0.0, per=0.18, cap=0.95) {
    let s = base;
    for (const phrase of list) if (t.includes(phrase)) s += per;
    return Math.min(cap, s);
  }

  const suicidal = score(ideationTokens, 0.02, 0.35);
  const selfHarm = Math.max(score(selfHarmTokens, 0.01, 0.30), suicidal - 0.15);
  const violence = score(violenceTokens, 0.01, 0.25, 0.9);
  const emotionalIntensity = Math.max(score(intenseTokens, 0.05, 0.08), 0);
  const distress = Math.max(score(distressTokens, 0.05, 0.07), emotionalIntensity * 0.6);
  // Depth: crude proxy using vocabulary diversity & length
  const tokens = t.replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
  const uniq = new Set(tokens);
  const depth = clamp01((uniq.size / (tokens.length + 1)) * 0.6 + Math.min(1, tokens.length / 250) * 0.4);

  return { emotionalIntensity, distress, suicidal, selfHarm, violence, depth };
}

async function classifyTextGemini(trimmed: string): Promise<ClassifierScores> {
  const c = getClient();
  if (!c) return heuristicClassifier(trimmed);
  const model = c.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `You are a probability classifier. Return ONLY valid JSON with keys: emotionalIntensity, distress, suicidal, selfHarm, violence, depth (all 0..1). Definitions: emotionalIntensity=overall affect strength; distress=acute dysregulation/overwhelm; suicidal=prob active suicidal ideation; selfHarm=prob self-injury intent; violence=prob intent harm others; depth=reflective richness (structure, self-reflection). Keep false positives low. Text:"""${trimmed.slice(0,4000).replace(/"/g,'\\"')}"""`;
  try {
    const resp = await model.generateContent(prompt);
    const raw = resp.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}$/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed: any = JSON.parse(jsonStr);
    const scores: ClassifierScores = {
      emotionalIntensity: clamp01(parsed.emotionalIntensity),
      distress: clamp01(parsed.distress),
      suicidal: clamp01(parsed.suicidal),
      selfHarm: clamp01(parsed.selfHarm),
      violence: clamp01(parsed.violence),
      depth: clamp01(parsed.depth)
    };
    // Guardrails
    const lower = trimmed.toLowerCase();
    if (/i want to die|end my life|kill myself|suicide/.test(lower)) {
      scores.suicidal = Math.max(scores.suicidal, 0.75);
    }
    if (/cut myself|self-harm|self harm/.test(lower)) {
      scores.selfHarm = Math.max(scores.selfHarm, 0.65);
    }
    return scores;
  } catch {
    return heuristicClassifier(trimmed);
  }
}

// Stub for a future fine-tuned classifier path. For now, delegate to Gemini implementation.
async function classifyTextFT(trimmed: string): Promise<ClassifierScores> {
  return classifyTextGemini(trimmed);
}

export async function classifyText(text: string): Promise<ClassifierScores> {
  const trimmed = (text || '').trim();
  if (trimmed.length < 8) {
    return { emotionalIntensity: 0.1, distress: 0.1, suicidal: 0.02, selfHarm: 0.01, violence: 0.01, depth: 0.1 };
  }
  const path = getClassifierPath();
  if (path === 'heuristic') return heuristicClassifier(trimmed);
  if (path === 'ft') return classifyTextFT(trimmed);
  return classifyTextGemini(trimmed);
}

export function computeGatingShadow(scores: ClassifierScores) {
  const wouldEscalate = scores.suicidal >= 0.75 || scores.selfHarm >= 0.65 || (scores.distress >= 0.8 && scores.emotionalIntensity >= 0.8);
  let reason: string | null = null;
  if (scores.suicidal >= 0.75) reason = 'suicidal';
  else if (scores.selfHarm >= 0.65) reason = 'selfHarm';
  else if (scores.distress >= 0.8 && scores.emotionalIntensity >= 0.8) reason = 'distress_combo';
  return { wouldEscalate, reason };
}
