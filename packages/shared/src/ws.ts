import type { SanitizedMatchState } from "./handler";
import type { GameEvent } from "./types";

/**
 * Synchronous send function that delivers a WsServerMessage to a specific player.
 */
export type SendFn = (playerId: string, event: WsServerMessage) => void;

/**
 * Server→client envelope for game events.
 */
export type WsServerMessage = {
  type: "game_events";
  events: GameEvent[];
  state?: SanitizedMatchState;
};

/**
 * Minimal WebSocket-like interface for user channel connections.
 */
export interface UserWsConnection {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/**
 * Interface for user-channel WebSocket management.
 * Used by matchmaking to push events outside active matches.
 */
export interface UserChannelManager {
  register(userId: string, ws: UserWsConnection): void;
  disconnect(userId: string): void;
  getChannel(userId: string): UserWsConnection | undefined;
  pushToUser(userId: string, event: Record<string, unknown>): boolean;
}
