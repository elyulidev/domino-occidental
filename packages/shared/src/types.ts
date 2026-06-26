/**
 * Canonical Tile type for the double-9 domino set.
 *
 * Each tile represents a domino piece with two numbered ends.
 * The `id` field uses `crypto.randomUUID()` for global uniqueness.
 *
 * @see AGENTS.md §3 for the canonical definition
 */
export interface Tile {
  /** Top end of the domino (0–9) */
  top: number;
  /** Bottom end of the domino (0–9) */
  bottom: number;
  /** Unique identifier (crypto.randomUUID()) */
  id: string;
}

/**
 * Individual player state within a game session.
 *
 * Tracks the player's hand tiles, connection status, and pass count.
 * All fields are managed via pure functions in `player.ts`.
 */
export interface PlayerState {
  /** Player identifier (e.g. "p1" through "p4") */
  id: string;
  /** Current hand of domino tiles */
  hand: Tile[];
  /** Number of consecutive passes (resets when a tile is played) */
  consecutivePasses: number;
  /** Whether the player's WebSocket connection is active */
  isConnected: boolean;
  /** Timestamp of the player's last action (play, pass, or reconnect) */
  lastActionAt: Date;
}

/**
 * Named return type for the deal() function.
 *
 * Distributes 55 tiles into exactly 4 hands of 10 tiles each,
 * with 15 remaining in the pool.
 */
export interface DealResult {
  /** Exactly 4 hands, each containing 10 tiles */
  hands: [Tile[], Tile[], Tile[], Tile[]];
  /** 15 remaining tiles not dealt to any player */
  pool: Tile[];
}

/**
 * Side of the board where a tile is placed.
 */
export type Side = "left" | "right";

/**
 * A tile placed on the board, recording its position and owner.
 */
export interface PlacedTile {
  /** The domino tile (stored in canonical orientation after auto-flip) */
  tile: Tile;
  /** Which side of the board it was placed on */
  side: Side;
  /** Player who placed the tile */
  playerId: string;
}

/**
 * Immutable representation of the domino line-of-play.
 *
 * The board is a linear chain with two open ends.
 * `leftEnd` and `rightEnd` track the exposed values;
 * `tiles` is the ordered list of all placed tiles.
 */
export interface BoardState {
  /** Value exposed at the left end (null if empty) */
  leftEnd: number | null;
  /** Value exposed at the right end (null if empty) */
  rightEnd: number | null;
  /** Ordered list of placed tiles */
  tiles: PlacedTile[];
}

/**
 * Constants for turn management.
 */
export const TURN_TIMEOUT_MS = 45_000;
export const PLAYER_COUNT = 4;

/**
 * Module 7: Connection management constants.
 */
export const HEARTBEAT_MS = 5_000;
export const RECONNECT_WINDOW_MS = 30_000;
export const ABANDONMENT_THRESHOLD_MS = 60_000;

/**
 * Immutable state for turn ordering, timeout enforcement, and round tracking.
 *
 * All functions in turn.ts accept and return this type without mutation.
 */
export interface TurnState {
  /** Index of the current player (0–3) */
  currentTurn: 0 | 1 | 2 | 3;
  /** Deadline for the current turn in Unix ms, or null if not yet set */
  turnDeadline: number | null;
  /** Number of consecutive null (blocked) rounds */
  consecutiveNullRounds: number;
  /** Current round number (0-indexed) */
  roundNumber: number;
  /** Winner of the last hand, or null for the first hand of the match */
  lastHandWinner: 0 | 1 | 2 | 3 | null;
}

/**
 * Result of a turn timeout check.
 */
export interface TimeoutResult {
  /** Whether the turn has exceeded its deadline */
  timedOut: boolean;
  /** The player index whose turn was checked */
  playerIndex: 0 | 1 | 2 | 3;
}

/**
 * Target score to win a match (200 points by default).
 * @see AGENTS.md §5 for game rules
 */
export const TARGET_SCORE = 200;

/**
 * Index of a pair in the match: 0 or 1.
 * Pairs: P1+P3 = pair 0, P2+P4 = pair 1.
 */
export type PairIndex = 0 | 1;

/**
 * Immutable snapshot of accumulated scores for both pairs.
 */
export interface ScoreState {
  /** [pair0, pair1] — accumulated points per pair */
  scores: [number, number];
  /** Whether the match is in tiebreaker mode (exact tie at 200+) */
  isTiebreaker: boolean;
}

/**
 * Result of scoring a single hand.
 */
export interface HandResult {
  /** Pair that won the hand */
  winningPair: PairIndex;
  /** Points awarded to the winning pair */
  points: number;
  /** Whether the hand ended in a blocked board */
  isBlocked: boolean;
  /** Whether the hand was annulled (blocked tie, below cascade threshold) */
  isAnnulled: boolean;
}

/**
 * Result of checking whether the match has ended.
 */
export interface MatchResult {
  /** Whether the match is over */
  isOver: boolean;
  /** Winning pair index, or null if not over */
  winner: PairIndex | null;
  /** Reason: "reached_target" | "both_over_200" | "tiebreaker" */
  reason: string;
}

/**
 * Lifecycle status of a match.
 */
export type MatchStatus = "waiting" | "in_progress" | "finished" | "abandoned";

/**
 * Complete immutable state of a domino match.
 *
 * Encapsulates the board, turn ordering, scores, and player states.
 * All mutations are performed via pure functions in `match.ts`.
 */
export interface MatchState {
  /** Unique match identifier */
  matchId: string;
  /** The four player states (indices 0–3) */
  players: [PlayerState, PlayerState, PlayerState, PlayerState];
  /** Current board state */
  board: BoardState;
  /** Current turn state */
  turn: TurnState;
  /** Accumulated scores */
  scores: ScoreState;
  /** Tiles remaining in the pool (face-down, server-only) */
  pool: Tile[];
  /** Number of tiles in the pool (for client communication) */
  poolCount: number;
  /** Current lifecycle status */
  status: MatchStatus;
  /** Target score to win the match */
  targetScore: number;
}

/**
 * Result returned by every match action function.
 *
 * Contains the updated MatchState and a list of events to broadcast.
 * Errors are represented as `game_error` events, never thrown.
 */
export interface ActionResult {
  /** The updated match state (may be identical to input if action was invalid) */
  match: MatchState;
  /** Ordered list of events to emit to connected clients */
  events: GameEvent[];
}

/**
 * Configuration for ELO calculation.
 */
export interface EloConfig {
  /** K-factor (32, 48, or 16) */
  kFactor: number;
  /** Whether this is a tournament match */
  isTournament: boolean;
}

/**
 * Result of applying ELO changes to two players.
 */
export interface EloResult {
  /** ELO delta for player 1 */
  player1Delta: number;
  /** ELO delta for player 2 */
  player2Delta: number;
  /** New ELO for player 1 */
  player1NewElo: number;
  /** New ELO for player 2 */
  player2NewElo: number;
}

/**
 * Discriminated union of all game events emitted by match actions.
 */
export type GameEvent =
  | { type: "round_started"; firstPlayer: number }
  | {
      type: "tile_played";
      playerId: string;
      tileId: string;
      side: Side;
      board: BoardState;
    }
  | { type: "player_passed"; playerId: string }
  | { type: "turn_timeout"; playerId: string; forcedPass: boolean }
  | {
      type: "hand_ended";
      winner: number | null;
      reason: "empty_hand" | "blocked" | "annulled" | "forced_winner";
    }
  | {
      type: "hand_scored";
      winningPair: PairIndex;
      points: number;
      scores: [number, number];
    }
  | {
      type: "match_ended";
      winner: PairIndex;
      finalScores: [number, number];
      reason: string;
    }
  | { type: "player_disconnected"; playerId: string; reconnectWindowMs: number }
  | { type: "player_reconnected"; playerId: string }
  | {
      type: "reconnection_window_expiring";
      playerId: string;
      secondsLeft: number;
    }
  | {
      type: "match_abandoned";
      disconnectedPlayerId: string;
      reason: "abandonment" | "forfeit";
    }
  | { type: "game_error"; code: string; message: string };
