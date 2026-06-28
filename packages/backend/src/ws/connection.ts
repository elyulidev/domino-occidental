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
import { handleMessage as defaultHandleMessage } from "../game/handler";
import { broadcastEvents as defaultBroadcastEvents } from "./broadcaster";
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
  const manager = createConnectionManager();
  const handleMessage = deps.handleMessage ?? defaultHandleMessage;
  const broadcastEvents = deps.broadcastEvents ?? defaultBroadcastEvents;
  const disconnectPlayerFn = deps.disconnectPlayer;
  const reconnectPlayerFn = deps.reconnectPlayer;
  const startedMatches = new Set<string>();

  const sendFn: SendFn = (playerId, event) =>
    sendToPlayer(manager, playerId, event);

  return {
    manager,
    ws: {
        open(ws: ElysiaWS) {
          const matchId = ws.data.params.matchId as string;
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

            // Send initial state on every join (first join or reconnect)
            const match = deps.store.getGame(matchId);
            if (match) {
              sendFn(playerId, {
                type: "game_events",
                events: [],
                state: sanitizeState(match),
              });
            }

            // Attempt reconnect if player was previously disconnected
            if (reconnectPlayerFn) {
              const match = deps.store.getGame(matchId);
              if (match) {
                const playerIds = match.players.map((p) => p.id);
                const result = reconnectPlayerFn(match, playerId, new Date());
                if (result.events.length > 0) {
                  broadcastEvents(
                    result.events,
                    matchId,
                    playerId,
                    sendFn,
                    playerIds,
                  );
                }
              }
            }

            // Cancel abandonment timer on reconnect
            deps.timerManager?.cancelDisconnect(matchId, playerId);

            // All-4-connected detection: start match timers once
            if (!startedMatches.has(matchId)) {
              const playerIds = manager.getPlayerIdsForMatch(matchId);
              if (playerIds.length === 4) {
                startedMatches.add(matchId);
                deps.timerManager?.startMatch(matchId, playerIds);
              }
            }
          } else {
            // No auth configured — use playerId from upstream (dev/testing)
            const playerId = ws.data.params.playerId as string;
            (ws.data as Record<string, unknown>).playerId = playerId;
            manager.register(matchId, playerId, ws);

            // Send initial state on every join (first join or reconnect)
            const match = deps.store.getGame(matchId);
            if (match) {
              sendFn(playerId, {
                type: "game_events",
                events: [],
                state: sanitizeState(match),
              });
            }

            if (reconnectPlayerFn) {
              const match = deps.store.getGame(matchId);
              if (match) {
                const playerIds = match.players.map((p) => p.id);
                const result = reconnectPlayerFn(match, playerId, new Date());
                if (result.events.length > 0) {
                  broadcastEvents(
                    result.events,
                    matchId,
                    playerId,
                    sendFn,
                    playerIds,
                  );
                }
              }
            }

            // Cancel abandonment timer on reconnect
            deps.timerManager?.cancelDisconnect(matchId, playerId);

            // All-4-connected detection: start match timers once
            if (!startedMatches.has(matchId)) {
              const playerIds = manager.getPlayerIdsForMatch(matchId);
              if (playerIds.length === 4) {
                startedMatches.add(matchId);
                deps.timerManager?.startMatch(matchId, playerIds);
              }
            }
          }
        },

        message(ws: ElysiaWS, rawData: string | Buffer | Record<string, unknown>) {
          const matchId = ws.data.matchId as string;
          const playerId = ws.data.playerId as string;

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
          const playerId = ws.data.playerId as string;
          const matchId = ws.data.matchId as string;

          manager.unregister(playerId);

          if (disconnectPlayerFn) {
            const match = deps.store.getGame(matchId);
            if (match) {
              const playerIds = match.players.map((p) => p.id);
              const result = disconnectPlayerFn(match, playerId, new Date());
              if (result.events.length > 0) {
                broadcastEvents(
                  result.events,
                  matchId,
                  playerId,
                  sendFn,
                  playerIds,
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
