import { describe, expect, it } from "bun:test";
import { createDeck, deal, shuffle } from "../deck";
import type { Tile } from "../types";

describe("createDeck", () => {
  it("returns exactly 55 tiles", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(55);
  });

  it("all tiles have unique ids", () => {
    const deck = createDeck();
    const ids = deck.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(55);
  });

  it("all double-9 combinations present exactly once", () => {
    const deck = createDeck();
    const tuples = deck
      .map((t) => `${Math.min(t.top, t.bottom)}-${Math.max(t.top, t.bottom)}`)
      .sort();
    const expected: string[] = [];
    for (let top = 0; top <= 9; top++) {
      for (let bottom = top; bottom <= 9; bottom++) {
        expected.push(`${top}-${bottom}`);
      }
    }
    expected.sort();
    expect(tuples).toEqual(expected);
  });

  it("tile values are in range 0-9", () => {
    const deck = createDeck();
    for (const tile of deck) {
      expect(tile.top).toBeGreaterThanOrEqual(0);
      expect(tile.top).toBeLessThanOrEqual(9);
      expect(tile.bottom).toBeGreaterThanOrEqual(0);
      expect(tile.bottom).toBeLessThanOrEqual(9);
    }
  });

  it("no ID collisions across independent decks", () => {
    const deck1 = createDeck();
    const deck2 = createDeck();
    const ids = [...deck1, ...deck2].map((t) => t.id);
    expect(new Set(ids).size).toBe(110);
  });
});

describe("shuffle", () => {
  it("returns same length as input", () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    expect(shuffled).toHaveLength(55);
  });

  it("contains the same tiles (by id)", () => {
    const deck = createDeck();
    const shuffled = shuffle(deck);
    const originalIds = new Set(deck.map((t) => t.id));
    const shuffledIds = new Set(shuffled.map((t) => t.id));
    expect(shuffledIds).toEqual(originalIds);
  });

  it("does not mutate the original array", () => {
    const deck = createDeck();
    const originalIds = deck.map((t) => t.id);
    shuffle(deck);
    expect(deck.map((t) => t.id)).toEqual(originalIds);
  });

  it("handles empty array", () => {
    const result: Tile[] = shuffle([]);
    expect(result).toHaveLength(0);
  });
});

describe("deal", () => {
  it("distributes 4 hands of 10 tiles each", () => {
    const deck = shuffle(createDeck());
    const result = deal(deck);
    expect(result.hands).toHaveLength(4);
    for (const hand of result.hands) {
      expect(hand).toHaveLength(10);
    }
  });

  it("pool has 15 tiles", () => {
    const deck = shuffle(createDeck());
    const result = deal(deck);
    expect(result.pool).toHaveLength(15);
  });

  it("all 55 tiles accounted for without overlap", () => {
    const deck = shuffle(createDeck());
    const result = deal(deck);
    const allIds = [
      ...result.hands[0],
      ...result.hands[1],
      ...result.hands[2],
      ...result.hands[3],
      ...result.pool,
    ];
    expect(allIds).toHaveLength(55);
    const uniqueIds = new Set(allIds.map((t) => t.id));
    expect(uniqueIds.size).toBe(55);
  });

  it("throws on insufficient tiles", () => {
    const shortDeck = createDeck().slice(0, 50);
    expect(() => deal(shortDeck)).toThrow("Deck must contain exactly 55 tiles");
  });

  it("does not mutate the input deck", () => {
    const deck = shuffle(createDeck());
    const originalIds = deck.map((t) => t.id);
    deal(deck);
    expect(deck.map((t) => t.id)).toEqual(originalIds);
  });
});
