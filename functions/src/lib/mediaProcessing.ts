// Lazy-load Gemini SDK to avoid heavy initialization at deploy/load time
let genai: any | null = null;
function getClient(): any | null {
  if (genai) return genai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    genai = new GoogleGenerativeAI(key);
    return genai;
  } catch {
    return null;
  }
}

export async function transcribeAudioPlaceholder(filePath: string, mime: string): Promise<{ transcript: string; confidence: number }> {
  // Placeholder: In future integrate real STT (e.g., Speech-to-Text or Gemini audio).
  // For now produce a stable pseudo transcript referencing filename.
  const base = filePath.split('/').slice(-1)[0];
  return { transcript: `Audio note (${base}) captured. (Transcription placeholder)`, confidence: 0.3 };
}

export async function generateImageLabelsAndCaptionPlaceholder(filePath: string, mime: string): Promise<{ labels: string[]; caption: string }> {
  const base = filePath.split('/').slice(-1)[0];
  const client = getClient();
  if (!client) {
    return {
      labels: ['unlabeled'],
      caption: `Image (${base}) uploaded (caption placeholder)`
    };
  }
  const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `Provide: \n1) 5 short lowercase labels (comma separated)\n2) A concise neutral caption (<15 words)\nFor an image described only by file name "${base}" and mime ${mime}. Return JSON {"labels":[],"caption":""}.`;
  try {
    const response = await model.generateContent(prompt);
    const raw = response.response.text().trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}$/);
    const text = jsonMatch ? jsonMatch[0] : raw;
    const parsed: any = JSON.parse(text);
    const labels: string[] = Array.isArray(parsed.labels) ? parsed.labels.filter((l: any) => typeof l === 'string').slice(0,5) : ['unlabeled'];
    const caption: string = typeof parsed.caption === 'string' ? parsed.caption.slice(0, 120) : `Image (${base}) uploaded (caption placeholder)`;
    return { labels, caption };
  } catch {
    return { labels: ['unlabeled'], caption: `Image (${base}) uploaded (caption placeholder)` };
  }
}
