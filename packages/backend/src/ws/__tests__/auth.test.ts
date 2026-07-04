import { beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import type { ElysiaWS } from "elysia/ws";
import { verifyToken } from "../auth";
import type { WsPlugin } from "../connection";
import { createWsPlugin } from "../connection";
import { GameStore } from "@domino/shared";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = "test-supabase-jwt-secret-1234567890";

/**
 * Create a valid HS256 JWT for testing.
 */
function createTestJwt(
  payload: Record<string, unknown>,
  secret = TEST_SECRET,
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  return `${headerB64}.${payloadB64}.${signature}`;
}

function createMockWs(overrides?: Partial<Record<string, unknown>>) {
  const data: Record<string, unknown> = {
    params: { matchId: "match-1" },
    playerId: "p1",
    matchId: "match-1",
    ...overrides,
  };
  return {
    send: () => {},
    close: () => {},
    data,
  } as unknown as ElysiaWS;
}

function makeMatch() {
  const now = new Date();
  return {
    matchId: "match-1",
    players: [
      {
        id: "test-user-id",
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

// ---------------------------------------------------------------------------
// Helper to extract ws handlers
// ---------------------------------------------------------------------------

function getHandler(plugin: WsPlugin) {
  return plugin.ws as unknown as Record<
    string,
    (...args: unknown[]) => void
  >;
}

// ---------------------------------------------------------------------------
// verifyToken unit tests
// ---------------------------------------------------------------------------

describe("verifyToken", () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  });

  it("accepts a valid JWT with userId", () => {
    const token = createTestJwt({
      userId: "test-user-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("test-user-id");
  });

  it("accepts a valid JWT with sub claim", () => {
    const token = createTestJwt({
      sub: "sub-user-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const result = verifyToken(token);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("sub-user-id");
  });

  it("rejects a token with invalid signature", () => {
    const token = createTestJwt(
      { userId: "test-user-id", exp: Math.floor(Date.now() / 1000) + 3600 },
      "wrong-secret",
    );
    const result = verifyToken(token);
    expect(result).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createTestJwt({
      userId: "test-user-id",
      exp: Math.floor(Date.now() / 1000) - 60, // expired 1 min ago
    });
    const result = verifyToken(token);
    expect(result).toBeNull();
  });

  it("rejects malformed token (not 3 parts)", () => {
    expect(verifyToken("not-a-jwt")).toBeNull();
    expect(verifyToken("two.parts")).toBeNull();
  });

  it("rejects token with missing userId", () => {
    const token = createTestJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const result = verifyToken(token);
    expect(result).toBeNull();
  });

  it("rejects token when SUPABASE_JWT_SECRET is not set", () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const token = createTestJwt({
      userId: "u1",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    expect(verifyToken(token)).toBeNull();
  });

  it("survives malformed payload (not valid JSON)", () => {
    const headerB64 = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payloadB64 = Buffer.from("not-json").toString("base64url");
    const signature = crypto
      .createHmac("sha256", TEST_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");
    const token = `${headerB64}.${payloadB64}.${signature}`;
    expect(verifyToken(token)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Connection plugin integration — JWT auth
// ---------------------------------------------------------------------------

describe("wsPlugin JWT auth integration", () => {
  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
  });

  it("rejects connection without token", () => {
    const ws = createMockWs({ query: undefined });
    const _closeSpy = (ws.close = () => {});

    const plugin = createWsPlugin({
      store: makeStore(),
      verifyToken,
      disconnectPlayer: () => ({ match: makeMatch(), events: [] }),
      reconnectPlayer: () => ({ match: makeMatch(), events: [] }),
    });

    const handlers = getHandler(plugin);
    handlers.open(ws);
    expect(plugin.manager.getConnection("test-user-id")).toBeUndefined();
  });

  it("rejects connection with invalid token", () => {
    const ws = createMockWs({ query: { token: "invalid-token" } });
    const _closeSpy = (ws.close = () => {});

    const plugin = createWsPlugin({
      store: makeStore(),
      verifyToken,
      disconnectPlayer: () => ({ match: makeMatch(), events: [] }),
      reconnectPlayer: () => ({ match: makeMatch(), events: [] }),
    });

    const handlers = getHandler(plugin);
    handlers.open(ws);
  });

  it("accepts connection with valid token and sets playerId from userId", () => {
    const token = createTestJwt({
      userId: "test-user-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const ws = createMockWs({ query: { token } });
    const match = makeMatch();

    const plugin = createWsPlugin({
      store: makeStore(match),
      verifyToken,
      disconnectPlayer: () => ({ match, events: [] }),
      reconnectPlayer: () => ({ match, events: [] }),
    });

    const handlers = getHandler(plugin);
    handlers.open(ws);

    // Should be registered with the userId from the JWT
    const conn = plugin.manager.getConnection("test-user-id");
    expect(conn).toBeDefined();
    expect(conn).toBe(ws);
  });

  it("calls reconnectPlayer after successful JWT auth", () => {
    const token = createTestJwt({
      userId: "test-user-id",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const ws = createMockWs({ query: { token } });
    const match = makeMatch();
    let reconnectCalled = false;

    const plugin = createWsPlugin({
      store: makeStore(match),
      verifyToken,
      disconnectPlayer: () => ({ match, events: [] }),
      reconnectPlayer: () => {
        reconnectCalled = true;
        return { match, events: [] };
      },
    });

    const handlers = getHandler(plugin);
    handlers.open(ws);

    expect(reconnectCalled).toBe(true);
  });
});
