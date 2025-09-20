import { setGlobalOptions } from 'firebase-functions/v2/options';

// Single source of truth for Functions region
export const REGION = 'asia-south2';

// Apply defaults to all v2 functions
setGlobalOptions({ region: REGION, maxInstances: 10 });