// Lazy-load the Gemini SDK to avoid heavy module initialization during cold start and deployment analysis.

/**
 * Structured analysis result used by the insights pipeline.
 */
export interface AnalysisResult {
  emotions: { label: string; score: number }[];
  sentiment: { compound: number; positive: number; negative: number };
  topics: string[];
  risk: { suicidal: number; self_harm: number; violence: number };
  confidence: number;
}

let genai: any | null = null;
// Allow overriding model IDs via environment to support newer Gemini versions (e.g., 2.0/2.5) when available.
// Defaults keep existing behavior if env not set.
// Default to 2.5-pro for analysis, 2.5-flash/pro for generation (overridable via env)
const MODEL_ANALYSIS = process.env.GEMINI_MODEL_ANALYSIS || 'gemini-2.5-pro';
const MODEL_STORY = process.env.GEMINI_MODEL_STORY || 'gemini-2.5-flash';
const MODEL_BREATHING = process.env.GEMINI_MODEL_BREATHING || 'gemini-2.5-pro';
const MODEL_ART = process.env.GEMINI_MODEL_ART || 'gemini-2.5-pro';

/**
 * Lazily instantiate the Gemini client if the API key is present.
 */
function getClient(): any | null {
  if (genai) return genai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    // Dynamic import for lighter module graph at load time
    // Note: Using sync wrapper; the SDK constructs synchronously.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genai = new GoogleGenerativeAI(key);
    return genai;
  } catch {
    return null;
  }
}

/**
 * Lightweight lexical heuristic fallback when Gemini is not available or fails.
 */
function heuristicAnalysis(text: string): AnalysisResult {
  const t = text.toLowerCase();
  const posWords = ['happy','great','excited','grateful','calm','peace','good','relieved','hope','optimistic','joy','proud','content'];
  const negWords = ['sad','tired','anxious','anxiety','stress','stressed','angry','lonely','worthless','die','suicide','suicidal','end','hopeless','depressed','helpless','ashamed','failure','fail','empty'];
  let pos = 0, neg = 0;
  for (const w of posWords) if (t.includes(w)) pos++;
  for (const w of negWords) if (t.includes(w)) neg++;

  const total = pos + neg || 1;
  const compound = (pos - neg) / total;

  const suicidal = /(suicidal(\b|[^a-z])|suicidal thoughts?|suicidal ideation|life (is|'s)? not worth living|don'?t want to (be here|live)|i can'?t go on|end it all|i want to die|kill myself|end my life|suicide)/.test(t) ? 0.9 : 0.05;
  const selfHarm = /(cut(ting)? myself|burn(ing)? myself|self[-\s]?harm|self[-\s]?injur(y|ies)|hurt myself on purpose|bleed)/.test(t) ? Math.max(0.75, suicidal - 0.1) : Math.max(0.05, suicidal - 0.15);

  // Rudimentary topic extraction
  const topics = Array.from(
    new Set(
      t
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 4)
    )
  ).slice(0, 5);

  return {
    emotions: [
      { label: compound > 0.25 ? 'positive' : compound < -0.25 ? 'negative' : 'neutral', score: Math.min(1, Math.abs(compound)) }
    ],
    sentiment: {
      compound: parseFloat(compound.toFixed(3)),
      positive: parseFloat((pos / total).toFixed(3)),
      negative: parseFloat((neg / total).toFixed(3))
    },
    topics,
    risk: {
      suicidal: parseFloat(suicidal.toFixed(3)),
      self_harm: parseFloat(selfHarm.toFixed(3)),
      violence: 0.05
    },
    confidence: 0.4
  };
}

/**
 * Analyze a user's journal text for emotions, sentiment, topics, and risk.
 * Uses Gemini if available; falls back to heuristic if not.
 */
export async function analyzeText(text: string): Promise<AnalysisResult> {
  if (!text || text.trim().length < 3) {
    return {
      emotions: [{ label: 'neutral', score: 0.1 }],
      sentiment: { compound: 0, positive: 0, negative: 0 },
      topics: [],
      risk: { suicidal: 0.02, self_harm: 0.01, violence: 0.01 },
      confidence: 0.2
    };
  }

  const client = getClient();
  if (!client) {
    console.warn('[analyzeText] GEMINI_API_KEY missing - using heuristic fallback');
    return heuristicAnalysis(text);
  }

  const model = client.getGenerativeModel({ model: MODEL_ANALYSIS });

  const prompt = `
You are a strict JSON analysis service for mental wellness journaling.

Return ONLY valid JSON with these exact keys:
{
  "emotions": [ { "label": string, "score": number 0-1 } ... up to 5 ],
  "sentiment": { "compound": number -1..1, "positive": number 0..1, "negative": number 0..1 },
  "topics": [ 1-6 concise lowercase tokens ],
  "risk": { "suicidal": number 0..1, "self_harm": number 0..1, "violence": number 0..1 },
  "confidence": number 0..1
}

Safety & guardrails:
- Keep false positives low; escalate only when evidence is strong.
- Set suicidal >= 0.75 only for explicit ideation (e.g., "I want to die", "end my life", "don’t want to exist").
- self_harm is intent to injure oneself (e.g., "cut myself").
- violence covers intent to harm others.
- Neutral, non-clinical language; do not diagnose or provide advice.
- ABSOLUTELY NO extra commentary outside JSON.

Text:
"""${text.replace(/"/g, '\\"')}"""`;

  try {
    const response = await model.generateContent(prompt);
    const raw = response.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}$/);
    const jsonString = jsonMatch ? jsonMatch[0] : raw;

    let parsed: any = JSON.parse(jsonString);

    const safe01 = (n: any) =>
      typeof n === 'number' && isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

    const emotions = Array.isArray(parsed.emotions)
      ? parsed.emotions.slice(0, 5).map((e: any) => ({
          label: (e.label || 'unknown').toString().toLowerCase(),
          score: safe01(e.score)
        }))
      : [];

    const result: AnalysisResult = {
      emotions: emotions.length
        ? emotions
        : heuristicAnalysis(text).emotions,
      sentiment: {
        compound: Math.max(-1, Math.min(1, typeof parsed.sentiment?.compound === 'number' ? parsed.sentiment.compound : 0)),
        positive: safe01(parsed.sentiment?.positive),
        negative: safe01(parsed.sentiment?.negative)
      },
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.filter((t: any) => typeof t === 'string').slice(0, 6)
        : heuristicAnalysis(text).topics,
      risk: {
        suicidal: safe01(parsed.risk?.suicidal),
        self_harm: safe01(parsed.risk?.self_harm),
        violence: safe01(parsed.risk?.violence)
      },
      confidence: safe01(parsed.confidence)
    };

    // Redundant defensive escalation overlay (rule-based) to ensure explicit phrases aren't missed.
    const lower = text.toLowerCase();
    if (/(suicidal(\b|[^a-z])|suicidal thoughts?|suicidal ideation|life (is|'s)? not worth living|don'?t want to (be here|live)|i can'?t go on|end it all|i want to die|kill myself|end my life|suicide)/.test(lower)) {
      result.risk.suicidal = Math.max(result.risk.suicidal, 0.8);
      result.confidence = Math.max(result.confidence, 0.6);
      // If model returned near-neutral sentiment despite explicit ideation, bias sentiment slightly negative for UI mood label
      if (result.sentiment.compound > -0.2) {
        result.sentiment.compound = -0.4;
      }
    }
    if (/(cut(ting)? myself|burn(ing)? myself|self[-\s]?harm|self[-\s]?injur(y|ies)|hurt myself on purpose)/.test(lower)) {
      result.risk.self_harm = Math.max(result.risk.self_harm, 0.7);
    }

    // If emotions came back empty, degrade confidence.
    if (!result.emotions.length) {
      const h = heuristicAnalysis(text);
      result.emotions = h.emotions;
      result.confidence = Math.min(result.confidence, 0.5);
    }

    return result;
  } catch (err: any) {
    console.error('[analyzeText] Gemini failure, using fallback:', err.message);
    return heuristicAnalysis(text);
  }
}

/**
 * Generate a short supportive micro-story ("capsule") tailored to a dominant emotion or topic.
 * Uses Gemini if available; falls back to a static supportive snippet otherwise.
 */
export async function generateStory(topicOrEmotion: string): Promise<string> {
  const topic = (topicOrEmotion || 'your feelings').toLowerCase().trim();
  const client = getClient();
  if (!client) {
    console.warn('[generateStory] GEMINI_API_KEY missing - fallback story used');
    return fallbackStory(topic);
  }

  const model = client.getGenerativeModel({ model: MODEL_STORY });

  const prompt = `
Write a brief, empathetic, psychologically safe micro-story (<140 words) to gently support a student user.
Context cue (emotion/topic): "${topic}"

Tone & voice (match these examples without copying text):
- Reflection Nudge vibe: "Hey, I noticed you’ve been sharing more around late-night study stress... Want to try jotting down just one thing you’re proud of today before bed? Small wins stack up 🌟."
- Breathing Script vibe: "Let’s slow it down together. Inhale gently through your nose for four… hold for two… exhale slowly through your mouth for six... 💨"
- Art/Story vibe: "Imagine painting your stress as a storm cloud... the sun slowly breaking through, color by color... That’s the palette of your resilience."

Tone & safety guardrails:
- Warm, non-judgmental, empowering, calming; neutral and inclusive wording. Emojis optional, at most one.
- No clinical diagnoses, medical claims, heavy religious content, or triggering imagery.
- Include a gentle self-regulation hint (breathing/grounding/reframing) as an invitation ("you might", "notice", "allow").
- Avoid probing questions or prescriptive directives; avoid promises; never mention being an AI.

Output: ONLY the story text (no markdown, no quotes).
`;

  try {
    const response = await model.generateContent(prompt);
    let story = response.response.text().trim();

    // Strip accidental markdown fences or quotes
    story = story
      .replace(/^```[\s\S]*?\n/, '')
      .replace(/```$/, '')
      .trim();

    // Hard length cap fallback
    if (story.length > 900) {
      story = story.slice(0, 900) + '...';
    }

    // Basic safety scrub (overly explicit harmful references)
    if (/kill myself|suicide|end my life|self-harm/i.test(story)) {
      console.warn('[generateStory] Generated story contained sensitive phrases. Replacing with fallback.');
      return fallbackStory(topic);
    }

    return story;
  } catch (err: any) {
    console.error('[generateStory] Gemini failure, using fallback:', err.message);
    return fallbackStory(topic);
  }
}

/**
 * Local fallback story if Gemini is unavailable.
 */
function fallbackStory(topic: string): string {
  return `Hey, I noticed how much ${topic} has been on your mind. Let’s slow it down together—breathe in for four, hold for two, and exhale for six. Imagine the feeling as a small cloud passing across a wide, steady sky. You don’t have to fix everything tonight. Maybe just name one small thing you did today that mattered. Small wins stack up, quietly. You’re still here, and that matters.`;
}

// ---------------------------
// Breathing Plan Generation
// ---------------------------
export interface BreathingPlan {
  name: string; // e.g., "4-2-6 Calm Cycle"
  steps: { label: string; seconds: number; repetitions?: number }[];
  durationSeconds: number; // approximate total time if followed once
  script: string; // gentle guided script (<120 words)
}

function fallbackBreathingPlan(topic: string): BreathingPlan {
  return {
    name: '4-2-6 Calm Cycle',
    steps: [
      { label: 'Inhale', seconds: 4 },
      { label: 'Hold', seconds: 2 },
      { label: 'Exhale', seconds: 6 },
    ],
    durationSeconds: 12,
    script: `Breathe in for four... hold for two... and let the breath out for six. As you exhale, imagine your ${topic} softening at the edges. Repeat gently, letting each cycle smooth the next.`
  };
}

export async function generateBreathingPlan(topicOrEmotion: string): Promise<BreathingPlan> {
  const topic = (topicOrEmotion || 'calm').toLowerCase().trim();
  const client = getClient();
  if (!client) return fallbackBreathingPlan(topic);
  const model = client.getGenerativeModel({ model: MODEL_BREATHING });

  const prompt = `You are a supportive mental wellness guide. Return ONLY strict JSON to define a brief breathing plan tailored to the user's state.
Schema:
{
  "name": string,
  "steps": [ { "label": string, "seconds": number, "repetitions"?: number } ],
  "durationSeconds": number,
  "script": string
}
Tone & safety guardrails:
- Script < 120 words; warm, non-judgmental, inclusive, matching this vibe: "Let’s slow it down together. Inhale gently through your nose for four… hold for two… exhale slowly through your mouth for six... 💨" (do not copy verbatim; maintain the cadence and calm tone; emoji optional, max one).
- Avoid commands; use gentle invitations ("you might", "notice", "allow").
- No medical claims, no clinical advice, no self-harm content.
- steps.seconds small integers (2-8). 3-6 steps. Repetitions <= 8 only if needed.
Context cue: "${topic}".
Return ONLY JSON.`;

  try {
    const resp = await model.generateContent(prompt);
    const raw = resp.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}$/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed: any = JSON.parse(jsonStr);
    const name = String(parsed.name || 'Calm Breathing');
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.map((s: any) => ({
          label: String(s?.label || 'Breathe'),
          seconds: Math.max(1, Math.min(12, Number(s?.seconds || 4))),
          repetitions: typeof s?.repetitions === 'number' ? Math.max(1, Math.min(12, Math.floor(s.repetitions))) : undefined
        })).slice(2, 9)
      : fallbackBreathingPlan(topic).steps;
    const durationSeconds = Math.max(6, Math.min(300, Number(parsed.durationSeconds || steps.reduce((a: number, s: any) => a + (s.seconds || 0), 0))));
    let script = String(parsed.script || 'Breathe in, hold briefly, and breathe out more slowly. Repeat with kindness.');
    if (script.length > 800) script = script.slice(0, 800);
    return { name, steps, durationSeconds, script };
  } catch (e) {
    return fallbackBreathingPlan(topic);
  }
}

// ---------------------------
// Art Prompt Generation
// ---------------------------
export interface ArtPrompt {
  prompt: string; // concise, safe prompt for generative art
  style: string; // e.g., "soft watercolor", "minimalist vector"
  palette: string[]; // up to 5 hex or color names
}

function fallbackArtPrompt(topic: string): ArtPrompt {
  return {
    prompt: `Abstract calming composition evoking ${topic}, soft edges, gentle gradients, no text`,
    style: 'soft watercolor',
    palette: ['#a7c7e7', '#d9e8f5', '#f7f7f7', '#cfe1cf']
  };
}

export async function generateArtPrompt(topicOrEmotion: string): Promise<ArtPrompt> {
  const topic = (topicOrEmotion || 'calm').toLowerCase().trim();
  const client = getClient();
  if (!client) return fallbackArtPrompt(topic);
  const model = client.getGenerativeModel({ model: MODEL_ART });

  const prompt = `Return ONLY JSON for a safe, minimal generative art prompt based on the cue "${topic}".
Schema:
{
  "prompt": string,
  "style": string,
  "palette": string[]
}
Tone & safety guardrails:
- Prompt < 20 words; abstract, non-figurative; avoid people, faces, brands, and text.
- Palette up to 5 items; CSS color names or hex.
- Evoke this metaphorical vibe without copying: "paint stress as a storm cloud, sun breaking through, color by color; resilience as sky after rain."
- No violent, sexual, hateful, or medical content.
Return ONLY JSON.`;

  try {
    const resp = await model.generateContent(prompt);
    const raw = resp.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}$/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed: any = JSON.parse(jsonStr);
    const p = String(parsed.prompt || fallbackArtPrompt(topic).prompt);
    const style = String(parsed.style || 'minimalist abstract');
    const palette = Array.isArray(parsed.palette) ? parsed.palette.map((x: any) => String(x)).slice(0, 5) : fallbackArtPrompt(topic).palette;
    return { prompt: p, style, palette };
  } catch (e) {
    return fallbackArtPrompt(topic);
  }
}