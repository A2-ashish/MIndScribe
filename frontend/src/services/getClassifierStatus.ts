import { ensureUser } from '../auth';

export interface ClassifierFlags {
  CLASSIFIER_PATH: 'heuristic' | 'gemini' | 'ft' | string;
  CLASSIFIER_ENFORCE: 'off' | 'soft' | 'hard' | string;
  CLASSIFIER_MODEL_VERSION: string;
}

export interface ClassifierStatusResponse {
  flags: ClassifierFlags;
  recent: any[];
}

export async function getClassifierStatus(): Promise<ClassifierStatusResponse> {
  const fnUrl = import.meta.env.VITE_FUNCTION_GET_CLASSIFIER_STATUS_URL || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/getClassifierStatus';
  const user = await ensureUser();
  const token = await user.getIdToken();
  const res = await fetch(fnUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`getClassifierStatus failed (${res.status}) ${text}`);
  return JSON.parse(text) as ClassifierStatusResponse;
}
