// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimiter {
  /**
   * Try to consume one token from the bucket for the given connection.
   * @returns `true` if allowed, `false` if rate-limited.
   */
  tryConsume(connectionId: string): boolean;

  /**
   * Remove stale buckets that haven't been touched in `staleMs`.
   * Returns the number of buckets cleaned up.
   */
  cleanupStale(): number;

  /**
   * Get internal bucket state (for testing/inspection only).
   */
  _debug(): Map<string, BucketState>;
}

export interface RateLimiterOptions {
  /** Maximum tokens per bucket (default: 10) */
  maxTokens?: number;
  /** Refill rate in tokens per second (default: 10) */
  refillRate?: number;
  /** Stale timeout in milliseconds (default: 5 min) */
  staleMs?: number;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

export interface BucketState {
  tokens: number;
  lastRefill: number; // timestamp in ms
  lastAccess: number; // timestamp in ms
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a token-bucket rate limiter.
 *
 * Each connection has its own bucket with `maxTokens` capacity.
 * Tokens refill continuously at `refillRate` per second.
 * Buckets idle longer than `staleMs` are eligible for cleanup.
 */
export function createRateLimiter(
  options: RateLimiterOptions = {},
): RateLimiter {
  const { maxTokens = 10, refillRate = 10, staleMs = 5 * 60 * 1000 } = options;

  const buckets = new Map<string, BucketState>();

  /** Refill the given bucket based on elapsed time. */
  function refill(bucket: BucketState): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    if (elapsed <= 0) return;

    const tokensToAdd = (elapsed / 1000) * refillRate;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  return {
    tryConsume(connectionId: string): boolean {
      let bucket = buckets.get(connectionId);
      if (!bucket) {
        bucket = {
          tokens: maxTokens,
          lastRefill: Date.now(),
          lastAccess: Date.now(),
        };
        buckets.set(connectionId, bucket);
      } else {
        bucket.lastAccess = Date.now();
      }

      refill(bucket);

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }

      return false;
    },

    cleanupStale(): number {
      const now = Date.now();
      let cleaned = 0;
      for (const [id, bucket] of buckets) {
        if (now - bucket.lastAccess > staleMs) {
          buckets.delete(id);
          cleaned++;
        }
      }
      return cleaned;
    },

    _debug(): Map<string, BucketState> {
      return new Map(buckets);
    },
  };
}
