import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMatchmakingDO(name?: string) {
  const id = env.MATCHMAKING_DO.idFromName(name ?? `test-mm-${crypto.randomUUID()}`);
  return env.MATCHMAKING_DO.get(id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MatchmakingDO Integration", () => {
  it("enqueue adds player to queue", async () => {
    const stub = getMatchmakingDO("test-enqueue");

    const response = await stub.fetch("http://do/matchmaking/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", elo: 1400 }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; queueCount: number };
    expect(body.ok).toBe(true);
    expect(body.queueCount).toBe(1);
  });

  it("leave removes player from queue", async () => {
    const stub = getMatchmakingDO("test-leave");

    // Enqueue first
    await stub.fetch("http://do/matchmaking/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-leave", elo: 1400 }),
    });

    // Leave
    const response = await stub.fetch("http://do/matchmaking/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-leave" }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; queueCount: number };
    expect(body.ok).toBe(true);
    expect(body.queueCount).toBe(0);
  });

  it("rejects leave for user not in queue", async () => {
    const stub = getMatchmakingDO("test-leave-notfound");

    const response = await stub.fetch("http://do/matchmaking/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "nonexistent" }),
    });

    expect(response.status).toBe(404);
  });

  it("rejects enqueue with missing fields", async () => {
    const stub = getMatchmakingDO("test-enqueue-invalid");

    const response = await stub.fetch("http://do/matchmaking/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1" }), // missing elo
    });

    expect(response.status).toBe(400);
  });

  it("status returns queue info", async () => {
    const stub = getMatchmakingDO("test-status");

    // Enqueue 2 players
    await stub.fetch("http://do/matchmaking/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "status-user-1", elo: 1400 }),
    });
    await stub.fetch("http://do/matchmaking/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "status-user-2", elo: 1500 }),
    });

    const response = await stub.fetch("http://do/matchmaking/status", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      queueCount: number;
      queue: Array<{ userId: string; elo: number }>;
    };
    expect(body.queueCount).toBe(2);
    expect(body.queue[0].userId).toBe("status-user-1");
    expect(body.queue[1].userId).toBe("status-user-2");
  });

  it("returns 404 for unknown HTTP paths", async () => {
    const stub = getMatchmakingDO("test-404");

    const response = await stub.fetch("http://do/matchmaking/unknown", {
      method: "POST",
    });

    expect(response.status).toBe(404);
  });
});
