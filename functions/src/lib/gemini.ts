import { GoogleGenerativeAI } from '@google/generative-ai';

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

let genai: GoogleGenerativeAI | null = null;

/**
 * Lazily instantiate the Gemini client if the API key is present.
 */
function getClient(): GoogleGenerativeAI | null {
  if (genai) return genai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  genai = new GoogleGenerativeAI(key);
  return genai;
}

/**
 * Lightweight lexical heuristic fallback when Gemini is not available or fails.
 */
function heuristicAnalysis(text: string): AnalysisResult {
  const t = text.toLowerCase();
  const posWords = ['happy','great','excited','grateful','calm','peace','good','relieved','hope','optimistic'];
  const negWords = ['sad','tired','anxious','anxiety','stress','stressed','angry','lonely','worthless','die','suicide','end','hopeless','depressed'];
  let pos = 0, neg = 0;
  for (const w of posWords) if (t.includes(w)) pos++;
  for (const w of negWords) if (t.includes(w)) neg++;

  const total = pos + neg || 1;
  const compound = (pos - neg) / total;

  const suicidal = /suicide|kill myself|end my life|don'?t want to exist|i want to die|no reason to live|i should not be here/.test(t) ? 0.85 : 0.05;
  const selfHarm = /cut myself|hurt myself|self[-\s]?harm|bleed/.test(t) ? Math.max(0.7, suicidal - 0.1) : Math.max(0.05, suicidal - 0.15);

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

  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You are a strict JSON analysis service. Analyze the user's mental health journaling text.

Return ONLY valid JSON with these exact keys:
{
  "emotions": [ { "label": string, "score": number 0-1 } ... up to 5 ],
  "sentiment": { "compound": number -1..1, "positive": number 0..1, "negative": number 0..1 },
  "topics": [ 1-6 concise lowercase tokens ],
  "risk": { "suicidal": number 0..1, "self_harm": number 0..1, "violence": number 0..1 },
  "confidence": number 0..1
}

Guidelines:
- Only set suicidal >= 0.75 if explicit ideation (e.g., "I want to die", "end my life", "don’t want to exist").
- self_harm indicates intent to physically injure self (e.g., "cut myself").
- violence for harming others or aggressive violent intent.
- Keep false positives low, escalate only for strong signals.
- ABSOLUTELY NO extra commentary outside JSON.

Text:
"""${text.replace(/"/g, '\\"')}"""
`;

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
    if (/dont want to exist|i want to die|end my life|kill myself|suicide/.test(lower)) {
      result.risk.suicidal = Math.max(result.risk.suicidal, 0.8);
      result.confidence = Math.max(result.confidence, 0.6);
    }
    if (/cut myself|hurt myself on purpose|self[-\s]?harm/.test(lower)) {
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

  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
You will produce a brief, empathetic, psychologically safe micro-story (<140 words) to gently support a student user.
Context cue (emotion/topic): "${topic}"

Requirements:
- Present tense or gentle reflective past.
- Tone: warm, non-judgmental, empowering, calming.
- Avoid: making promises, clinical diagnosis, heavy religious content, or triggering imagery.
- Include a subtle self-regulation hint (breathing, grounding, reframing) without sounding like a command.
- DO NOT ask probing questions.
- NEVER mention you are an AI.
- Return ONLY the story text (no markdown, no quotes).
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
  return `In this moment, a quiet awareness settles around you. The feelings about ${topic} do not define you; they are passing weather in a much bigger sky. You breathe in slowly, counting a gentle rhythm, and notice one small thing in your space that is steady and real. That steadiness is also within you—patient, genuine, persistent. You don’t have to solve everything tonight. A tiny step, a kind thought toward yourself, is already movement. You are still here, and that matters.`;
}