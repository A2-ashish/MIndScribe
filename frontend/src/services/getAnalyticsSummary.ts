export type AnalyticsRow = {
  day: string;
  insights_count: number;
  avg_sentiment: number | null;
  capsules_count: number;
};

export type AnalyticsSummary = {
  status: string;
  days: number;
  rows: AnalyticsRow[];
};

export async function getAnalyticsSummary(days = 14): Promise<AnalyticsSummary | null> {
  const base = (import.meta.env.VITE_GET_ANALYTICS_SUMMARY_URL as string | undefined)
    || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/getAnalyticsSummary';
  const url = `${base}?days=${encodeURIComponent(String(days))}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}
