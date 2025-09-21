import { setGlobalOptions } from 'firebase-functions/v2/options';

// Single source of truth for Functions region
export const REGION = 'asia-south2';

// Apply conservative defaults to all v2 functions to respect Cloud Run per‑region CPU quotas.
// Notes:
// - cpu: fractional vCPU to reduce per-revision CPU demand during health checks.
// - memory: keep small where possible; bump individual hot paths manually if needed.
// - maxInstances: limit global fan-out; scheduled/backfill jobs can override.
setGlobalOptions({
	region: REGION,
	cpu: 0.25,
	memory: '256MiB',
	maxInstances: 1
});