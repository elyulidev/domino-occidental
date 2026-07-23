import { describe, expect, it } from "bun:test";
import type { BoardState, Tile } from "@domino/shared";
import { findBotMove } from "../bot";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tile(top: number, bottom: number, id?: string): Tile {
  return { top, bottom, id: id ?? `tile-${top}-${bottom}` };
}

function emptyBoard(): BoardState {
  return { leftEnd: null, rightEnd: null, tiles: [] };
}

function boardWith(leftEnd: number, rightEnd: number): BoardState {
  return {
    leftEnd,
    rightEnd,
    tiles: [
      { tile: tile(leftEnd, 5), side: "left", playerId: "p1" },
      { tile: tile(5, rightEnd), side: "right", playerId: "p2" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("findBotMove", () => {
  it("returns null for empty hand", () => {
    expect(findBotMove([], emptyBoard())).toBeNull();
  });

  it("plays first tile on empty board", () => {
    const hand = [tile(1, 2), tile(3, 4)];
    const move = findBotMove(hand, emptyBoard());
    expect(move).not.toBeNull();
    expect(move!.side).toBe("right");
    expect(hand.some((t) => t.id === move!.tileId)).toBe(true);
  });

  it("prefers doubles on empty board", () => {
    const hand = [tile(1, 2), tile(5, 5), tile(3, 4)];
    const move = findBotMove(hand, emptyBoard());
    expect(move).not.toBeNull();
    expect(move!.tileId).toBe("tile-5-5");
  });

  it("returns null when no valid moves exist", () => {
    const hand = [tile(1, 2), tile(3, 4)];
    const board = boardWith(8, 9);
    expect(findBotMove(hand, board)).toBeNull();
  });

  it("plays valid move on left side", () => {
    const hand = [tile(8, 6), tile(3, 4)];
    const board = boardWith(8, 9);
    const move = findBotMove(hand, board);
    expect(move).not.toBeNull();
    expect(move!.tileId).toBe("tile-8-6");
    expect(move!.side).toBe("left");
  });

  it("plays valid move on right side", () => {
    const hand = [tile(9, 6), tile(3, 4)];
    const board = boardWith(8, 9);
    const move = findBotMove(hand, board);
    expect(move).not.toBeNull();
    expect(move!.tileId).toBe("tile-9-6");
    expect(move!.side).toBe("right");
  });

  it("prefers doubles over non-doubles when both are valid", () => {
    const hand = [tile(8, 3), tile(8, 8)];
    const board = boardWith(8, 9);
    const move = findBotMove(hand, board);
    expect(move).not.toBeNull();
    expect(move!.tileId).toBe("tile-8-8");
  });

  it("prefers higher pip count when no doubles", () => {
    const hand = [tile(8, 1), tile(8, 7)];
    const board = boardWith(8, 9);
    const move = findBotMove(hand, board);
    expect(move).not.toBeNull();
    // tile(8,7) has score (8+7)*10=150, tile(8,1) has score (8+1)*10=90
    expect(move!.tileId).toBe("tile-8-7");
  });

  it("handles single tile hand", () => {
    const hand = [tile(8, 5)];
    const board = boardWith(8, 9);
    const move = findBotMove(hand, board);
    expect(move).not.toBeNull();
    expect(move!.tileId).toBe("tile-8-5");
    expect(move!.side).toBe("left");
  });
});
