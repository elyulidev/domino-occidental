import { describe, expect, it } from "bun:test";
import type { BoardState, Tile } from "@domino/shared";
import { chooseBotMove, isDoubleMove } from "../bot";

function tile(top: number, bottom: number, id?: string): Tile {
  return { top, bottom, id: id ?? crypto.randomUUID() };
}

describe("chooseBotMove", () => {
  it("returns a valid move on empty board from any tile in hand", () => {
    const hand: Tile[] = [tile(3, 7), tile(1, 2), tile(5, 5)];
    const board: BoardState = { leftEnd: null, rightEnd: null, tiles: [] };
    const move = chooseBotMove(hand, board);
    expect(move).not.toBeNull();
    // On empty board both sides are valid; verify at least the tile is in hand
    expect(hand.some((t) => t.id === move?.tileId)).toBe(true);
  });

  it("returns a tile that matches the board end on either side", () => {
    const hand: Tile[] = [tile(1, 2), tile(3, 7), tile(5, 5)];
    const board: BoardState = { leftEnd: 7, rightEnd: 7, tiles: [] };
    const move = chooseBotMove(hand, board);
    expect(move).not.toBeNull();
    // tile(3,7) or tile(5,5) match both ends, tile(1,2) does not
    const matchedTile = hand.find((t) => t.id === move?.tileId);
    expect(matchedTile).toBeDefined();
    expect(matchedTile?.top === 7 || matchedTile?.bottom === 7).toBe(true);
  });

  it("returns a tile that matches rightEnd when left does not match", () => {
    const hand: Tile[] = [tile(1, 2), tile(3, 7), tile(5, 5)];
    const board: BoardState = { leftEnd: 8, rightEnd: 2, tiles: [] };
    const move = chooseBotMove(hand, board);
    expect(move).not.toBeNull();
    expect(move?.side).toBe("right");
    expect(move?.tileId).toBe(hand[0].id); // tile(1,2) matches rightEnd=2
  });

  it("considers both sides when a tile matches both ends", () => {
    const hand: Tile[] = [tile(5, 5)];
    const board: BoardState = { leftEnd: 5, rightEnd: 5, tiles: [] };
    // Run multiple times to ensure both sides are possible
    const sides = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const move = chooseBotMove(hand, board);
      expect(move).not.toBeNull();
      sides.add(move?.side);
    }
    // Both left and right should have been returned at least once
    expect(sides.has("left")).toBe(true);
    expect(sides.has("right")).toBe(true);
  });

  it("returns null when no tile can be played", () => {
    const hand: Tile[] = [tile(1, 2), tile(3, 4)];
    const board: BoardState = { leftEnd: 8, rightEnd: 9, tiles: [] };
    const move = chooseBotMove(hand, board);
    expect(move).toBeNull();
  });

  it("prefers doubles over non-doubles", () => {
    // Multiple non-double matching tiles + one double
    const hand: Tile[] = [tile(3, 1), tile(3, 2), tile(3, 3)];
    const board: BoardState = { leftEnd: 3, rightEnd: 7, tiles: [] };
    // Run multiple times — should prefer the double
    for (let i = 0; i < 10; i++) {
      const move = chooseBotMove(hand, board);
      expect(move).not.toBeNull();
      // biome-ignore lint/style/noNonNullAssertion: verified non-null on previous line
      expect(isDoubleMove(move!, hand)).toBe(true);
    }
  });

  it("returns null for empty hand", () => {
    const hand: Tile[] = [];
    const board: BoardState = { leftEnd: 5, rightEnd: 3, tiles: [] };
    const move = chooseBotMove(hand, board);
    expect(move).toBeNull();
  });

  it("returns a valid move even when multiple tiles are playable", () => {
    const hand: Tile[] = [tile(3, 3), tile(3, 5), tile(5, 5)];
    const board: BoardState = { leftEnd: 3, rightEnd: 5, tiles: [] };
    const move = chooseBotMove(hand, board);
    expect(move).not.toBeNull();
    // All tiles are playable — verify the move is valid
    const matchedTile = hand.find((t) => t.id === move?.tileId);
    expect(matchedTile).toBeDefined();
  });

  it("returned moves are always valid against the board", () => {
    const hand: Tile[] = [tile(0, 1), tile(2, 3), tile(4, 5), tile(6, 7), tile(8, 9)];
    const board: BoardState = { leftEnd: 1, rightEnd: 8, tiles: [] };
    // Run multiple times checking validity
    for (let i = 0; i < 20; i++) {
      const move = chooseBotMove(hand, board);
      expect(move).not.toBeNull();
      // biome-ignore lint/style/noNonNullAssertion: verified non-null via expect().not.toBeNull()
      const t = hand.find((h) => h.id === move?.tileId)!;
      const endValue = move?.side === "left" ? board.leftEnd : board.rightEnd;
      expect(t.top === endValue || t.bottom === endValue).toBe(true);
    }
  });

  it("can play a double on either side when both ends match", () => {
    const hand: Tile[] = [tile(7, 7)];
    const board: BoardState = { leftEnd: 7, rightEnd: 7, tiles: [] };
    const sides = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const move = chooseBotMove(hand, board);
      expect(move).not.toBeNull();
      sides.add(move?.side);
    }
    expect(sides.has("left")).toBe(true);
    expect(sides.has("right")).toBe(true);
  });
});

describe("isDoubleMove", () => {
  it("returns true when the tile is a double", () => {
    const hand: Tile[] = [tile(5, 5)];
    expect(isDoubleMove({ tileId: hand[0].id }, hand)).toBe(true);
  });

  it("returns false when the tile is not a double", () => {
    const hand: Tile[] = [tile(3, 7)];
    expect(isDoubleMove({ tileId: hand[0].id }, hand)).toBe(false);
  });

  it("returns false for unknown tile id", () => {
    expect(isDoubleMove({ tileId: "nonexistent" }, [tile(5, 5)])).toBe(false);
  });
});
