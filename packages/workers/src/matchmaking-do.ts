import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";
import { verifyToken } from "./auth";
import { findMatch, type MatchQueueEntry } from "./matchmaking";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLEANUP_THRESHOLD_MS = 60_000;
const MATCHING_INTERVAL_MS = 2_000;

// ---------------------------------------------------------------------------
// MatchmakingDO
// ---------------------------------------------------------------------------

/**
 * Singleton Durable Object for matchmaking queue and matching loop.
 *
 * Manages a queue of players waiting for a match. The alarm() fires every 2s
 * to run the matching algorithm, create GameDO stubs for matches, and broadcast
 * queue positions to connected players.
 *
 * HTTP API:
 *   POST /enqueue { userId, elo } — add player to queue
 *   POST /leave   { userId }      — remove player from queue
 *   GET  /status                  — queue info
 *
 * WebSocket:
 *   /matchmaking?token=JWT — receive queue_position_update, match_found events
 */
export class MatchmakingDO extends DurableObject<Env> {
  // -----------------------------------------------------------------------
  // Storage helpers
  // -----------------------------------------------------------------------

  private async loadQueue(): Promise<MatchQueueEntry[]> {
    return (await this.ctx.storage.get<MatchQueueEntry[]>("queue")) ?? [];
  }

  private async saveQueue(queue: MatchQueueEntry[]): Promise<void> {
    await this.ctx.storage.put("queue", queue);
  }

  // -----------------------------------------------------------------------
  // HTTP API + WebSocket upgrade
  // -----------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWsUpgrade(request, url);
    }

    // HTTP API — strip /matchmaking prefix
    const path = url.pathname.replace(/^\/matchmaking/, "") || "/";

    // POST /enqueue
    if (request.method === "POST" && path.endsWith("/enqueue")) {
      return this.handleEnqueue(request);
    }

    // POST /leave
    if (request.method === "POST" && path.endsWith("/leave")) {
      return this.handleLeave(request);
    }

    // GET /status
    if (request.method === "GET" && path.endsWith("/status")) {
      return this.handleStatus();
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  }

  private async handleWsUpgrade(
    request: Request,
    url: URL,
  ): Promise<Response> {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 401 });
    }

    const verified = await verifyToken(token, this.env.JWT_SECRET);
    if (!verified) {
      return new Response("Invalid token", { status: 401 });
    }

    // Reject duplicate connections
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      const tags = this.ctx.getTags(ws);
      if (tags.includes(verified.userId)) {
        return new Response("Already connected", { status: 409 });
      }
    }

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [verified.userId]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private async handleEnqueue(request: Request): Promise<Response> {
    const body = (await request.json()) as { userId?: string; elo?: number };
    if (!body.userId || typeof body.elo !== "number") {
      return Response.json(
        { error: "userId and elo are required" },
        { status: 400 },
      );
    }

    const queue = await this.loadQueue();
    const existing = queue.findIndex((e) => e.userId === body.userId);
    const entry: MatchQueueEntry = {
      userId: body.userId,
      elo: body.elo,
      joinedAt: Date.now(),
    };

    if (existing !== -1) {
      queue[existing] = entry;
    } else {
      queue.push(entry);
    }

    await this.saveQueue(queue);
    await this.scheduleAlarm();

    return Response.json({ ok: true, queueCount: queue.length });
  }

  private async handleLeave(request: Request): Promise<Response> {
    const body = (await request.json()) as { userId?: string };
    if (!body.userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    const queue = await this.loadQueue();
    const index = queue.findIndex((e) => e.userId === body.userId);
    if (index === -1) {
      return Response.json({ error: "User not in queue" }, { status: 404 });
    }

    queue.splice(index, 1);
    await this.saveQueue(queue);
    await this.broadcastPositions(queue);

    return Response.json({ ok: true, queueCount: queue.length });
  }

  private async handleStatus(): Promise<Response> {
    const queue = await this.loadQueue();
    return Response.json({
      queueCount: queue.length,
      queue: queue.map((e) => ({ userId: e.userId, elo: e.elo })),
    });
  }

  // -----------------------------------------------------------------------
  // WebSocket lifecycle
  // -----------------------------------------------------------------------

  async webSocketOpen(ws: WebSocket): Promise<void> {
    const tags = this.ctx.getTags(ws);
    const userId = tags[0];
    if (!userId) {
      ws.close(4001, "No user tag");
      return;
    }

    // Send queue_joined confirmation
    this.sendToUser(userId, {
      type: "queue_joined",
      queueType: "individual",
    });

    // Schedule alarm to process queue
    await this.scheduleAlarm();
  }

  async webSocketMessage(
    ws: WebSocket,
    data: string | ArrayBuffer,
  ): Promise<void> {
    const tags = this.ctx.getTags(ws);
    const userId = tags[0];
    if (!userId) return;

    let raw: unknown;
    try {
      const text =
        typeof data === "string" ? data : new TextDecoder().decode(data);
      raw = JSON.parse(text);
    } catch {
      return;
    }

    const msg = raw as { type?: string };

    if (msg.type === "leave") {
      const queue = await this.loadQueue();
      const index = queue.findIndex((e) => e.userId === userId);
      if (index !== -1) {
        queue.splice(index, 1);
        await this.saveQueue(queue);
        await this.broadcastPositions(queue);
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const tags = this.ctx.getTags(ws);
    const userId = tags[0];
    if (!userId) return;

    const queue = await this.loadQueue();
    const index = queue.findIndex((e) => e.userId === userId);
    if (index !== -1) {
      queue.splice(index, 1);
      await this.saveQueue(queue);
      await this.broadcastPositions(queue);
    }
  }

  // -----------------------------------------------------------------------
  // Alarm — 2s matching loop
  // -----------------------------------------------------------------------

  async alarm(): Promise<void> {
    let queue = await this.loadQueue();

    // 1. Cleanup stale entries (>60s)
    queue = await this.cleanupStale(queue);

    // 2. Find match
    const matchGroup = findMatch(queue);

    if (matchGroup) {
      const matchId = crypto.randomUUID();

      // Create GameDO stub and initialize
      try {
        const gameDoId = this.env.GAME_DO.idFromName(matchId);
        const gameStub = this.env.GAME_DO.get(gameDoId);
        await gameStub.fetch("http://localhost/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerIds: matchGroup.playerIds }),
        });
      } catch (err) {
        console.error("[MatchmakingDO] Failed to create GameDO:", err);
        // Keep players in queue, try again next cycle
        await this.saveQueue(queue);
        await this.scheduleAlarm();
        return;
      }

      // Push match_found to each matched player's WS
      const matchFoundEvent = {
        type: "match_found",
        matchId,
        playerIds: matchGroup.playerIds,
        timestamp: new Date().toISOString(),
      };

      for (const playerId of matchGroup.playerIds) {
        this.sendToUser(playerId, matchFoundEvent);
      }

      // Remove matched players from queue
      const matchedIds = new Set(matchGroup.playerIds);
      queue = queue.filter((e) => !matchedIds.has(e.userId));
    }

    // 3. Broadcast positions to remaining users
    await this.broadcastPositions(queue);

    // 4. Save and reschedule
    await this.saveQueue(queue);
    await this.scheduleAlarm();
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private async cleanupStale(
    queue: MatchQueueEntry[],
  ): Promise<MatchQueueEntry[]> {
    const now = Date.now();
    const stale: MatchQueueEntry[] = [];
    const fresh: MatchQueueEntry[] = [];

    for (const entry of queue) {
      if (now - entry.joinedAt > CLEANUP_THRESHOLD_MS) {
        stale.push(entry);
      } else {
        fresh.push(entry);
      }
    }

    // Push match_cancelled to stale users
    for (const entry of stale) {
      this.sendToUser(entry.userId, {
        type: "match_cancelled",
        matchId: "",
        reason: "connection_timeout",
      });
    }

    return fresh;
  }

  private async broadcastPositions(queue: MatchQueueEntry[]): Promise<void> {
    const sorted = [...queue].sort((a, b) => a.joinedAt - b.joinedAt);

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      this.sendToUser(entry.userId, {
        type: "queue_position_update",
        position: i + 1,
        queueCount: sorted.length,
      });
    }
  }

  private sendToUser(userId: string, event: unknown): void {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      const tags = this.ctx.getTags(ws);
      if (tags.includes(userId)) {
        try {
          ws.send(JSON.stringify(event));
        } catch {
          // Connection might be closed
        }
        return;
      }
    }
  }

  private async scheduleAlarm(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + MATCHING_INTERVAL_MS);
  }
}
