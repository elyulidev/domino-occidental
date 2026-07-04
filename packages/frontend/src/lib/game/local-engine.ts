import type { GameEvent, MatchState, Side, Tile } from "@domino/shared";
import { playTile as sharedPlayTile, passTurn } from "@domino/shared/src/game";
import type { GameEngine } from "./types";
import { chooseBotMove } from "./bot";

/**
 * Local game engine that wraps shared game functions and adds bot auto-play.
 *
 * The human player is always playerIndex 0. After each human action,
 * the store calls processBotTurns() to resolve all pending bot turns
 * synchronously, keeping the store as the single source of truth for state.
 */
export class LocalGameEngine implements GameEngine {
  private _state: MatchState;
  private _playerIndex: number;

  constructor(match: MatchState, playerIndex: number = 0) {
    this._state = match;
    this._playerIndex = playerIndex;
  }

  get state(): MatchState {
    return this._state;
  }

  get hand(): Tile[] {
    return this._state.players[this._playerIndex].hand;
  }

  get playerIndex(): number {
    return this._playerIndex;
  }

  /** Local engine — game logic runs in-process, no server delegation. */
  readonly remote = false;

  playTile(tileId: string, side: Side): { events: GameEvent[]; match: MatchState } {
    const playerId = this._state.players[this._playerIndex].id;
    const result = sharedPlayTile(this._state, playerId, tileId, side);
    this._state = result.match;
    return result;
  }

  pass(): { events: GameEvent[]; match: MatchState } {
    const playerId = this._state.players[this._playerIndex].id;
    const result = passTurn(this._state, playerId);
    this._state = result.match;
    return result;
  }

  /**
   * Resolve all pending bot turns synchronously.
   * Returns the final MatchState after all bots have played.
   * Stops when it's the human's turn or the match ends.
   */
  processBotTurns(): MatchState {
    while (this._state.status === "in_progress") {
      const currentTurn = this._state.turn.currentTurn;
      if (currentTurn === this._playerIndex) break; // human's turn

      const botPlayer = this._state.players[currentTurn];
      const move = chooseBotMove(botPlayer.hand, this._state.board);

      if (move) {
        const result = sharedPlayTile(this._state, botPlayer.id, move.tileId, move.side);
        this._state = result.match;
      } else {
        const result = passTurn(this._state, botPlayer.id);
        this._state = result.match;
      }
    }

    return this._state;
  }

  destroy(): void {
    // Nothing to clean up — no timers.
  }
}
