import type { GameEvent, MatchState, Side, Tile } from "@domino/shared";
import { passTurn, playTile as sharedPlayTile } from "@domino/shared/src/game";
import type { GameEngine } from "./types";

/**
 * Local game engine that wraps shared game functions.
 *
 * The human player is always playerIndex 0. This engine runs in-process
 * without a server — used for local/development play only.
 *
 * NOTE: Bot auto-play has been removed. Only real player actions are supported.
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
   * No-op — bot turns have been removed.
   * Only real player actions are supported.
   */
  processBotTurns(): MatchState {
    return this._state;
  }

  destroy(): void {
    // Nothing to clean up — no timers.
  }
}
