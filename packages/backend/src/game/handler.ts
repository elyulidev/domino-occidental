import type { ActionResult, GameEvent } from "@domino/shared";
import {
  type GameStore,
  type MessageResult,
  sanitizeState,
  type WsClientMessage,
} from "@domino/shared";
import { passTurn, playTile } from "@domino/shared/src/game";
import { type MoveRecord, recordMatchMove } from "../db/moves";
import { type RoundRecord, recordRound } from "../db/rounds";
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

  // Fire-and-forget: record round snapshot from hand_ended events (never blocks the game loop)
  for (const event of result.events) {
    if (event.type === "hand_ended") {
      const boardTileCount = result.match.board.tiles.length;
      const roundData: RoundRecord = {
        matchId,
        roundNumber: result.match.turn.roundNumber,
        winningPair: event.winner !== null ? (event.winner % 2 === 0 ? 0 : 1) : null,
        points: 0, // will be overwritten from hand_scored if present
        isBlocked: event.reason === "blocked" || event.reason === "forced_winner",
        isAnnulled: event.reason === "annulled",
        reason: event.reason,
        handScores: [0, 0], // placeholder — filled from hand_scored
        scoresAfter: event.scoresAfter,
        boardLeftEnd: result.match.board.leftEnd,
        boardRightEnd: result.match.board.rightEnd,
        boardTileCount,
        playerHands: event.playerHands,
        firstPlayer: event.starter,
      };

      // Enrich from hand_scored event (always follows hand_ended)
      const scored = result.events.find(
        (e): e is Extract<GameEvent, { type: "hand_scored" }> =>
          e.type === "hand_scored",
      );
      if (scored) {
        roundData.winningPair = scored.winningPair;
        roundData.points = scored.points;
        roundData.handScores = scored.scores;
      }

      void recordRound(roundData);
      break; // only one hand_ended per action
    }
  }

  return {
    events: result.events,
    sanitizedState: sanitizeState(result.match),
  };
}
