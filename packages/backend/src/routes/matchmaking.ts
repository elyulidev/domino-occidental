/**
 * Matchmaking REST endpoints.
 *
 * - POST /matchmaking/quick   — join the queue (auth required)
 * - POST /matchmaking/leave   — leave the queue (auth required)
 * - GET  /matchmaking/status  — queue status (auth required)
 *
 * All endpoints verify the JWT via verifyToken() and extract the userId.
 * The queue instance is injected via the factory function.
 *
 * @see openspec/changes/quick-match-queue/spec.md R1–R3
 */

import { Elysia } from "elysia";
import { verifyToken } from "../auth/verify-token";
import type { createMatchmakingQueue } from "../game/matchmaking";
import { resolvePartner } from "../game/matchmaking";

type Queue = ReturnType<typeof createMatchmakingQueue>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractUserId(headers: Record<string, string | undefined>): string | null {
  const authHeader = headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

// ---------------------------------------------------------------------------
// Routes factory
// ---------------------------------------------------------------------------

export function matchmakingRoutes(queue: Queue) {
  return new Elysia({ name: "matchmaking-routes" })
    // -------------------------------------------------------------------
    // POST /matchmaking/quick — join queue
    // -------------------------------------------------------------------
    .post("/matchmaking/quick", async ({ headers, set }) => {
      const token = extractUserId(headers);
      if (!token) {
        set.status = 401;
        return { error: "unauthorized" };
      }

      const user = await verifyToken(token);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }

      const userId = user.sub;

      // Check if already in queue
      const existing = queue.getQueue().find((e) => e.userId === userId);
      if (existing) {
        set.status = 409;
        return { error: "already_in_queue" };
      }

      // Resolve partner (best-effort — fallback to solo on failure)
      let partnerResult: { partnerId: string; pairId: string } | null = null;
      let partnerInQueue = false;

      try {
        partnerResult = await resolvePartner(userId);
        if (partnerResult) {
          // Check if partner is already in the queue
          partnerInQueue = queue
            .getQueue()
            .some((e) => e.userId === partnerResult?.partnerId);
        }
      } catch {
        // Fallback: enqueue as solo
      }

      // Determine queue type and ELO
      // TODO: In PR 2, we'll fetch the user's ELO from the profiles table.
      // For now, use a placeholder (1200 default).
      const userElo = 1200;

      if (partnerResult && partnerInQueue) {
        // Both partners in queue — enqueue as a pair
        queue.enqueue({
          userId,
          elo: userElo,
          joinedAt: Date.now(),
          pairId: partnerResult.pairId,
          partnerId: partnerResult.partnerId,
          eloType: "pair",
        });
      } else {
        // Solo enqueue
        queue.enqueue({
          userId,
          elo: userElo,
          joinedAt: Date.now(),
          eloType: "individual",
        });
      }

      const position = queue.getQueue().findIndex((e) => e.userId === userId) + 1;
      const queueType = partnerResult && partnerInQueue ? "pair" : "individual";

      return {
        queued: true,
        position,
        queueType,
      };
    })
    // -------------------------------------------------------------------
    // POST /matchmaking/leave — leave queue
    // -------------------------------------------------------------------
    .post("/matchmaking/leave", async ({ headers, set }) => {
      const token = extractUserId(headers);
      if (!token) {
        set.status = 401;
        return { error: "unauthorized" };
      }

      const user = await verifyToken(token);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }

      const userId = user.sub;
      const entry = queue.getQueue().find((e) => e.userId === userId);

      if (!entry) {
        return { left: true };
      }

      // If user was in a pair, also dequeue the partner
      if (entry.partnerId) {
        queue.dequeue(entry.partnerId);
      }

      queue.dequeue(userId);

      return { left: true };
    })
    // -------------------------------------------------------------------
    // GET /matchmaking/status — queue status
    // -------------------------------------------------------------------
    .get("/matchmaking/status", async ({ headers, set }) => {
      const token = extractUserId(headers);
      if (!token) {
        set.status = 401;
        return { error: "unauthorized" };
      }

      const user = await verifyToken(token);
      if (!user) {
        set.status = 401;
        return { error: "unauthorized" };
      }

      const userId = user.sub;
      const entries = queue.getQueue();
      const entry = entries.find((e) => e.userId === userId);

      if (!entry) {
        return {
          inQueue: false,
          queueType: null,
          position: 0,
          estimatedWait: 0,
          queueCount: entries.length,
        };
      }

      const position = entries.indexOf(entry) + 1;

      // Estimate wait based on oldest player's time in queue
      const oldestWait = entries.reduce(
        (min, e) => Math.min(min, Date.now() - e.joinedAt),
        Number.POSITIVE_INFINITY,
      );

      return {
        inQueue: true,
        queueType: entry.eloType,
        position,
        estimatedWait: Math.round(oldestWait / 1000),
        queueCount: entries.length,
      };
    });
}
