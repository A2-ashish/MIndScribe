import { db } from './firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpError } from './httpError';

interface BucketConfig { capacity: number; windowMs: number; }

// Define rate limit buckets here for easy future extension.
const BUCKETS: Record<string, BucketConfig> = {
  entrySubmit: { capacity: 100, windowMs: 60 * 60 * 1000 } // 100 submissions per hour
};

interface RateDoc {
  userId: string;
  bucket: string;
  tokens: number; // current available tokens
  lastRefill: FirebaseFirestore.Timestamp;
}

export async function enforceRateLimit(userId: string, bucket: keyof typeof BUCKETS = 'entrySubmit') {
  const config = BUCKETS[bucket];
  if (!config) return; // unknown bucket => no limit

  const ref = db.collection('rateLimits').doc(`${bucket}_${userId}`);

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const now = Timestamp.now();
    let data: RateDoc;

    if (!snap.exists) {
      // Initialize with one token spent immediately.
      data = { userId, bucket, tokens: config.capacity - 1, lastRefill: now };
      tx.set(ref, data);
      return;
    }

    data = snap.data() as RateDoc;
    const elapsedMs = now.toMillis() - data.lastRefill.toMillis();
    if (elapsedMs < 0) {
      // Clock skew safeguard.
      data.lastRefill = now;
    }

    // Continuous refill based on elapsed time.
    const refillRatePerMs = config.capacity / config.windowMs; // tokens per ms
    const refillTokens = elapsedMs * refillRatePerMs;
    let newTokens = data.tokens + refillTokens;
    if (newTokens > config.capacity) newTokens = config.capacity; // cap

    if (newTokens < 1) {
      // Not enough tokens after refill -> reject
      const retryAfterMs = Math.ceil((1 - newTokens) / refillRatePerMs); // time until one token available
      throw new HttpError(429, 'Rate limit exceeded', 'rate_limit', { retryAfterMs, bucket, capacity: config.capacity });
    }

    // Spend one token
    data.tokens = newTokens - 1;
    data.lastRefill = now;
    tx.update(ref, { tokens: data.tokens, lastRefill: data.lastRefill });
  });
}
