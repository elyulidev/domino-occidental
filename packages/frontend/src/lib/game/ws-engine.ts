import type {
  BoardState,
  GameEvent,
  MatchState,
  MatchStatus,
  SanitizedMatchState,
  Side,
  Tile,
  WsClientMessage,
} from "@domino/shared";
import type { GameEngine } from "./types";

/**
 * WebSocket-backed game engine that implements the GameEngine interface.
 *
 * Instead of computing game logic locally (like LocalGameEngine), it sends
 * player actions to the server via WebSocket and receives authoritative
 * state updates. The server is the single source of truth.
 */
export class WsGameEngine implements GameEngine {
  private _sanitized: SanitizedMatchState;
  private _hand: Tile[];
  private _playerIndex: number;
  private _send: (msg: WsClientMessage) => void;

  constructor(
    sanitized: SanitizedMatchState,
    yourHand: Tile[],
    playerIndex: number,
    send: (msg: WsClientMessage) => void,
  ) {
    this._sanitized = sanitized;
    this._hand = yourHand;
    this._playerIndex = playerIndex;
    this._send = send;
  }

  /** Wire the send function to a live WebSocket instance. */
  setSend(send: (msg: WsClientMessage) => void): void {
    this._send = send;
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  get state(): MatchState {
    return this._toMatchState();
  }

  get hand(): Tile[] {
    return this._hand;
  }

  get playerIndex(): number {
    return this._playerIndex;
  }

  /**
   * Remote engine — delegates all game logic to the server.
   * Local state is optimistic and will be reconciled via WS messages.
   */
  readonly remote = true;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  playTile(tileId: string, side: Side): { events: GameEvent[]; match: MatchState } {
    this._send({ type: "play_tile", tileId, side });

    // Optimistically remove tile from hand
    this._hand = this._hand.filter((t) => t.id !== tileId);

    return { events: [], match: this.state };
  }

  pass(): { events: GameEvent[]; match: MatchState } {
    this._send({ type: "pass" });
    return { events: [], match: this.state };
  }

  processBotTurns(): MatchState {
    // Server handles bot turns — no-op for WS engine
    return this.state;
  }

  applyState(sanitized: SanitizedMatchState, yourHand?: Tile[], playerIndex?: number): void {
    this._sanitized = sanitized;
    if (yourHand !== undefined) {
      this._hand = yourHand;
    }
    if (playerIndex !== undefined) {
      this._playerIndex = playerIndex;
    }
  }

  destroy(): void {
    // No-op — the hook that owns this engine manages the WS connection lifecycle
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert SanitizedMatchState (server shape, no hands/pool) into a full
   * MatchState (client shape) with dummy hands for opponents and an empty pool.
   */
  private _toMatchState(): MatchState {
    const s = this._sanitized;

    const players = s.players.map((p, i) => ({
      id: p.id,
      hand: i === this._playerIndex ? this._hand : [],
      consecutivePasses: 0,
      isConnected: p.isConnected,
      lastActionAt: new Date(),
    })) as MatchState["players"];

    return {
      matchId: s.matchId,
      players,
      board: s.board as BoardState,
      turn: {
        currentTurn: s.currentTurn as 0 | 1 | 2 | 3,
        turnDeadline: s.turnDeadline,
        consecutiveNullRounds: s.consecutiveNullRounds,
        roundNumber: s.roundNumber,
        lastHandWinner: s.lastHandWinner as MatchState["turn"]["lastHandWinner"],
      },
      scores: { scores: s.scores, isTiebreaker: false },
      pool: [],
      poolCount: s.poolCount,
      status: s.status as MatchStatus,
      targetScore: s.targetScore,
    };
  }
}
