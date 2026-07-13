import type { ActionResult } from "@domino/shared";
import {
  type GameStore,
  type MessageResult,
  sanitizeState,
  type WsClientMessage,
} from "@domino/shared";
import { passTurn, playTile } from "@domino/shared/src/game";
import { type MoveRecord, recordMatchMove } from "../db/moves";
import { forfeitMatch } from "./connection";

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Routes a WebSocket client message to the appropriate game function.
 *
 * Validates the match exists, dispatches to playTile / passTurn / forfeitMatch,
 * persists the updated state, records the move for replay, and returns events.
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
  let moveData: MoveRecord | null = null;

  switch (message.type) {
    case "play_tile": {
      result = playTile(match, playerId, message.tileId, message.side);

      // Capture move data only on successful state change (not error)
      if (result.match !== match) {
        const lastTile = result.match.board.tiles[result.match.board.tiles.length - 1];
        const playerIndex = result.match.players.findIndex(
          (p) => p.id === playerId,
        );
        moveData = {
          matchId,
          roundNumber: result.match.turn.roundNumber,
          playerIndex: playerIndex >= 0 ? playerIndex : 0,
          moveNumber: 0, // auto-assigned by recordMatchMove
          isPass: false,
          actionSource: "player",
          tileId: lastTile?.tile?.id ?? "",
          tileTop: lastTile?.tile?.top ?? 0,
          tileBottom: lastTile?.tile?.bottom ?? 0,
          side: lastTile?.side ?? "left",
          boardLeftEnd: result.match.board.leftEnd,
          boardRightEnd: result.match.board.rightEnd,
        };
      }
      break;
    }

    case "pass": {
      result = passTurn(match, playerId);

      if (result.match !== match) {
        const playerIndex = result.match.players.findIndex(
          (p) => p.id === playerId,
        );
        moveData = {
          matchId,
          roundNumber: result.match.turn.roundNumber,
          playerIndex: playerIndex >= 0 ? playerIndex : 0,
          moveNumber: 0,
          isPass: true,
          actionSource: "player",
          boardLeftEnd: result.match.board.leftEnd,
          boardRightEnd: result.match.board.rightEnd,
        };
      }
      break;
    }

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

  // Fire-and-forget: record match move for replay (never blocks the game loop)
  if (moveData) {
    void recordMatchMove(moveData);
  }

  return {
    events: result.events,
    sanitizedState: sanitizeState(result.match),
  };
}
