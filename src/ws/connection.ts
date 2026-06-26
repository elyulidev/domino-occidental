import type { ElysiaWS } from "elysia/ws";
import type {
  GameStore,
  MessageResult,
  SanitizedMatchState,
  WsClientMessage,
} from "../game/handler";
import { handleMessage as defaultHandleMessage } from "../game/handler";
import type { GameEvent, MatchState } from "../game/types";
import type { SendFn, WsServerMessage } from "./broadcaster";
import { broadcastEvents as defaultBroadcastEvents } from "./broadcaster";

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
}

/** Result type for disconnect/reconnect engine functions. */
interface EngineResult {
  match: MatchState;
  events: GameEvent[];
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
}

/** Return type for createWsPlugin — exposes manager for testing. */
export interface WsPlugin {
  manager: ConnectionManager;
  ws: Record<
    string,
    {
      open: (ws: ElysiaWS) => void;
      message: (ws: ElysiaWS, rawData: string | Buffer) => void;
      close: (ws: ElysiaWS) => void;
    }
  >;
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

  const sendFn: SendFn = (playerId, event) =>
    sendToPlayer(manager, playerId, event);

  return {
    manager,
    ws: {
      "/ws/game/:matchId": {
        open(ws: ElysiaWS) {
          const matchId = ws.data.matchId as string;
          const playerId = ws.data.playerId as string;

          manager.register(matchId, playerId, ws);

          // Attempt reconnect if player was previously disconnected
          if (reconnectPlayerFn) {
            const match = deps.store.getGame(matchId);
            if (match) {
              const result = reconnectPlayerFn(match, playerId, new Date());
              if (result.events.length > 0) {
                broadcastEvents(result.events, matchId, playerId, sendFn);
              }
            }
          }
        },

        message(ws: ElysiaWS, rawData: string | Buffer) {
          const matchId = ws.data.matchId as string;
          const playerId = ws.data.playerId as string;

          let parsed: WsClientMessage;
          try {
            parsed = JSON.parse(
              typeof rawData === "string" ? rawData : rawData.toString(),
            );
          } catch {
            // JSON parse error — send game_error back to sender
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

          const result = handleMessage(deps.store, matchId, playerId, parsed);

          // Broadcast events to all recipients
          if (result.events.length > 0) {
            broadcastEvents(result.events, matchId, playerId, sendFn);
          }

          // Send sanitized state to acting player if present
          if (result.sanitizedState) {
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
              const result = disconnectPlayerFn(match, playerId, new Date());
              if (result.events.length > 0) {
                broadcastEvents(result.events, matchId, playerId, sendFn);
              }
            }
          }
        },
      },
    },
  };
}
