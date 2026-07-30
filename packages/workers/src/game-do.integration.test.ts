import { describe, it, expect, beforeAll } from "vitest";
import { importJWK, type JWK, type KeyLike, SignJWT } from "jose";
import { env } from "cloudflare:test";
import { jwksFromPayload } from "./auth";

// ---------------------------------------------------------------------------
// Test key setup
// ---------------------------------------------------------------------------
// We generate an ECDSA P-256 key pair (ES256) — the same algorithm Supabase
// uses for its JWKS signing keys. The public key is published as a local
// JWKS via env.SUPABASE_JWKS, and the private key signs test tokens.
// ---------------------------------------------------------------------------

let privateKey: KeyLike;
let jwksPayload: string;

beforeAll(async () => {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );

  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  privateKey = await importJWK(privJwk, "ES256");

  const rawPub = (await crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey,
  )) as unknown as JWK;
  jwksPayload = JSON.stringify({ keys: [rawPub] });

  // Inject the local JWKS so the DO uses our test keys instead of remote Supabase
  (env as Record<string, unknown>).SUPABASE_JWKS = jwksPayload;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuedAt()
    .sign(privateKey);
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
