/**
 * Integration tests for matchmaking REST endpoints.
 *
 * Tests POST /quick, POST /leave, and GET /status by creating an Elysia
 * app with mocked verifyToken and a real queue instance.
 *
 * @see openspec/changes/quick-match-queue/tasks.md §8.4–8.7
 */

// Set env BEFORE any imports (ESM hoists imports above all statements)
process.env.SUPABASE_JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Elysia } from "elysia";
import { createMatchmakingQueue, resolvePartner } from "../../game/matchmaking";
import { signToken } from "../../test-utils";
import { matchmakingRoutes } from "../matchmaking";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

function createTestApp(queue: ReturnType<typeof createMatchmakingQueue>) {
  return new Elysia().use(matchmakingRoutes(queue));
}

describe("Matchmaking REST endpoints", () => {
  let queue: ReturnType<typeof createMatchmakingQueue>;
  let now: number;
  let dateNowSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    queue = createMatchmakingQueue();
    now = Date.now();
    dateNowSpy = spyOn(Date, "now").mockReturnValue(now);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  // --- POST /matchmaking/quick ---

  describe("POST /matchmaking/quick", () => {
    it("returns 200 with queued=true for valid token", async () => {
      const app = createTestApp(queue);
      const token = await signToken("user-1");

      const res = await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.queued).toBe(true);
      expect(body.position).toBe(1);
      expect(body.queueType).toBe("individual");
    });

    it("returns 401 without Authorization header", async () => {
      const app = createTestApp(queue);

      const res = await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
        }),
      );

      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error).toBe("unauthorized");
    });

    it("returns 409 when user is already in queue", async () => {
      const app = createTestApp(queue);
      const token = await signToken("user-1");

      // First join succeeds
      const res1 = await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res1.status).toBe(200);

      // Second join returns 409
      const res2 = await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      expect(res2.status).toBe(409);
      const body = (await res2.json()) as any;
      expect(body.error).toBe("already_in_queue");
    });

    it("increments queue position for subsequent joins", async () => {
      const app = createTestApp(queue);
      const token1 = await signToken("user-1");
      const token2 = await signToken("user-2");

      await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token1}` },
        }),
      );

      const res = await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token2}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.position).toBe(2);
    });

    it("enqueues as solo when resolvePartner throws (fallback)", async () => {
      const app = createTestApp(queue);
      const token = await signToken("user-1");

      // Mock resolvePartner to throw
      const resolveSpy = spyOn(resolvePartner as any, "call" as any).mockImplementation(
        (() => {
          throw new Error("DB connection failed");
        }) as any,
      );

      try {
        const res = await app.handle(
          new Request("http://localhost/matchmaking/quick", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }),
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.queued).toBe(true);
        expect(body.queueType).toBe("individual");
        expect(queue.getQueueSize()).toBe(1);
        expect(queue.getQueue()[0].eloType).toBe("individual");
      } finally {
        resolveSpy.mockRestore();
      }
    });
  });

  // --- POST /matchmaking/leave ---

  describe("POST /matchmaking/leave", () => {
    it("returns 200 with left=true when user is in queue", async () => {
      const app = createTestApp(queue);
      const token = await signToken("user-1");

      // Join first
      await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      expect(queue.getQueueSize()).toBe(1);

      // Leave
      const res = await app.handle(
        new Request("http://localhost/matchmaking/leave", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.left).toBe(true);
      expect(queue.getQueueSize()).toBe(0);
    });

    it("returns 200 even when user is not in queue", async () => {
      const app = createTestApp(queue);
      const token = await signToken("user-1");

      const res = await app.handle(
        new Request("http://localhost/matchmaking/leave", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.left).toBe(true);
    });

    it("returns 401 without Authorization header", async () => {
      const app = createTestApp(queue);

      const res = await app.handle(
        new Request("http://localhost/matchmaking/leave", {
          method: "POST",
        }),
      );

      expect(res.status).toBe(401);
    });
  });

  // --- GET /matchmaking/status ---

  describe("GET /matchmaking/status", () => {
    it("returns inQueue=false when user is not in queue", async () => {
      const app = createTestApp(queue);
      const token = await signToken("user-1");

      const res = await app.handle(
        new Request("http://localhost/matchmaking/status", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.inQueue).toBe(false);
      expect(body.queueType).toBeNull();
      expect(body.position).toBe(0);
    });

    it("returns correct status when user is in queue", async () => {
      const app = createTestApp(queue);
      const token = await signToken("user-1");

      // Join first
      await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      const res = await app.handle(
        new Request("http://localhost/matchmaking/status", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.inQueue).toBe(true);
      expect(body.queueType).toBe("individual");
      expect(body.position).toBe(1);
      expect(body.queueCount).toBe(1);
    });

    it("returns correct position with multiple players", async () => {
      const app = createTestApp(queue);
      const token1 = await signToken("user-1");
      const token2 = await signToken("user-2");
      const token3 = await signToken("user-3");

      // All join
      await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token1}` },
        }),
      );
      await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token2}` },
        }),
      );
      await app.handle(
        new Request("http://localhost/matchmaking/quick", {
          method: "POST",
          headers: { Authorization: `Bearer ${token3}` },
        }),
      );

      // Check status of user-2
      const res = await app.handle(
        new Request("http://localhost/matchmaking/status", {
          headers: { Authorization: `Bearer ${token2}` },
        }),
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.inQueue).toBe(true);
      expect(body.position).toBe(2);
      expect(body.queueCount).toBe(3);
    });

    it("returns 401 without Authorization header", async () => {
      const app = createTestApp(queue);

      const res = await app.handle(
        new Request("http://localhost/matchmaking/status"),
      );

      expect(res.status).toBe(401);
    });
  });

  // --- Cleanup for stale entries ---

  describe("Stale entry cleanup", () => {
    it("removes stale entries on cleanup", () => {
      queue.enqueue({ userId: "u1", elo: 1500, joinedAt: now - 61_000, eloType: "individual" });
      queue.enqueue({ userId: "u2", elo: 1500, joinedAt: now, eloType: "individual" });

      const removed = queue.cleanupStale();
      expect(removed).toContain("u1");
      expect(removed).not.toContain("u2");
      expect(queue.getQueueSize()).toBe(1);
    });
  });
});
