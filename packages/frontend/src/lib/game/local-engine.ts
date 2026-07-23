import type { GameEvent, MatchState, Side, Tile } from "@domino/shared";
import { passTurn, playTile as sharedPlayTile } from "@domino/shared/src/game";
import { findBotMove } from "./bot";
import type { GameEngine } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOT_DELAY_MS = 1_500; // 1.5s delay between bot turns for visual feedback

// ---------------------------------------------------------------------------
// Local Game Engine
// ---------------------------------------------------------------------------

/**
 * Local game engine that wraps shared game functions.
 *
 * The human player is always playerIndex 0. This engine runs in-process
 * without a server — used for CPU practice mode.
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
   * Processes bot turns sequentially with visual delays.
   *
   * Loops while it's a bot's turn (not playerIndex 0) and the match is
   * still in progress. Each bot turn is delayed by BOT_DELAY_MS to give
   * the user visual feedback. Returns when it's the human's turn again
   * or the match ends.
   *
   * @param onBotPlayed - Optional callback fired after each bot action (for UI sync)
   * @returns The current match state after all bot turns are resolved
   */
  processBotTurns(_onBotPlayed?: () => void): MatchState {
    // Synchronous version: resolve all bot turns immediately (used in tests)
    while (true) {
      if (this._state.status !== "in_progress") break;
      if (this._state.turn.currentTurn === this._playerIndex) break;

      const currentPlayer = this._state.players[this._state.turn.currentTurn];
      if (currentPlayer.hand.length === 0) break;

      const move = findBotMove(currentPlayer.hand, this._state.board);

      let result: import("@domino/shared").ActionResult;
      if (move) {
        result = sharedPlayTile(this._state, currentPlayer.id, move.tileId, move.side);
      } else {
        result = passTurn(this._state, currentPlayer.id);
      }

      this._state = result.match;

      if (this._state.status !== "in_progress") break;
    }

    return this._state;
  }

  /**
   * Async version of processBotTurns with visual delays between bot actions.
   *
   * Resolves bot turns one at a time with BOT_DELAY_MS between each,
   * yielding to the event loop so the UI can render updates.
   *
   * @param onBotPlayed - Optional callback fired after each bot action (for UI sync)
   * @returns Promise that resolves when it's the human's turn or match ends
   */
  async processBotTurnsAsync(onBotPlayed?: () => void): Promise<MatchState> {
    while (true) {
      if (this._state.status !== "in_progress") break;
      if (this._state.turn.currentTurn === this._playerIndex) break;

      const currentPlayer = this._state.players[this._state.turn.currentTurn];
      if (currentPlayer.hand.length === 0) break;

      // Yield to event loop for rendering
      await new Promise((resolve) => setTimeout(resolve, BOT_DELAY_MS));

      const move = findBotMove(currentPlayer.hand, this._state.board);

      let result: import("@domino/shared").ActionResult;
      if (move) {
        result = sharedPlayTile(this._state, currentPlayer.id, move.tileId, move.side);
      } else {
        result = passTurn(this._state, currentPlayer.id);
      }

      this._state = result.match;

      // Notify caller so UI can sync
      onBotPlayed?.();

      if (this._state.status !== "in_progress") break;
    }

    return this._state;
  }

  destroy(): void {
    // Nothing to clean up — no timers managed by the engine itself.
  }
}
