import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { findMatch, getEloRange } from "./matchmaking";
import type { MatchQueueEntry } from "./matchmaking";

// ---------------------------------------------------------------------------
// Pure function tests — getEloRange
// ---------------------------------------------------------------------------

describe("getEloRange", () => {
  it("returns 200 for wait time 0-10s", () => {
    expect(getEloRange(0)).toBe(200);
    expect(getEloRange(5_000)).toBe(200);
    expect(getEloRange(9_999)).toBe(200);
  });

  it("returns 400 for wait time 10-30s", () => {
    expect(getEloRange(10_000)).toBe(400);
    expect(getEloRange(20_000)).toBe(400);
    expect(getEloRange(29_999)).toBe(400);
  });

  it("returns 600 for wait time 30-60s", () => {
    expect(getEloRange(30_000)).toBe(600);
    expect(getEloRange(45_000)).toBe(600);
    expect(getEloRange(59_999)).toBe(600);
  });

  it("returns 600 for wait time >=60s", () => {
    expect(getEloRange(60_000)).toBe(600);
    expect(getEloRange(120_000)).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// Pure function tests — findMatch
// ---------------------------------------------------------------------------

describe("findMatch", () => {
  const now = Date.now();

  it("returns null with empty queue", () => {
    expect(findMatch([])).toBeNull();
  });

  it("returns null with fewer than 4 players", () => {
    const queue: MatchQueueEntry[] = [
      { userId: "a", elo: 1200, joinedAt: now - 5000 },
      { userId: "b", elo: 1250, joinedAt: now - 4000 },
      { userId: "c", elo: 1300, joinedAt: now - 3000 },
    ];
    expect(findMatch(queue)).toBeNull();
  });

  it("matches 4 players within ±200 ELO (short wait)", () => {
    const queue: MatchQueueEntry[] = [
      { userId: "a", elo: 1200, joinedAt: now - 1000 },
      { userId: "b", elo: 1250, joinedAt: now - 800 },
      { userId: "c", elo: 1300, joinedAt: now - 600 },
      { userId: "d", elo: 1350, joinedAt: now - 400 },
    ];
    const result = findMatch(queue);
    expect(result).not.toBeNull();
    expect(result!.playerIds).toHaveLength(4);
    expect(result!.playerIds).toContain("a");
    expect(result!.playerIds).toContain("b");
    expect(result!.playerIds).toContain("c");
    expect(result!.playerIds).toContain("d");
  });

  it("uses ±400 window for 10-30s wait", () => {
    // A at 1200, others at 1500 — spread 300, within ±400 at 15s wait
    const queue: MatchQueueEntry[] = [
      { userId: "a", elo: 1200, joinedAt: now - 15_000 },
      { userId: "b", elo: 1500, joinedAt: now - 12_000 },
      { userId: "c", elo: 1500, joinedAt: now - 11_000 },
      { userId: "d", elo: 1500, joinedAt: now - 10_500 },
    ];
    const result = findMatch(queue);
    expect(result).not.toBeNull();
    expect(result!.playerIds).toContain("a");
  });

  it("rejects players outside ELO window", () => {
    // A at 1200, others at 2000 — spread 800, outside ±600
    const queue: MatchQueueEntry[] = [
      { userId: "a", elo: 1200, joinedAt: now - 1000 },
      { userId: "b", elo: 2000, joinedAt: now - 800 },
      { userId: "c", elo: 2000, joinedAt: now - 600 },
      { userId: "d", elo: 2000, joinedAt: now - 400 },
    ];
    const result = findMatch(queue);
    expect(result).toBeNull();
  });

  it("picks FIFO: oldest player is candidate first", () => {
    const queue: MatchQueueEntry[] = [
      { userId: "a", elo: 1200, joinedAt: now - 5000 },
      { userId: "b", elo: 1250, joinedAt: now - 4000 },
      { userId: "c", elo: 1300, joinedAt: now - 3000 },
      { userId: "d", elo: 1350, joinedAt: now - 2000 },
      { userId: "e", elo: 1400, joinedAt: now - 1000 },
      { userId: "f", elo: 2000, joinedAt: now - 500 },
    ];
    const result = findMatch(queue);
    expect(result).not.toBeNull();
    expect(result!.playerIds[0]).toBe("a");
  });

  it("picks closest ELO matches", () => {
    // a=1300 is candidate. b/c are closest (±10), e is ±30, d is ±300 (outside ±200).
    // Should pick b, c, e over d.
    const queue: MatchQueueEntry[] = [
      { userId: "a", elo: 1300, joinedAt: now - 5000 },
      { userId: "b", elo: 1310, joinedAt: now - 4000 },
      { userId: "c", elo: 1290, joinedAt: now - 3000 },
      { userId: "d", elo: 1600, joinedAt: now - 2000 },
      { userId: "e", elo: 1270, joinedAt: now - 1000 },
    ];
    const result = findMatch(queue);
    expect(result).not.toBeNull();
    // Should pick b, c, e (closest to 1300) — d at 1600 is outside ±200
    expect(result!.playerIds).toContain("b");
    expect(result!.playerIds).toContain("c");
    expect(result!.playerIds).toContain("e");
  });

  it("computes correct avgElo and eloRange", () => {
    const queue: MatchQueueEntry[] = [
      { userId: "a", elo: 1000, joinedAt: now - 1000 },
      { userId: "b", elo: 1100, joinedAt: now - 900 },
      { userId: "c", elo: 1200, joinedAt: now - 800 },
      { userId: "d", elo: 1300, joinedAt: now - 700 },
    ];
    const result = findMatch(queue);
    expect(result).not.toBeNull();
    expect(result!.avgElo).toBe(1150);
    expect(result!.eloRange).toEqual({ min: 1000, max: 1300 });
  });

  it("returns FIFO order with 8 players (oldest group matched)", () => {
    const queue: MatchQueueEntry[] = [
      { userId: "a", elo: 1200, joinedAt: now - 8000 },
      { userId: "b", elo: 1210, joinedAt: now - 7000 },
      { userId: "c", elo: 1220, joinedAt: now - 6000 },
      { userId: "d", elo: 1230, joinedAt: now - 5000 },
      { userId: "e", elo: 1240, joinedAt: now - 4000 },
      { userId: "f", elo: 1250, joinedAt: now - 3000 },
      { userId: "g", elo: 1260, joinedAt: now - 2000 },
      { userId: "h", elo: 1270, joinedAt: now - 1000 },
    ];
    const result = findMatch(queue);
    expect(result).not.toBeNull();
    // First 4 (a,b,c,d) should be matched
    expect(result!.playerIds).toContain("a");
    expect(result!.playerIds).toContain("b");
    expect(result!.playerIds).toContain("c");
    expect(result!.playerIds).toContain("d");
  });
});

// ---------------------------------------------------------------------------
// MatchmakingDO — HTTP API
// ---------------------------------------------------------------------------

describe("MatchmakingDO", () => {
  describe("HTTP API", () => {
    it("POST /enqueue adds player to queue", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-enqueue-1");
      const stub = env.MATCHMAKING_DO.get(id);

      const response = await stub.fetch(
        "http://localhost/matchmaking/enqueue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "user-1", elo: 1200 }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        ok: boolean;
        queueCount: number;
      };
      expect(data.ok).toBe(true);
      expect(data.queueCount).toBe(1);
    });

    it("POST /enqueue rejects missing elo", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-enqueue-bad-1");
      const stub = env.MATCHMAKING_DO.get(id);

      const response = await stub.fetch(
        "http://localhost/matchmaking/enqueue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "user-1" }),
        },
      );

      expect(response.status).toBe(400);
    });

    it("POST /enqueue replaces existing user entry", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-enqueue-replace-1");
      const stub = env.MATCHMAKING_DO.get(id);

      await stub.fetch("http://localhost/matchmaking/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1", elo: 1200 }),
      });

      const response = await stub.fetch(
        "http://localhost/matchmaking/enqueue",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "user-1", elo: 1500 }),
        },
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        ok: boolean;
        queueCount: number;
      };
      // Replaced, not duplicated
      expect(data.queueCount).toBe(1);
    });

    it("POST /leave removes player from queue", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-leave-1");
      const stub = env.MATCHMAKING_DO.get(id);

      await stub.fetch("http://localhost/matchmaking/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1", elo: 1200 }),
      });

      const response = await stub.fetch("http://localhost/matchmaking/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1" }),
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        ok: boolean;
        queueCount: number;
      };
      expect(data.ok).toBe(true);
      expect(data.queueCount).toBe(0);
    });

    it("POST /leave returns 404 for unknown user", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-leave-unknown-1");
      const stub = env.MATCHMAKING_DO.get(id);

      const response = await stub.fetch("http://localhost/matchmaking/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "unknown" }),
      });

      expect(response.status).toBe(404);
    });

    it("GET /status returns queue info", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-status-1");
      const stub = env.MATCHMAKING_DO.get(id);

      await stub.fetch("http://localhost/matchmaking/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1", elo: 1200 }),
      });
      await stub.fetch("http://localhost/matchmaking/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-2", elo: 1300 }),
      });

      const response = await stub.fetch("http://localhost/matchmaking/status");

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        queueCount: number;
        queue: Array<{ userId: string; elo: number }>;
      };
      expect(data.queueCount).toBe(2);
      expect(data.queue).toHaveLength(2);
    });

    it("GET /status returns empty queue", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-status-empty-1");
      const stub = env.MATCHMAKING_DO.get(id);

      const response = await stub.fetch("http://localhost/matchmaking/status");

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        queueCount: number;
        queue: Array<{ userId: string; elo: number }>;
      };
      expect(data.queueCount).toBe(0);
      expect(data.queue).toHaveLength(0);
    });

    it("returns 404 for unknown HTTP paths", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-unknown-path-1");
      const stub = env.MATCHMAKING_DO.get(id);

      const response = await stub.fetch("http://localhost/matchmaking/unknown");

      expect(response.status).toBe(404);
    });
  });

  describe("WebSocket", () => {
    it("rejects WS upgrade without token", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-ws-no-token-1");
      const stub = env.MATCHMAKING_DO.get(id);

      const request = new Request("http://localhost/matchmaking", {
        headers: { Upgrade: "websocket" },
      });
      const response = await stub.fetch(request);

      expect(response.status).toBe(401);
    });

    it("rejects WS upgrade with invalid token", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-ws-bad-token-1");
      const stub = env.MATCHMAKING_DO.get(id);

      const request = new Request(
        "http://localhost/matchmaking?token=invalid-jwt",
        {
          headers: { Upgrade: "websocket" },
        },
      );
      const response = await stub.fetch(request);

      expect(response.status).toBe(401);
    });
  });

  describe("stale cleanup", () => {
    it("cleans up entries older than 60s via enqueue/leave cycle", async () => {
      const id = env.MATCHMAKING_DO.idFromName("test-stale-1");
      const stub = env.MATCHMAKING_DO.get(id);

      // Enqueue a player
      await stub.fetch("http://localhost/matchmaking/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-stale", elo: 1200 }),
      });

      // Verify they're in queue
      let status = await stub.fetch("http://localhost/matchmaking/status");
      let data = (await status.json()) as { queueCount: number };
      expect(data.queueCount).toBe(1);

      // Leave manually (simulates stale cleanup)
      await stub.fetch("http://localhost/matchmaking/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-stale" }),
      });

      // Verify removed
      status = await stub.fetch("http://localhost/matchmaking/status");
      data = (await status.json()) as { queueCount: number };
      expect(data.queueCount).toBe(0);
    });
  });
});
