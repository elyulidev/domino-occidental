import type { GameEvent, MatchState, Side } from "./types";

/**
 * Interface for the in-memory game store.
 * Used by both the game handler and WebSocket layer.
 */
export interface GameStore {
  getGame(matchId: string): MatchState | null;
  updateGame(matchId: string, state: MatchState): void;
}

/**
 * WebSocket client → server message types.
 */
export type WsClientMessage =
  | { type: "play_tile"; tileId: string; side: Side }
  | { type: "pass" }
  | { type: "leave" };

/**
 * Result of a handleMessage call.
 */
export interface MessageResult {
  events: GameEvent[];
  sanitizedState?: SanitizedMatchState;
}

/**
 * Sanitized match state sent to clients (no hands, no pool).
 */
export interface SanitizedMatchState {
  matchId: string;
  players: Array<{
    id: string;
    handSize: number;
    isConnected: boolean;
    blockedTileIds: string[];
  }>;
  board: {
    leftEnd: number | null;
    rightEnd: number | null;
    tiles: Array<{
      tile: { id: string; top: number; bottom: number };
      side: "left" | "right";
      playerId: string;
    }>;
  };
  currentTurn: number;
  scores: [number, number];
  roundNumber: number;
  poolCount: number;
  status: string;
  targetScore: number;
  /** Deadline for the current turn in Unix ms, or null if not yet set */
  turnDeadline: number | null;
  /** Number of consecutive null (blocked) rounds */
  consecutiveNullRounds: number;
  /** Winner of the last hand, or null for the first hand of the match */
  lastHandWinner: number | null;
}

/**
 * Strips sensitive server-only data from MatchState for client consumption.
 *
 * - Replaces each player's `hand` array with a `handSize` count
 * - Removes the `pool` array (server-only)
 * - Exposes only `poolCount` (integer)
 * - Drops internal fields like `consecutivePasses`, `lastActionAt`, etc.
 */
export function sanitizeState(match: MatchState): SanitizedMatchState {
  return {
    matchId: match.matchId,
    players: match.players.map((p) => ({
      id: p.id,
      handSize: p.hand.length,
      isConnected: p.isConnected,
      blockedTileIds: p.blockedTileIds,
    })),
    board: match.board,
    currentTurn: match.turn.currentTurn,
    scores: match.scores.scores,
    roundNumber: match.turn.roundNumber,
    poolCount: match.poolCount,
    status: match.status,
    targetScore: match.targetScore,
    turnDeadline: match.turn.turnDeadline,
    consecutiveNullRounds: match.turn.consecutiveNullRounds,
    lastHandWinner: match.turn.lastHandWinner,
  };
}
