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
