import { forfeitMatch } from "./connection";
import { passTurn, playTile } from "./match";
import type { ActionResult, GameEvent, MatchState, Side } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameStore {
  getGame(matchId: string): MatchState | null;
  updateGame(matchId: string, state: MatchState): void;
}

export type WsClientMessage =
  | { type: "play_tile"; tileId: string; side: Side }
  | { type: "pass" }
  | { type: "leave" };

export interface MessageResult {
  events: GameEvent[];
  sanitizedState?: SanitizedMatchState;
}

export interface SanitizedMatchState {
  matchId: string;
  players: Array<{
    id: string;
    handSize: number;
    isConnected: boolean;
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
}

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

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
    })),
    board: match.board,
    currentTurn: match.turn.currentTurn,
    scores: match.scores.scores,
    roundNumber: match.turn.roundNumber,
    poolCount: match.poolCount,
    status: match.status,
    targetScore: match.targetScore,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Routes a WebSocket client message to the appropriate game function.
 *
 * Validates the match exists, dispatches to playTile / passTurn / forfeitMatch,
 * persists the updated state, and returns events plus sanitized state.
 *
 * @returns MessageResult with events (always) and sanitizedState (when match exists)
 */
export function handleMessage(
  store: GameStore,
  matchId: string,
  playerId: string,
  message: WsClientMessage,
): MessageResult {
  const match = store.getGame(matchId);
  if (!match) {
    return {
      events: [
        {
          type: "game_error",
          code: "MATCH_NOT_FOUND",
          message: "Match not found",
        },
      ],
    };
  }

  let result: ActionResult;

  switch (message.type) {
    case "play_tile":
      result = playTile(match, playerId, message.tileId, message.side);
      break;
    case "pass":
      result = passTurn(match, playerId);
      break;
    case "leave":
      result = forfeitMatch(match, playerId, new Date());
      break;
    default:
      return {
        events: [
          {
            type: "game_error",
            code: "INVALID_MESSAGE",
            message: "Unknown message type",
          },
        ],
        sanitizedState: sanitizeState(match),
      };
  }

  // Only persist if the state actually changed (errors return the same ref)
  if (result.match !== match) {
    store.updateGame(matchId, result.match);
  }

  return {
    events: result.events,
    sanitizedState: sanitizeState(result.match),
  };
}
