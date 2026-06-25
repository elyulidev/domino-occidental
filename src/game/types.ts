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
