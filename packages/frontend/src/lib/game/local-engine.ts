import type { ActionResult, GameEvent, MatchState, Side, Tile } from "@domino/shared";
import { checkTimeout as sharedCheckTimeout, passTurn, playTile as sharedPlayTile } from "@domino/shared/src/game";
import { findBotMove } from "./bot";
import type { GameEngine } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Random delay between bot turns for visual feedback (5–10 seconds). */
function randomBotDelay(): number {
  return 5_000 + Math.random() * 5_000;
}

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
   * @param onBotPlayed - Optional callback fired after each bot action, receives events array
   * @returns The current match state after all bot turns are resolved
   */
  processBotTurns(onBotPlayed?: (events?: GameEvent[]) => void): MatchState {
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

      // Notify caller with events
      onBotPlayed?.(result.events);

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
   * @param onBotPlayed - Optional callback fired after each bot action, receives events array (for UI sync)
   * @returns Promise that resolves when it's the human's turn or match ends
   */
  async processBotTurnsAsync(onBotPlayed?: (events?: GameEvent[]) => void): Promise<MatchState> {
    while (true) {
      if (this._state.status !== "in_progress") break;
      if (this._state.turn.currentTurn === this._playerIndex) break;

      const currentPlayer = this._state.players[this._state.turn.currentTurn];
      if (currentPlayer.hand.length === 0) break;

      // Yield to event loop for rendering with random delay
      await new Promise((resolve) => setTimeout(resolve, randomBotDelay()));

      const move = findBotMove(currentPlayer.hand, this._state.board);

      let result: import("@domino/shared").ActionResult;
      if (move) {
        result = sharedPlayTile(this._state, currentPlayer.id, move.tileId, move.side);
      } else {
        result = passTurn(this._state, currentPlayer.id);
      }

      this._state = result.match;

      // Notify caller with events so UI can detect passes
      onBotPlayed?.(result.events);

      if (this._state.status !== "in_progress") break;
    }

    return this._state;
  }

  /**
   * Checks if the current turn has timed out and forces a pass + blocks playable tiles.
   *
   * Wraps the shared checkTimeout() function. Should be called periodically by the
   * host (e.g. cpu/page.tsx) when it's the human player's turn and the deadline has passed.
   *
   * @param now - Current time in Unix ms (Date.now())
   * @returns ActionResult if a timeout occurred, null otherwise
   */
  checkTimeout(now: number): ActionResult | null {
    const result = sharedCheckTimeout(this._state, now);
    // Only update state if something actually changed (timedOut happened)
    if (result.events.length > 0) {
      this._state = result.match;
      return result;
    }
    return null;
  }

  destroy(): void {
    // Nothing to clean up — no timers managed by the engine itself.
  }
}
