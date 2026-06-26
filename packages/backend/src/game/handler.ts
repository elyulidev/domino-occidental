import type { ActionResult } from "@domino/shared";
import {
  type GameStore,
  type MessageResult,
  sanitizeState,
  type WsClientMessage,
} from "@domino/shared";
import { forfeitMatch } from "./connection";
import { passTurn, playTile } from "./match";

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
