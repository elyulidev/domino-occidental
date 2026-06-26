import type { PlayerState, Tile } from "./types";

/**
 * Creates a new player with default state.
 *
 * @param id - Player identifier (e.g. "p1" through "p4")
 * @returns A PlayerState with empty hand, connected, and zero passes
 */
export function createPlayer(id: string): PlayerState {
  return {
    id,
    hand: [],
    consecutivePasses: 0,
    isConnected: true,
    lastActionAt: new Date(),
  };
}

/**
 * Removes a tile from the hand by its ID.
 *
 * Returns a new array — the original is never mutated.
 *
 * @param hand - Current hand of tiles
 * @param tileId - ID of the tile to remove
 * @returns New hand without the matching tile
 * @throws {Error} If no tile with the given ID exists
 */
export function removeTile(hand: Tile[], tileId: string): Tile[] {
  const index = hand.findIndex((t) => t.id === tileId);
  if (index === -1) {
    throw new Error(`Tile with id "${tileId}" not found in hand`);
  }
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

/**
 * Appends a tile to the hand.
 *
 * Returns a new array — the original is never mutated.
 *
 * @param hand - Current hand of tiles
 * @param tile - Tile to add
 * @returns New hand with the tile appended
 */
export function addTile(hand: Tile[], tile: Tile): Tile[] {
  return [...hand, tile];
}

/**
 * Checks whether a tile with the given ID exists in the hand.
 *
 * @param hand - Current hand of tiles
 * @param tileId - ID to search for
 * @returns `true` if the tile is present, `false` otherwise
 */
export function hasTile(hand: Tile[], tileId: string): boolean {
  return hand.some((t) => t.id === tileId);
}

/**
 * Updates the player's connection status.
 *
 * Returns a new PlayerState — the original is never mutated.
 *
 * @param player - Current player state
 * @param connected - New connection status
 * @returns New player state with updated isConnected flag
 */
export function setConnected(
  player: PlayerState,
  connected: boolean,
): PlayerState {
  return { ...player, isConnected: connected };
}

/**
 * Stamps the player's lastActionAt with the current time.
 *
 * Returns a new PlayerState — the original is never mutated.
 *
 * @param player - Current player state
 * @param now - Optional timestamp (defaults to new Date())
 * @returns New player state with fresh timestamp
 */
export function updateLastAction(player: PlayerState, now?: Date): PlayerState {
  return { ...player, lastActionAt: now ?? new Date() };
}

/**
 * Increments the player's consecutive pass counter.
 *
 * Returns a new PlayerState — the original is never mutated.
 *
 * @param player - Current player state
 * @returns New player state with consecutivePasses + 1
 */
export function incrementPasses(player: PlayerState): PlayerState {
  return { ...player, consecutivePasses: player.consecutivePasses + 1 };
}

/**
 * Resets the player's consecutive pass counter to zero.
 *
 * Returns a new PlayerState — the original is never mutated.
 *
 * @param player - Current player state
 * @returns New player state with consecutivePasses: 0
 */
export function resetPasses(player: PlayerState): PlayerState {
  return { ...player, consecutivePasses: 0 };
}

/**
 * Calculates the total value of all tiles in the hand.
 *
 * Sums top + bottom for each tile. Returns 0 for an empty hand.
 *
 * @param hand - Current hand of tiles
 * @returns Sum of all tile values
 */
export function sumHand(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + tile.top + tile.bottom, 0);
}
