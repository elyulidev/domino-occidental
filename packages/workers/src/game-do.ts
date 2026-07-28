import { DurableObject } from "cloudflare:workers";
import type { Env, GameDOStorage } from "./types";
import { verifyToken } from "./auth";
import { broadcastEvents, sendHand } from "./broadcaster";
import { RateLimiter } from "./rate-limiter";
import type {
  ActionResult,
  GameEvent,
  MatchState,
} from "@domino/shared";
import type { SanitizedMatchState } from "@domino/shared/handler";
import { sanitizeState, validateWsMessage } from "@domino/shared";
import {
  initializeMatch,
  startHand,
  playTile,
  passTurn,
  checkTimeout,
} from "@domino/shared/game/match";
import { createDeck, shuffle, deal } from "@domino/shared/game/deck";
import {
  persistTerminalMatch,
  recordMatchMove,
  recordRound,
  findTerminalEvent,
  findHandEndedEvent,
  extractRoundData,
} from "./persistence";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 5_000;
const TURN_CHECK_INTERVAL_MS = 2_000;
const ABANDONMENT_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// GameDO
// ---------------------------------------------------------------------------

/**
 * Durable Object owning a single active match.
 *
 * Manages WebSocket connections (Hibernation API), game state (SQLite storage),
 * and timers (single-alarm state machine).
 *
 * Replaces the in-memory GameState Map + TimerManager from Elysia/Bun.
 */
export class GameDO extends DurableObject<Env> {
  private state: GameDOStorage | null = null;
  private rateLimiter = new RateLimiter();
  /** Per-DO move counter (resets when DO is evicted, like in-memory game state) */
  private moveCounter = 0;

  // -----------------------------------------------------------------------
  // Storage helpers
  // -----------------------------------------------------------------------

  private async loadState(): Promise<GameDOStorage | null> {
    const match = await this.ctx.storage.get<unknown>("match");
    if (match === undefined) return null;

    return {
      match,
      playerIds:
        (await this.ctx.storage.get<string[]>("playerIds")) ?? [],
      heartbeatDue:
        (await this.ctx.storage.get<number>("heartbeatDue")) ?? 0,
      turnCheckDue:
        (await this.ctx.storage.get<number>("turnCheckDue")) ?? 0,
      abandonmentDue:
        (await this.ctx.storage.get<number | null>("abandonmentDue")) ?? null,
      pausedPlayerId:
        (await this.ctx.storage.get<string | null>("pausedPlayerId")) ?? null,
      started: (await this.ctx.storage.get<boolean>("started")) ?? false,
    };
  }

  private async saveState(s: GameDOStorage): Promise<void> {
    await this.ctx.storage.put("match", s.match);
    await this.ctx.storage.put("playerIds", s.playerIds);
    await this.ctx.storage.put("heartbeatDue", s.heartbeatDue);
    await this.ctx.storage.put("turnCheckDue", s.turnCheckDue);
    await this.ctx.storage.put("abandonmentDue", s.abandonmentDue);
    await this.ctx.storage.put("pausedPlayerId", s.pausedPlayerId);
    await this.ctx.storage.put("started", s.started);
  }

  private getMatch(): MatchState | null {
    if (!this.state?.match) return null;
    return this.state.match as MatchState;
  }

  // -----------------------------------------------------------------------
  // Alarm scheduling
  // -----------------------------------------------------------------------

  private async rescheduleAlarm(): Promise<void> {
    if (!this.state) return;

    const deadlines = [
      this.state.heartbeatDue,
      this.state.turnCheckDue,
      this.state.abandonmentDue,
    ].filter((d): d is number => d !== null && d > 0);

    if (deadlines.length === 0) return;

    const nextDeadline = Math.min(...deadlines);
    if (nextDeadline > Date.now()) {
      await this.ctx.storage.setAlarm(nextDeadline);
    } else {
      // Already due — fire immediately
      await this.ctx.storage.setAlarm(Date.now());
    }
  }

  // -----------------------------------------------------------------------
  // Broadcast helpers
  // -----------------------------------------------------------------------

  private broadcast(
    events: GameEvent[],
    actingPlayerId: string,
    state?: SanitizedMatchState,
  ): void {
    const match = this.getMatch();
    const matchId = match?.matchId ?? "unknown";

    broadcastEvents(
      events,
      this.ctx.getWebSockets.bind(this.ctx),
      this.ctx.getTags.bind(this.ctx),
      matchId,
      actingPlayerId,
      state,
    );
  }

  private sendNewHands(): void {
    const match = this.getMatch();
    if (!match) return;

    for (const player of match.players) {
      sendHand(
        player.id,
        player.hand,
        this.ctx.getWebSockets.bind(this.ctx),
        this.ctx.getTags.bind(this.ctx),
      );
    }
  }

  // -----------------------------------------------------------------------
  // DB persistence — fire-and-forget via ctx.waitUntil
  // -----------------------------------------------------------------------

  private persistEvents(events: GameEvent[], match: MatchState): void {
    const supabaseUrl = this.env.SUPABASE_URL;
    const serviceRoleKey = this.env.SUPABASE_SERVICE_ROLE_KEY;

    // Skip if env vars are not configured (local dev without Supabase)
    if (!supabaseUrl || !serviceRoleKey) return;

    // Record individual moves (play_tile / pass via turn_timeout)
    for (const event of events) {
      if (event.type === "play_tile" || event.type === "pass") {
        this.moveCounter += 1;
        const move = {
          playerId: match.players[match.turn.currentTurn]?.id ?? "unknown",
          isPass: event.type === "pass",
          tileId: "tileId" in event ? (event as { tileId: string }).tileId : undefined,
          tileTop: "tileTop" in event ? (event as { tileTop: number }).tileTop : undefined,
          tileBottom:
            "tileBottom" in event
              ? (event as { tileBottom: number }).tileBottom
              : undefined,
          side: "side" in event ? (event as { side: string }).side : undefined,
          actionSource: "player" as const,
          moveNumber: this.moveCounter,
        };
        this.ctx.waitUntil(
          recordMatchMove(match, move, supabaseUrl, serviceRoleKey).catch(
            (err) => console.error("[persistence] recordMatchMove failed:", err),
          ),
        );
      }

      // Record forced pass from turn_timeout
      if (event.type === "turn_timeout") {
        this.moveCounter += 1;
        const timeoutEv = event as { playerId: string; forced: string };
        const move = {
          playerId: timeoutEv.playerId,
          isPass: true,
          actionSource: "timeout" as const,
          moveNumber: this.moveCounter,
        };
        this.ctx.waitUntil(
          recordMatchMove(match, move, supabaseUrl, serviceRoleKey).catch(
            (err) => console.error("[persistence] recordMatchMove (timeout) failed:", err),
          ),
        );
      }
    }

    // Record completed round (hand_ended)
    const handEnded = findHandEndedEvent(events);
    if (handEnded) {
      const roundData = extractRoundData(match, handEnded);
      if (roundData) {
        this.ctx.waitUntil(
          recordRound(match, roundData, supabaseUrl, serviceRoleKey).catch(
            (err) => console.error("[persistence] recordRound failed:", err),
          ),
        );
      }
    }

    // Persist terminal match (match_ended / match_abandoned)
    const terminal = findTerminalEvent(events);
    if (terminal) {
      this.ctx.waitUntil(
        persistTerminalMatch(match, terminal, supabaseUrl, serviceRoleKey).catch(
          (err) => console.error("[persistence] persistTerminalMatch failed:", err),
        ),
      );
    }
  }

  // -----------------------------------------------------------------------
  // Fetch — WebSocket upgrade entry point
  // -----------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // POST /init — set player IDs (called by matchmaking before game starts)
    if (request.method === "POST" && url.pathname.endsWith("/init")) {
      const body = (await request.json()) as { playerIds?: string[] };
      if (!body.playerIds || !Array.isArray(body.playerIds) || body.playerIds.length !== 4) {
        return Response.json(
          { error: "playerIds must be an array of 4 strings" },
          { status: 400 },
        );
      }

      if (!this.state) {
        this.state = await this.loadState();
      }
      if (!this.state) {
        this.state = {
          match: null,
          playerIds: body.playerIds,
          heartbeatDue: 0,
          turnCheckDue: 0,
          abandonmentDue: null,
          pausedPlayerId: null,
          started: false,
        };
      } else {
        this.state.playerIds = body.playerIds;
      }
      await this.saveState(this.state);
      return Response.json({ ok: true });
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 405 });
    }

    // Extract token from query param
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 401 });
    }

    // Verify JWT
    const verified = await verifyToken(token, this.env.JWT_SECRET);
    if (!verified) {
      return new Response("Invalid token", { status: 401 });
    }

    // Load state if needed
    if (!this.state) {
      this.state = await this.loadState();
    }

    // Check if player is assigned to this match
    if (
      this.state?.playerIds &&
      this.state.playerIds.length > 0 &&
      !this.state.playerIds.includes(verified.userId)
    ) {
      return new Response("Not assigned to this match", { status: 403 });
    }

    // Reject duplicate connections from same user
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      const tags = this.ctx.getTags(ws);
      if (tags.includes(verified.userId)) {
        return new Response("Already connected", { status: 409 });
      }
    }

    // Create WebSocket pair and accept with userId tag
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [verified.userId]);

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // -----------------------------------------------------------------------
  // WebSocket lifecycle — Hibernation API
  // -----------------------------------------------------------------------

  async webSocketOpen(ws: WebSocket): Promise<void> {
    // Load or initialize state
    if (!this.state) {
      this.state = await this.loadState();
    }

    const tags = this.ctx.getTags(ws);
    const playerId = tags[0];
    if (!playerId) {
      ws.close(4001, "No player tag");
      return;
    }

    if (!this.state) {
      // No state at all — first connection without init
      this.state = {
        match: null,
        playerIds: [playerId],
        heartbeatDue: Date.now() + HEARTBEAT_INTERVAL_MS,
        turnCheckDue: Date.now() + TURN_CHECK_INTERVAL_MS,
        abandonmentDue: null,
        pausedPlayerId: null,
        started: false,
      };
      await this.saveState(this.state);
    }

    // Mark player connected in MatchState
    const match = this.getMatch();
    if (match) {
      const playerIndex = match.players.findIndex((p) => p.id === playerId);
      if (playerIndex !== -1) {
        const updatedPlayers = match.players.map((p, i) =>
          i === playerIndex ? { ...p, isConnected: true } : p,
        ) as MatchState["players"];
        const updatedMatch: MatchState = { ...match, players: updatedPlayers };
        this.state.match = updatedMatch;

        // Cancel abandonment if this was the disconnected player
        if (this.state.pausedPlayerId === playerId) {
          this.state.abandonmentDue = null;
          this.state.pausedPlayerId = null;
          this.broadcast(
            [{ type: "player_reconnected", playerId }],
            playerId,
          );
        }

        await this.saveState(this.state);

        // Send full state to reconnected player
        this.broadcast([], playerId, sanitizeState(updatedMatch));
      }
    }

    // Check if4 players connected and game hasn't started
    const socketCount = this.ctx.getWebSockets().length;
    if (
      socketCount >= 4 &&
      !this.state.started &&
      this.state.playerIds.length >= 4
    ) {
      await this.startMatch();
    }

    // Schedule alarm if not already scheduled
    await this.rescheduleAlarm();
  }

  // -----------------------------------------------------------------------
  // Match initialization
  // -----------------------------------------------------------------------

  private async startMatch(): Promise<void> {
    if (!this.state) return;

    const deck = shuffle(createDeck());
    const { hands, pool } = deal(deck);

    // Initialize match with the4 player IDs in order
    const result = initializeMatch(this.ctx.id.toString(), hands, pool);
    let match = result.match;

    // Assign real player IDs and mark connected
    const players = match.players.map((p, i) => ({
      ...p,
      id: this.state!.playerIds[i],
      isConnected: true,
    })) as MatchState["players"];
    match = { ...match, players };

    // Start first hand — determine first player and set turn deadline
    const startResult = startHand(match);

    this.state.match = startResult.match;
    this.state.started = true;
    this.state.heartbeatDue = Date.now() + HEARTBEAT_INTERVAL_MS;
    this.state.turnCheckDue = Date.now() + TURN_CHECK_INTERVAL_MS;
    await this.saveState(this.state);

    // Broadcast round_started
    this.broadcast(startResult.events, "server", sanitizeState(startResult.match));

    // Send each player their private hand
    this.sendNewHands();
  }

  // -----------------------------------------------------------------------
  // WebSocket message
  // -----------------------------------------------------------------------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.state) {
      this.state = await this.loadState();
    }
    if (!this.state) return;

    const tags = this.ctx.getTags(ws);
    const playerId = tags[0];
    if (!playerId) return;

    // Rate limiting
    if (!this.rateLimiter.tryConsume(playerId)) {
      ws.send(
        JSON.stringify({
          type: "game_events",
          events: [
            {
              type: "game_error",
              code: "RATE_LIMITED",
              message: "Rate limit exceeded: 10 messages/second",
            },
          ],
        }),
      );
      return;
    }

    // Parse JSON
    let raw: unknown;
    try {
      const text =
        typeof message === "string" ? message : new TextDecoder().decode(message);
      raw = JSON.parse(text);
    } catch {
      ws.send(
        JSON.stringify({
          type: "game_events",
          events: [
            {
              type: "game_error",
              code: "INVALID_MESSAGE",
              message: "Invalid JSON",
            },
          ],
        }),
      );
      return;
    }

    // Validate via @domino/shared Zod schema
    const validation = validateWsMessage(raw);
    if (!validation.ok) {
      ws.send(
        JSON.stringify({
          type: "game_events",
          events: [validation.error],
        }),
      );
      return;
    }

    const msg = validation.message;

    // Handle leave — forfeit
    if (msg.type === "leave") {
      const match = this.getMatch();
      if (match) {
        const updatedMatch: MatchState = { ...match, status: "abandoned" };
        this.state.match = updatedMatch;
        const forfeitEvents: GameEvent[] = [
          {
            type: "match_abandoned",
            disconnectedPlayerId: playerId,
            reason: "forfeit",
          },
        ];
        this.broadcast(forfeitEvents, playerId, sanitizeState(updatedMatch));
        // Persist forfeit to Supabase (fire-and-forget)
        this.persistEvents(forfeitEvents, updatedMatch);
        await this.saveState(this.state);
      }
      await this.ctx.storage.deleteAlarm();
      return;
    }

    // Game actions require an active match
    if (!this.state.started) {
      ws.send(
        JSON.stringify({
          type: "game_events",
          events: [
            {
              type: "game_error",
              code: "MATCH_NOT_ACTIVE",
              message: "Match has not started yet",
            },
          ],
        }),
      );
      return;
    }

    const match = this.getMatch();
    if (!match || match.status !== "in_progress") {
      ws.send(
        JSON.stringify({
          type: "game_events",
          events: [
            {
              type: "game_error",
              code: "MATCH_NOT_ACTIVE",
              message: "Match is not in progress",
            },
          ],
        }),
      );
      return;
    }

    // Dispatch game action
    let result: ActionResult;
    if (msg.type === "play_tile") {
      result = playTile(match, playerId, msg.tileId, msg.side);
    } else if (msg.type === "pass") {
      result = passTurn(match, playerId);
    } else {
      // Exhaustive check — TypeScript ensures we handle all cases
      return;
    }

    // Persist updated state
    this.state.match = result.match;
    await this.saveState(this.state);

    // Broadcast events + sanitized state
    const sanitized = sanitizeState(result.match);
    this.broadcast(result.events, playerId, sanitized);

    // Persist to Supabase (fire-and-forget)
    this.persistEvents(result.events, result.match);

    // After a hand redeal: send new hands to all players
    if (result.events.some((e) => e.type === "round_started")) {
      this.sendNewHands();
    }

    // Schedule next alarm
    await this.rescheduleAlarm();
  }

  // -----------------------------------------------------------------------
  // WebSocket close
  // -----------------------------------------------------------------------

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
  ): Promise<void> {
    if (!this.state) {
      this.state = await this.loadState();
    }
    if (!this.state) return;

    const tags = this.ctx.getTags(ws);
    const playerId = tags[0];
    if (!playerId) return;

    this.rateLimiter.remove(playerId);

    // Mark player disconnected in MatchState
    const match = this.getMatch();
    if (match) {
      const playerIndex = match.players.findIndex((p) => p.id === playerId);
      if (playerIndex !== -1) {
        const updatedPlayers = match.players.map((p, i) =>
          i === playerIndex ? { ...p, isConnected: false } : p,
        ) as MatchState["players"];
        const updatedMatch: MatchState = { ...match, players: updatedPlayers };
        this.state.match = updatedMatch;

        // Emit player_disconnected
        this.broadcast(
          [
            {
              type: "player_disconnected",
              playerId,
              reconnectWindowMs: ABANDONMENT_WINDOW_MS,
            },
          ],
          playerId,
          sanitizeState(updatedMatch),
        );

        // Set abandonment timer if game is active
        if (this.state.started && this.state.abandonmentDue === null) {
          this.state.abandonmentDue = Date.now() + ABANDONMENT_WINDOW_MS;
          this.state.pausedPlayerId = playerId;

          // Pause turn timer if disconnected player is currently on turn
          if (match.turn.currentTurn === playerIndex) {
            this.state.turnCheckDue = 0; // effectively paused
          }

          await this.saveState(this.state);
          await this.rescheduleAlarm();
        } else {
          await this.saveState(this.state);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Alarm — single-alarm state machine
  // -----------------------------------------------------------------------

  async alarm(): Promise<void> {
    if (!this.state) {
      this.state = await this.loadState();
    }
    if (!this.state) return;

    const now = Date.now();
    let changed = false;
    let abandoned = false;

    // --- Heartbeat check ---
    if (this.state.heartbeatDue > 0 && now >= this.state.heartbeatDue) {
      // Compare connected WebSocket tags against match player states
      const match = this.getMatch();
      if (match) {
        const connectedIds = new Set<string>();
        for (const ws of this.ctx.getWebSockets()) {
          const tags = this.ctx.getTags(ws);
          if (tags[0]) connectedIds.add(tags[0]);
        }

        const updatedPlayers = match.players.map((p) => ({
          ...p,
          isConnected: connectedIds.has(p.id),
        })) as MatchState["players"];
        this.state.match = { ...match, players: updatedPlayers };
        changed = true;
      }
      this.state.heartbeatDue = now + HEARTBEAT_INTERVAL_MS;
    }

    // --- Turn timeout check ---
    if (this.state.turnCheckDue > 0 && now >= this.state.turnCheckDue) {
      const match = this.getMatch();
      if (match && match.status === "in_progress") {
        const result = checkTimeout(match, now);
        if (result.events.length > 0) {
          this.state.match = result.match;
          changed = true;

          // Determine acting player (the one who timed out)
          const timeoutEvent = result.events.find(
            (e): e is Extract<GameEvent, { type: "turn_timeout" }> =>
              e.type === "turn_timeout",
          );
          const actingPlayerId = timeoutEvent?.playerId ?? "server";

          // Broadcast events + sanitized state
          this.broadcast(
            result.events,
            actingPlayerId,
            sanitizeState(result.match),
          );

          // Persist timeout events to Supabase (fire-and-forget)
          this.persistEvents(result.events, result.match);

          // After a hand redeal via timeout: send new hands
          if (result.events.some((e) => e.type === "round_started")) {
            this.sendNewHands();
          }
        }
      }
      this.state.turnCheckDue = now + TURN_CHECK_INTERVAL_MS;
    }

    // --- Reconnect handling (check BEFORE abandonment) ---
    if (this.state.abandonmentDue !== null && this.state.pausedPlayerId) {
      const sockets = this.ctx.getWebSockets();
      for (const ws of sockets) {
        const tags = this.ctx.getTags(ws);
        if (tags.includes(this.state.pausedPlayerId)) {
          // Player reconnected — cancel abandonment
          this.state.abandonmentDue = null;
          this.state.pausedPlayerId = null;

          // Resume turn timer if the reconnected player is on turn
          const match = this.getMatch();
          if (match) {
            const playerIndex = match.players.findIndex(
              (p) => p.id === tags[0],
            );
            if (playerIndex === match.turn.currentTurn) {
              this.state.turnCheckDue = now + TURN_CHECK_INTERVAL_MS;
            }
          }

          this.broadcast(
            [{ type: "player_reconnected", playerId: tags[0] }],
            tags[0],
          );
          changed = true;
          break;
        }
      }
    }

    // --- Abandonment check (only if still pending after reconnect check) ---
    if (this.state.abandonmentDue !== null && now >= this.state.abandonmentDue) {
      const disconnectedPlayerId = this.state.pausedPlayerId ?? "unknown";
      const match = this.getMatch();

      if (match) {
        const updatedMatch: MatchState = {
          ...match,
          status: "abandoned",
        };
        this.state.match = updatedMatch;
        changed = true;

        const abandonEvents: GameEvent[] = [
          {
            type: "match_abandoned",
            disconnectedPlayerId,
            reason: "abandonment",
          },
        ];
        this.broadcast(
          abandonEvents,
          disconnectedPlayerId,
          sanitizeState(updatedMatch),
        );

        // Persist abandonment to Supabase (fire-and-forget)
        this.persistEvents(abandonEvents, updatedMatch);
      }

      this.state.abandonmentDue = null;
      this.state.pausedPlayerId = null;
      abandoned = true;
    }

    if (changed) {
      await this.saveState(this.state);
    }

    if (abandoned) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    await this.rescheduleAlarm();
  }
}
