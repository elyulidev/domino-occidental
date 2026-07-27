import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const JWT_SECRET = "dev-jwt-secret-change-in-production";

/**
 * Create a minimal HS256 JWT for testing.
 * Uses crypto.subtle which is available in CF Workers runtime.
 */
async function makeToken(userId: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: userId, userId }));
  const data = `${header}.${payload}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(JWT_SECRET);
  const dataBytes = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${data}.${signature}`;
}

function getGameDO(matchId: string) {
  const id = env.GAME_DO.idFromName(matchId);
  return env.GAME_DO.get(id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GameDO Integration", () => {
  const playerIds = ["player-1", "player-2", "player-3", "player-4"];

  it("rejects WS without token", async () => {
    const matchId = `test-no-token-${crypto.randomUUID()}`;
    const stub = getGameDO(matchId);

    // Init first
    await stub.fetch("http://do/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds }),
    });

    // Try WS without token
    const response = await stub.fetch("http://do/ws/game/test", {
      headers: { Upgrade: "websocket" },
    });

    expect(response.status).toBe(401);
  });

  it("rejects WS for player not in match", async () => {
    const matchId = `test-not-in-match-${crypto.randomUUID()}`;
    const stub = getGameDO(matchId);

    // Init with specific player IDs
    await stub.fetch("http://do/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds }),
    });

    // Try to connect as unknown player
    const token = await makeToken("unknown-player");
    const response = await stub.fetch(
      `http://do/ws/game/test?token=${token}`,
      { headers: { Upgrade: "websocket" } },
    );

    expect(response.status).toBe(403);
  });

  it("accepts POST /init with 4 player IDs", async () => {
    const matchId = `test-init-ok-${crypto.randomUUID()}`;
    const stub = getGameDO(matchId);

    const response = await stub.fetch("http://do/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("rejects POST /init with wrong number of players", async () => {
    const matchId = `test-init-bad-${crypto.randomUUID()}`;
    const stub = getGameDO(matchId);

    const response = await stub.fetch("http://do/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds: ["p1", "p2"] }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects duplicate WS connection from same user", async () => {
    const matchId = `test-dup-${crypto.randomUUID()}`;
    const stub = getGameDO(matchId);

    // Init
    await stub.fetch("http://do/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds }),
    });

    // First connection should work
    const token = await makeToken(playerIds[0]);
    const response1 = await stub.fetch(
      `http://do/ws/game/test?token=${token}`,
      { headers: { Upgrade: "websocket" } },
    );
    expect(response1.status).toBe(101);

    // Second connection from same user should be rejected
    const response2 = await stub.fetch(
      `http://do/ws/game/test?token=${token}`,
      { headers: { Upgrade: "websocket" } },
    );
    expect(response2.status).toBe(409);
  });

  it("rejects non-WebSocket request to WS endpoint", async () => {
    const matchId = `test-no-ws-${crypto.randomUUID()}`;
    const stub = getGameDO(matchId);

    // Init
    await stub.fetch("http://do/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerIds }),
    });

    const token = await makeToken(playerIds[0]);
    const response = await stub.fetch(
      `http://do/ws/game/test?token=${token}`,
      { method: "GET" },
    );

    expect(response.status).toBe(405);
  });
});
