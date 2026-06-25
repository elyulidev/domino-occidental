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
