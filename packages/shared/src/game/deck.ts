import type { DealResult, Tile } from "../types";

/**
 * Creates a complete double-9 domino deck (55 unique tiles).
 *
 * Generates all combinations where 0 ≤ top ≤ bottom ≤ 9,
 * each tile identified by a cryptographically random UUID.
 *
 * @returns Array of exactly 55 Tile objects
 */
export function createDeck(): Tile[] {
  const deck: Tile[] = [];
  for (let top = 0; top <= 9; top++) {
    for (let bottom = top; bottom <= 9; bottom++) {
      deck.push({
        top,
        bottom,
        id: crypto.randomUUID(),
      });
    }
  }
  return deck;
}

/**
 * Shuffles a deck of tiles using the Fisher-Yates algorithm.
 *
 * Returns a new array — the original is never mutated.
 * Handles empty arrays gracefully (returns empty array).
 *
 * @param deck - Array of tiles to shuffle
 * @returns New array with tiles in random order
 */
export function shuffle(deck: Tile[]): Tile[] {
  if (deck.length === 0) return [];
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deals a shuffled deck into 4 hands of 10 tiles and a pool of 15.
 *
 * @param deck - Array of exactly 55 tiles
 * @returns DealResult with 4 hands and a pool
 * @throws {Error} If deck does not contain exactly 55 tiles
 */
export function deal(deck: Tile[]): DealResult {
  if (deck.length !== 55) {
    throw new Error(
      `Deck must contain exactly 55 tiles, but got ${deck.length}`,
    );
  }
  return {
    hands: [
      deck.slice(0, 10),
      deck.slice(10, 20),
      deck.slice(20, 30),
      deck.slice(30, 40),
    ],
    pool: deck.slice(40, 55),
  };
}
