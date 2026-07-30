// ---------------------------------------------------------------------------
// Token Bucket Rate Limiter
// ---------------------------------------------------------------------------

/**
 * Per-player token bucket rate limiter for WebSocket messages.
 *
 * Limits each player to 10 messages/second (matching the backend limit).
 * Tokens refill at 1 per 100ms. The bucket capacity is 10.
 *
 * State is kept in-memory per DO instance. If the DO hibernates and
 * wakes up, the bucket resets — which is acceptable because the player
 * won't be sending messages while hibernated.
 */

const MAX_TOKENS = 10;
const REFILL_INTERVAL_MS = 100;
const REFILL_AMOUNT = 1;

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();

  /**
   * Attempt to consume one token for the given player.
   * Returns true if the message is allowed, false if rate-limited.
   */
  tryConsume(playerId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(playerId);

    if (!bucket) {
      bucket = { tokens: MAX_TOKENS, lastRefill: now };
      this.buckets.set(playerId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const refillCount = Math.floor(elapsed / REFILL_INTERVAL_MS) * REFILL_AMOUNT;
      if (refillCount > 0) {
        bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + refillCount);
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens <= 0) {
      return false;
    }

    bucket.tokens -= 1;
    return true;
  }

  /**
   * Remove a player's bucket (on disconnect).
   */
  remove(playerId: string): void {
    this.buckets.delete(playerId);
  }

  /**
   * Clean up buckets older than 5 minutes.
   */
  cleanup(): void {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [playerId, bucket] of this.buckets) {
      if (now - bucket.lastRefill > staleThreshold) {
        this.buckets.delete(playerId);
      }
    }
  }
}
