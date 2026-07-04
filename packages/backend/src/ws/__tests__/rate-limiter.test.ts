import { beforeEach, describe, expect, it } from "bun:test";
import type { ElysiaWS } from "elysia/ws";
import type { WsPlugin } from "../connection";
import { createWsPlugin } from "../connection";
import type { RateLimiter } from "../rate-limiter";
import { createRateLimiter } from "../rate-limiter";
import { GameStore } from "@domino/shared";

// ---------------------------------------------------------------------------
// RateLimiter unit tests
// ---------------------------------------------------------------------------

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = createRateLimiter({ maxTokens: 10, refillRate: 10 });
  });

  it("allows up to 10 messages per second", () => {
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume("conn-1")).toBe(true);
    }
  });

  it("blocks the 11th message within the same second", () => {
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume("conn-1");
    }
    expect(limiter.tryConsume("conn-1")).toBe(false);
  });

  it("refills tokens over time", () => {
    // Consume all 10 tokens
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume("conn-1");
    }

    // 11th should be blocked
    expect(limiter.tryConsume("conn-1")).toBe(false);

    // Manually advance lastRefill to simulate 1 second passing
    const bucket = limiter._debug().get("conn-1")!;
    bucket.lastRefill = Date.now() - 1100; // 1.1 seconds ago

    // Now tryConsume should see 11+ tokens have refilled (10 * 1.1 = 11)
    expect(limiter.tryConsume("conn-1")).toBe(true);
  });

  it("isolates buckets per connection", () => {
    // Drain conn-1
    for (let i = 0; i < 10; i++) {
      limiter.tryConsume("conn-1");
    }
    expect(limiter.tryConsume("conn-1")).toBe(false);

    // conn-2 should still have full tokens
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume("conn-2")).toBe(true);
    }
  });

  it("removes stale buckets via cleanup", () => {
    // Create two buckets
    limiter.tryConsume("conn-1");
    limiter.tryConsume("conn-2");
    expect(limiter._debug().size).toBe(2);

    // Manipulate lastAccess to be older than staleMs
    const buckets = limiter._debug();
    const oldTime = Date.now() - 6 * 60 * 1000;
    // Override lastAccess on conn-1
    const b1 = buckets.get("conn-1")!;
    b1.lastAccess = oldTime;

    const cleaned = limiter.cleanupStale();
    expect(cleaned).toBe(1);
    expect(limiter._debug().size).toBe(1);
    expect(limiter._debug().has("conn-2")).toBe(true);
  });

  it("accepts empty cleanup with no buckets", () => {
    expect(limiter.cleanupStale()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers for connection integration tests
// ---------------------------------------------------------------------------

function makeMatch() {
  const now = new Date();
  return {
    matchId: "match-1",
    players: [
      {
        id: "p1",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: now,
      },
      {
        id: "p2",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: now,
      },
      {
        id: "p3",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: now,
      },
      {
        id: "p4",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: now,
      },
    ],
    board: { leftEnd: null, rightEnd: null, tiles: [] },
    turn: {
      currentTurn: 0,
      turnDeadline: null,
      consecutiveNullRounds: 0,
      roundNumber: 0,
      lastHandWinner: null,
    },
    scores: { scores: [0, 0], isTiebreaker: false },
    pool: [],
    poolCount: 0,
    status: "in_progress",
    targetScore: 200,
  };
}

function makeStore(
  match: ReturnType<typeof makeMatch> | null = null,
): GameStore {
  const getGame = () => match;
  return {
    getGame: getGame as GameStore["getGame"],
    updateGame: () => {},
  };
}

function createMockWs(playerId = "p1", matchId = "match-1") {
  return {
    send: () => {},
    data: { params: { matchId, playerId }, playerId, matchId },
  } as unknown as ElysiaWS;
}

function getHandler(plugin: WsPlugin) {
  return plugin.ws as unknown as Record<
    string,
    (...args: unknown[]) => void
  >;
}

// ---------------------------------------------------------------------------
// Connection plugin — rate limiter integration
// ---------------------------------------------------------------------------

describe("wsPlugin rate limiter integration", () => {
  it("passes messages through when under rate limit", () => {
    const rateLimiter = createRateLimiter({ maxTokens: 10, refillRate: 10 });
    let handleCalled = false;
    const plugin = createWsPlugin({
      store: makeStore(),
      rateLimiter,
      handleMessage: () => {
        handleCalled = true;
        return { events: [] };
      },
    });

    const ws = createMockWs("p1");
    const handlers = getHandler(plugin);
    handlers.message(ws, JSON.stringify({ type: "pass" }));

    expect(handleCalled).toBe(true);
  });

  it("blocks messages when over rate limit", () => {
    const rateLimiter = createRateLimiter({ maxTokens: 10, refillRate: 10 });
    let handleCalled = false;
    const _sent: Array<{ playerId: string; event: unknown }> = [];
    const _sendFnPlayerId = "";

    const plugin = createWsPlugin({
      store: makeStore(),
      rateLimiter,
      handleMessage: () => {
        handleCalled = true;
        return { events: [] };
      },
    });

    const ws = createMockWs("p1");
    const handlers = getHandler(plugin);

    // Register p1 first
    plugin.manager.register("match-1", "p1", ws);

    // Consume 10 tokens
    for (let i = 0; i < 10; i++) {
      handlers.message(ws, JSON.stringify({ type: "pass" }));
    }

    // 11th message — should be rate limited
    handleCalled = false;
    // Set up a spy on ws.send
    let sentData = "";
    ws.send = (data: string) => {
      sentData = data;
    };
    handlers.message(ws, JSON.stringify({ type: "pass" }));

    expect(handleCalled).toBe(false);
    expect(sentData).toBeTruthy();
    const parsed = JSON.parse(sentData);
    expect(parsed.type).toBe("game_events");
    expect(parsed.events[0].code).toBe("RATE_LIMITED");
  });
});
