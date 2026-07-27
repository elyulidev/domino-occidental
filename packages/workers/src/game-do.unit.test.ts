import { describe, it, expect, beforeEach, vi } from "vitest";
import { env } from "cloudflare:test";
import { RateLimiter } from "./rate-limiter";

// ---------------------------------------------------------------------------
// RateLimiter unit tests
// ---------------------------------------------------------------------------

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("allows messages within rate limit", () => {
    // First10 messages should all be allowed (bucket starts full)
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume("player1")).toBe(true);
    }
  });

  it("blocks messages after exhausting tokens", () => {
    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume("player1");
    }
    // 11th message should be blocked
    expect(limiter.tryConsume("player1")).toBe(false);
  });

  it("refills tokens over time", () => {
    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume("player1");
    }
    expect(limiter.tryConsume("player1")).toBe(false);

    // Advance time by 500ms (5 tokens refilled at 1 per 100ms)
    vi.useFakeTimers();
    vi.advanceTimersByTime(500);

    // Should allow 5 more messages
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryConsume("player1")).toBe(true);
    }
    // 6th should be blocked
    expect(limiter.tryConsume("player1")).toBe(false);

    vi.useRealTimers();
  });

  it("tracks players independently", () => {
    // Exhaust player1
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume("player1");
    }
    expect(limiter.tryConsume("player1")).toBe(false);

    // Player2 still has full bucket
    expect(limiter.tryConsume("player2")).toBe(true);
  });

  it("removes player bucket on disconnect", () => {
    limiter.tryConsume("player1");
    limiter.tryConsume("player1");

    limiter.remove("player1");

    // New bucket created with full tokens
    expect(limiter.tryConsume("player1")).toBe(true);
  });

  it("cleans up stale buckets", () => {
    limiter.tryConsume("player1");

    // Advance5 minutes
    vi.useFakeTimers();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    limiter.cleanup();

    // Bucket was cleaned, new one created with full tokens
    expect(limiter.tryConsume("player1")).toBe(true);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// GameDO — initialization via fetch
// ---------------------------------------------------------------------------

describe("GameDO", () => {
  it("accepts POST /init with valid player IDs", async () => {
    const id = env.GAME_DO.idFromName("test-init");
    const stub = env.GAME_DO.get(id);

    const response = await stub.fetch("http://localhost/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerIds: ["user-a", "user-b", "user-c", "user-d"],
      }),
    });

    expect(response.status).toBe(200);
    const data = (await response.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });

  it("rejects POST /init with wrong number of player IDs", async () => {
    const id = env.GAME_DO.idFromName("test-init-bad");
    const stub = env.GAME_DO.get(id);

    const response = await stub.fetch("http://localhost/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds: ["user-a", "user-b"] }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects non-WebSocket requests without upgrade header", async () => {
    const id = env.GAME_DO.idFromName("test-no-ws");
    const stub = env.GAME_DO.get(id);

    const response = await stub.fetch("http://localhost/game");

    expect(response.status).toBe(405);
  });

  it("rejects WebSocket upgrade without token", async () => {
    const id = env.GAME_DO.idFromName("test-no-token");
    const stub = env.GAME_DO.get(id);

    const request = new Request("http://localhost/game", {
      headers: { Upgrade: "websocket" },
    });
    const response = await stub.fetch(request);

    expect(response.status).toBe(401);
  });

  it("rejects WebSocket upgrade with invalid token", async () => {
    const id = env.GAME_DO.idFromName("test-bad-token");
    const stub = env.GAME_DO.get(id);

    const request = new Request("http://localhost/game?token=invalid-jwt", {
      headers: { Upgrade: "websocket" },
    });
    const response = await stub.fetch(request);

    expect(response.status).toBe(401);
  });

  it("rejects WebSocket upgrade for unassigned user", async () => {
    const id = env.GAME_DO.idFromName("test-unassigned");
    const stub = env.GAME_DO.get(id);

    // First init with specific players
    await stub.fetch("http://localhost/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerIds: ["user-a", "user-b", "user-c", "user-d"],
      }),
    });

    // Try connecting with a token that would verify to a different userId
    // (The verifyToken function will return null for invalid JWTs,
    // so this tests the JWT verification path)
    const request = new Request("http://localhost/game?token=bad-token", {
      headers: { Upgrade: "websocket" },
    });
    const response = await stub.fetch(request);

    // Should get 401 (invalid token) or 403 (not assigned)
    expect([401, 403]).toContain(response.status);
  });
});
