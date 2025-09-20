export type SwarmNarrative = {
  id: string;
  createdAt: string;
  narrative: string;
  snapshotRef?: string;
};

export async function getLatestSwarmNarrative(): Promise<SwarmNarrative | null> {
  const url = (import.meta.env.VITE_GET_SWARM_NARRATIVE_URL as string | undefined)
    || 'https://asia-south2-mindscribe-472408.cloudfunctions.net/getLatestSwarmNarrative';
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    id: data?.id || 'latest',
    createdAt: data?.createdAt || new Date().toISOString(),
    narrative: data?.narrative || '',
    snapshotRef: data?.snapshotRef,
  };
}
