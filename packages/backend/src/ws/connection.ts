import type {
  GameEvent,
  GameStore,
  MatchState,
  MessageResult,
  SanitizedMatchState,
  SendFn,
  WsClientMessage,
  WsServerMessage,
} from "@domino/shared";
import { sanitizeState } from "@domino/shared";
import type { ElysiaWS } from "elysia/ws";
import { persistMatch } from "../db/matches";
import { handleMessage as defaultHandleMessage } from "../game/handler";
import { getPlayerProfiles } from "../game/store";
import { broadcastEvents as defaultBroadcastEvents, sendState as defaultSendState } from "./broadcaster";
import { startedMatches } from "./started-matches";
import type { TimerManager } from "./timer-manager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectionInfo {
  ws: ElysiaWS;
  matchId: string;
  playerId: string;
  connectedAt: Date;
}

export interface ConnectionManager {
  register(matchId: string, playerId: string, ws: ElysiaWS): void;
  unregister(playerId: string): void;
  getConnection(playerId: string): ElysiaWS | undefined;
  getActiveConnections(): Map<string, ConnectionInfo>;
  getPlayerIdsForMatch(matchId: string): string[];
}

/** Result type for disconnect/reconnect engine functions. */
interface EngineResult {
  match: MatchState;
  events: GameEvent[];
}

export interface RateLimiterApi {
  tryConsume(connectionId: string): boolean;
}

/**
 * Dependencies injected into the WS plugin for testability.
 * All external functions are optional — defaults use the real module exports.
 */
export interface WsPluginDeps {
  store: GameStore;
  handleMessage?: (
    store: GameStore,
    matchId: string,
    playerId: string,
    message: WsClientMessage,
  ) => MessageResult;
  broadcastEvents?: (
    events: GameEvent[],
    matchId: string,
    actingPlayerId: string,
    sendFn: SendFn,
    playerIds?: string[],
    state?: SanitizedMatchState,
  ) => void;
  disconnectPlayer?: (
    match: MatchState,
    playerId: string,
    now: Date,
  ) => EngineResult;
  reconnectPlayer?: (
    match: MatchState,
    playerId: string,
    now: Date,
  ) => EngineResult;
  /** Optional JWT verification. When provided, playerId is derived from token. */
  verifyToken?: (token: string) => { userId: string } | null;
  /** Optional rate limiter. When provided, messages are throttled per-playerId. */
  rateLimiter?: RateLimiterApi;
  /** Optional timer manager for heartbeat and abandonment timers. */
  timerManager?: TimerManager;
  /** Optional external connection manager. When provided, uses it instead of creating a new one. */
  connectionManager?: ConnectionManager;
}

/** Return type for createWsPlugin — exposes manager for testing. */
export interface WsPlugin {
  manager: ConnectionManager;
  ws: {
    open: (ws: ElysiaWS) => void;
    message: (ws: ElysiaWS, rawData: string | Buffer) => void;
    close: (ws: ElysiaWS) => void;
  };
}

// ---------------------------------------------------------------------------
// Connection Manager (flat Map keyed by playerId)
// ---------------------------------------------------------------------------

export function createConnectionManager(): ConnectionManager {
  const connections = new Map<string, ConnectionInfo>();

  return {
    register(matchId: string, playerId: string, ws: ElysiaWS): void {
      connections.set(playerId, {
        ws,
        matchId,
        playerId,
        connectedAt: new Date(),
      });
    },

    unregister(playerId: string): void {
      connections.delete(playerId);
    },

    getConnection(playerId: string): ElysiaWS | undefined {
      return connections.get(playerId)?.ws;
    },

    getActiveConnections(): Map<string, ConnectionInfo> {
      return new Map(connections);
    },

    getPlayerIdsForMatch(matchId: string): string[] {
      const playerIds: string[] = [];
      for (const [, info] of connections) {
        if (info.matchId === matchId) {
          playerIds.push(info.playerId);
        }
      }
      return playerIds;
    },
  };
}

// ---------------------------------------------------------------------------
// sendToPlayer — implements SendFn
// ---------------------------------------------------------------------------

export function sendToPlayer(
  manager: ConnectionManager,
  playerId: string,
  event: WsServerMessage,
): void {
  const ws = manager.getConnection(playerId);
  if (!ws) return;
  try {
    ws.send(JSON.stringify(event));
  } catch {
    // Silently no-op — broadcaster catches errors per-recipient
  }
}

// ---------------------------------------------------------------------------
// Elysia WS Plugin
// ---------------------------------------------------------------------------

export function createWsPlugin(deps: WsPluginDeps): WsPlugin {
  const manager = deps.connectionManager ?? createConnectionManager();
  const handleMessage = deps.handleMessage ?? defaultHandleMessage;
  const broadcastEvents = deps.broadcastEvents ?? defaultBroadcastEvents;
  const sendState = defaultSendState;
  const disconnectPlayerFn = deps.disconnectPlayer;
  const reconnectPlayerFn = deps.reconnectPlayer;

  const sendFn: SendFn = (playerId, event) =>
    sendToPlayer(manager, playerId, event);

  /**
   * Called when all 4 players have connected to a match.
   * Transitions status from "waiting" → "in_progress", starts timers,
   * and broadcasts the updated state to all players.
   */
  function onAllFourConnected(matchId: string): void {
    console.log(`[ws] onAllFourConnected called for match ${matchId}`);
    if (startedMatches.has(matchId)) {
      console.log(`[ws] match ${matchId} already started, skipping`);
      return;
    }

    const playerIds = manager.getPlayerIdsForMatch(matchId);
    console.log(`[ws] match ${matchId} has ${playerIds.length} players connected: ${playerIds.join(', ')}`);
    if (playerIds.length < 4) {
      console.log(`[ws] match ${matchId} waiting for ${4 - playerIds.length} more players`);
      return;
    }

    // Claim the match before any async work to prevent double-start.
    // Bun is single-threaded and this function is synchronous, so the
    // has()→add() window is safe — but we claim early as a defense-in-depth
    // pattern in case store/broadcast ever become async.
    startedMatches.add(matchId);

    // Transition match status from "waiting" to "in_progress"
    const match = deps.store.getGame(matchId);
    console.log(`[ws] Match ${matchId} exists: ${!!match}, status: ${match?.status}`);
    if (match && match.status === "waiting") {
      match.status = "in_progress";
      deps.store.updateGame(matchId, match);
    }

    // Start turn/heartbeat timers
    deps.timerManager?.startMatch(matchId, playerIds);

    // Broadcast the started match state to all 4 players
    const updatedMatch = deps.store.getGame(matchId);
    if (updatedMatch) {
      console.log(`[ws] Broadcasting round_started to ${updatedMatch.players.length} players`);
      // Apply player names from profiles store if any are missing
      // (resolves race condition where async fetchPlayerProfiles hasn't completed yet)
      const profiles = getPlayerProfiles(matchId);
      if (profiles) {
        let needsUpdate = false;
        const namedPlayers = updatedMatch.players.map((p) => {
          if (!p.name && profiles.has(p.id)) {
            needsUpdate = true;
            return { ...p, name: profiles.get(p.id)!.name } as (typeof updatedMatch.players)[number];
          }
          return p;
        });
        if (needsUpdate) {
          updatedMatch.players = namedPlayers as MatchState["players"];
          deps.store.updateGame(matchId, updatedMatch);
        }
      }

      const state = sanitizeState(updatedMatch);
      for (const p of updatedMatch.players) {
        sendFn(p.id, {
          type: "game_events",
          events: [{ type: "round_started", firstPlayer: updatedMatch.turn.currentTurn }],
          state,
          yourHand: p.hand,
        });
      }
    }
  }

  return {
    manager,
    ws: {
        open(ws: ElysiaWS) {
          const matchId = ((ws.data as Record<string, unknown>).params as Record<string, string>)?.matchId as string;
          console.log(`[ws] Player connecting to match ${matchId}`);
          (ws.data as Record<string, unknown>).matchId = matchId;

          // --- JWT Authentication ---
          if (deps.verifyToken) {
            const query = (ws.data as Record<string, unknown>).query as
              | Record<string, string>
              | undefined;
            const token = query?.token;
            if (!token) {
              ws.close(4001, "Missing authentication token");
              return;
            }

            const verified = deps.verifyToken(token);
            if (!verified) {
              ws.close(4001, "Invalid or expired token");
              return;
            }

            // Player identity comes from the verified JWT
            const playerId = verified.userId;
            (ws.data as Record<string, unknown>).playerId = playerId;

            manager.register(matchId, playerId, ws);

            // Update isConnected in the store on every join
            const match = deps.store.getGame(matchId);
            console.log(`[ws] Player ${playerId} joining match ${matchId} - match exists: ${!!match}`);
            if (match) {
              // Apply player names from profiles store if any are missing
              const profiles = getPlayerProfiles(matchId);
              if (profiles) {
                let needsUpdate = false;
                const namedPlayers = match.players.map((p) => {
                  if (!p.name && profiles.has(p.id)) {
                    needsUpdate = true;
                    return { ...p, name: profiles.get(p.id)!.name } as (typeof match.players)[number];
                  }
                  return p;
                });
                if (needsUpdate) {
                  match.players = namedPlayers as MatchState["players"];
                }
              }

              const newPlayers = match.players.map((p) =>
                p.id === playerId
                  ? { ...p, isConnected: true, lastActionAt: new Date() }
                  : p,
              ) as MatchState["players"];
              if (newPlayers !== match.players) {
                deps.store.updateGame(matchId, { ...match, players: newPlayers });
              }

		// biome-ignore lint/style/noNonNullAssertion: game exists because we just updated it
		const updatedMatch = deps.store.getGame(matchId)!;
		const player = updatedMatch.players.find((p) => p.id === playerId);
		sendFn(playerId, {
			type: "game_events",
			events: [],
			state: sanitizeState(updatedMatch),
			yourHand: player?.hand,
		});

		// Attempt reconnect notification if player was previously disconnected
              if (reconnectPlayerFn) {
                const playerIds = updatedMatch.players.map((p) => p.id);
                const result = reconnectPlayerFn(updatedMatch, playerId, new Date());
                if (result.events.length > 0) {
                  if (result.match !== updatedMatch) {
                    deps.store.updateGame(matchId, result.match);
                  }
                  broadcastEvents(
                    result.events,
                    matchId,
                    playerId,
                    sendFn,
                    playerIds,
                    sanitizeState(result.match),
                  );
                }
              }

              // Broadcast updated state to ALL OTHER connected players
              const broadcastState = sanitizeState(
                deps.store.getGame(matchId) ?? updatedMatch,
              );
              for (const p of updatedMatch.players) {
                if (p.id !== playerId && manager.getConnection(p.id)) {
                  sendState(p.id, broadcastState, sendFn);
                }
              }
            }

            // Cancel abandonment timer on reconnect
            deps.timerManager?.cancelDisconnect(matchId, playerId);

            // All-4-connected detection: start match, transition status, broadcast
            onAllFourConnected(matchId);
          } else {
            // No auth configured — use playerId from upstream (dev/testing)
            const playerId = ((ws.data as Record<string, unknown>).params as Record<string, string>)?.playerId as string;
            console.log(`[ws] Registering player ${playerId} for match ${matchId}`);
            (ws.data as Record<string, unknown>).playerId = playerId;
            manager.register(matchId, playerId, ws);

            // Set player as connected and notify others on every join
            const match = deps.store.getGame(matchId);
            if (match) {
              const newPlayers = match.players.map((p) =>
                p.id === playerId
                  ? { ...p, isConnected: true, lastActionAt: new Date() }
                  : p,
              ) as MatchState["players"];

              if (newPlayers !== match.players) {
                deps.store.updateGame(matchId, { ...match, players: newPlayers });
              }

		// Re-use the updated match for state sending
		// biome-ignore lint/style/noNonNullAssertion: game exists because we just updated it
		const updatedMatch = deps.store.getGame(matchId)!;
              const player = updatedMatch.players.find((p) => p.id === playerId);
              sendFn(playerId, {
                type: "game_events",
                events: [],
                state: sanitizeState(updatedMatch),
                yourHand: player?.hand,
              });

              // Notify all players and run reconnect/connect logic
              if (reconnectPlayerFn) {
                const playerIds = updatedMatch.players.map((p) => p.id);
                const result = reconnectPlayerFn(updatedMatch, playerId, new Date());
                if (result.events.length > 0) {
                  if (result.match !== updatedMatch) {
                    deps.store.updateGame(matchId, result.match);
                  }
                  broadcastEvents(
                    result.events,
                    matchId,
                    playerId,
                    sendFn,
                    playerIds,
                    sanitizeState(result.match),
                  );
                }
              }

              // Broadcast updated state to ALL OTHER connected players so they see
              // the new isConnected status in real time
              const broadcastState = sanitizeState(
                deps.store.getGame(matchId) ?? updatedMatch,
              );
              for (const p of updatedMatch.players) {
                if (p.id !== playerId && manager.getConnection(p.id)) {
                  sendState(p.id, broadcastState, sendFn);
                }
              }
            }

            // Cancel abandonment timer on reconnect
            deps.timerManager?.cancelDisconnect(matchId, playerId);

            // All-4-connected detection: start match, transition status, broadcast
            onAllFourConnected(matchId);
          }

        },

        message(ws: ElysiaWS, rawData: string | Buffer | Record<string, unknown>) {
          const matchId = (ws.data as Record<string, unknown>).matchId as string;
          const playerId = (ws.data as Record<string, unknown>).playerId as string;

          // --- Rate Limiting ---
          if (deps.rateLimiter && !deps.rateLimiter.tryConsume(playerId)) {
            sendFn(playerId, {
              type: "game_events",
              events: [
                {
                  type: "game_error",
                  code: "RATE_LIMITED",
                  message: "Rate limit exceeded: 10 messages/second",
                },
              ],
            });
            return;
          }

          // Elysia 1.x auto-parses JSON WS messages — rawData may be already parsed or raw string
          let parsed: WsClientMessage;
          if (typeof rawData === "object" && !Buffer.isBuffer(rawData)) {
            parsed = rawData as unknown as WsClientMessage;
          } else {
            try {
              parsed = JSON.parse(
                typeof rawData === "string" ? rawData : (rawData as Buffer).toString(),
              );
            } catch {
              sendFn(playerId, {
                type: "game_events",
                events: [
                  {
                    type: "game_error",
                    code: "INVALID_MESSAGE",
                    message: "Invalid JSON",
                  },
                ],
              });
              return;
            }
          }

          const result = handleMessage(deps.store, matchId, playerId, parsed);

          // Broadcast events to ALL recipients with sanitized state included
          if (result.events.length > 0) {
            console.log(`[ws] ${result.events.length} event(s) from player ${playerId}: ${result.events.map(e => e.type).join(',')} hasState=${!!result.sanitizedState}`);
            const match = deps.store.getGame(matchId);
            const playerIds = match?.players.map((p) => p.id);
            broadcastEvents(
              result.events,
              matchId,
              playerId,
              sendFn,
              playerIds,
              result.sanitizedState,
            );

            // After a hand redeal: each player needs their new hand
            if (match && result.events.some((e) => e.type === "round_started")) {
              for (const p of match.players) {
                sendFn(p.id, {
                  type: "game_events",
                  events: [],
                  state: sanitizeState(match),
                  yourHand: p.hand,
                });
              }
            }

            // Persist terminal matches (finished/abandoned) — fire-and-forget
            if (match && result.events.some((e) => e.type === "match_ended" || e.type === "match_abandoned")) {
              startedMatches.delete(matchId);
              void persistMatch(match, result.events);
            }
          }
          // If no events but there is state (e.g. initial join), send state directly
          if (result.events.length === 0 && result.sanitizedState) {
            sendFn(playerId, {
              type: "game_events",
              events: [],
              state: result.sanitizedState,
            });
          }
        },

        close(ws: ElysiaWS) {
          const playerId = (ws.data as Record<string, unknown>).playerId as string;
          const matchId = (ws.data as Record<string, unknown>).matchId as string;

          manager.unregister(playerId);

          if (disconnectPlayerFn) {
            const match = deps.store.getGame(matchId);
            if (match) {
              const playerIds = match.players.map((p) => p.id);
              const result = disconnectPlayerFn(match, playerId, new Date());
              if (result.events.length > 0) {
                if (result.match !== match) {
                  deps.store.updateGame(matchId, result.match);
                }
                broadcastEvents(
                  result.events,
                  matchId,
                  playerId,
                  sendFn,
                  playerIds,
                  sanitizeState(result.match),
                );
              }
            }
          }

          // Schedule abandonment timer on disconnect
          deps.timerManager?.registerDisconnect(matchId, playerId, new Date());
        },
    },
  };
}
