import { describe, expect, it } from "bun:test";
import { canPlay, createBoard, place } from "../board";
import type { BoardState, Tile } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tile(top: number, bottom: number): Tile {
  return { top, bottom, id: crypto.randomUUID() };
}

// ---------------------------------------------------------------------------
// createBoard
// ---------------------------------------------------------------------------

describe("createBoard", () => {
  it("returns an empty board with null ends and no tiles", () => {
    const board = createBoard();
    expect(board).toEqual({ leftEnd: null, rightEnd: null, tiles: [] });
  });

  it("returns a fresh object on every call", () => {
    const a = createBoard();
    const b = createBoard();
    expect(a).not.toBe(b);
    expect(a.tiles).not.toBe(b.tiles);
  });
});

// ---------------------------------------------------------------------------
// canPlay
// ---------------------------------------------------------------------------

describe("canPlay", () => {
  it("returns true on an empty board for any tile", () => {
    const board = createBoard();
    expect(canPlay(tile(3, 7), "left", board)).toBe(true);
    expect(canPlay(tile(0, 0), "right", board)).toBe(true);
  });

  it("returns true when tile.bottom matches leftEnd", () => {
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 2,
      tiles: [],
    };
    // tile.top=3, tile.bottom=5 → bottom matches leftEnd=5
    expect(canPlay(tile(3, 5), "left", board)).toBe(true);
  });

  it("returns true when tile.top matches leftEnd", () => {
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 2,
      tiles: [],
    };
    // tile.top=5, tile.bottom=3 → top matches leftEnd=5
    expect(canPlay(tile(5, 3), "left", board)).toBe(true);
  });

  it("returns true when tile.top matches rightEnd", () => {
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 2,
      tiles: [],
    };
    // tile.top=2, tile.bottom=8 → top matches rightEnd=2
    expect(canPlay(tile(2, 8), "right", board)).toBe(true);
  });

  it("returns true when tile.bottom matches rightEnd", () => {
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 2,
      tiles: [],
    };
    // tile.top=8, tile.bottom=2 → bottom matches rightEnd=2
    expect(canPlay(tile(8, 2), "right", board)).toBe(true);
  });

  it("returns false when tile matches neither end", () => {
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 2,
      tiles: [],
    };
    expect(canPlay(tile(3, 7), "left", board)).toBe(false);
    expect(canPlay(tile(3, 7), "right", board)).toBe(false);
  });

  it("returns true when tile matches both ends", () => {
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 5,
      tiles: [],
    };
    expect(canPlay(tile(5, 5), "left", board)).toBe(true);
    expect(canPlay(tile(5, 5), "right", board)).toBe(true);
  });

  it("only checks the specified side (side-specific)", () => {
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 2,
      tiles: [],
    };
    // tile(5, 9): matches leftEnd=5 but NOT rightEnd=2
    expect(canPlay(tile(5, 9), "left", board)).toBe(true);
    expect(canPlay(tile(5, 9), "right", board)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// place
// ---------------------------------------------------------------------------

describe("place", () => {
  it("first tile sets both ends", () => {
    const board = createBoard();
    // side='left': leftEnd = tile.bottom, rightEnd = tile.top
    const result = place(tile(4, 1), "left", "p1", board);
    expect(result.leftEnd).toBe(1);
    expect(result.rightEnd).toBe(4);
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0].playerId).toBe("p1");
    expect(result.tiles[0].side).toBe("left");
  });

  it("first tile on side='right' inverts ends", () => {
    const board = createBoard();
    // side='right': leftEnd = tile.top, rightEnd = tile.bottom
    const result = place(tile(4, 1), "right", "p1", board);
    expect(result.leftEnd).toBe(4);
    expect(result.rightEnd).toBe(1);
  });

  it("extends left end (no flip)", () => {
    // Board has leftEnd=3. Place tile(5,3) on left: bottom=3 matches leftEnd=3
    // new leftEnd = tile.top = 5
    const board: BoardState = {
      leftEnd: 3,
      rightEnd: 8,
      tiles: [],
    };
    const result = place(tile(5, 3), "left", "p2", board);
    expect(result.leftEnd).toBe(5);
    expect(result.rightEnd).toBe(8);
    expect(result.tiles).toHaveLength(1);
  });

  it("extends left end (with flip)", () => {
    // Board has leftEnd=3. Place tile(3,5) on left: top=3 matches leftEnd=3
    // Flip → new leftEnd = tile.bottom = 5
    const board: BoardState = {
      leftEnd: 3,
      rightEnd: 8,
      tiles: [],
    };
    const result = place(tile(3, 5), "left", "p2", board);
    expect(result.leftEnd).toBe(5);
    expect(result.rightEnd).toBe(8);
  });

  it("extends right end (no flip)", () => {
    // Board has rightEnd=6. Place tile(6,8) on right: top=6 matches rightEnd=6
    // new rightEnd = tile.bottom = 8
    const board: BoardState = {
      leftEnd: 4,
      rightEnd: 6,
      tiles: [],
    };
    const result = place(tile(6, 8), "right", "p2", board);
    expect(result.leftEnd).toBe(4);
    expect(result.rightEnd).toBe(8);
  });

  it("extends right end (with flip)", () => {
    // Board has rightEnd=6. Place tile(8,6) on right: bottom=6 matches rightEnd=6
    // Flip → new rightEnd = tile.top = 8
    const board: BoardState = {
      leftEnd: 4,
      rightEnd: 6,
      tiles: [],
    };
    const result = place(tile(8, 6), "right", "p2", board);
    expect(result.leftEnd).toBe(4);
    expect(result.rightEnd).toBe(8);
  });

  it("does not change end value when placing a double", () => {
    // Board has leftEnd=5. Place double(5,5) on left.
    // tile.bottom=5 matches leftEnd=5 → new leftEnd = tile.top = 5 (same)
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 2,
      tiles: [],
    };
    const result = place(tile(5, 5), "left", "p1", board);
    expect(result.leftEnd).toBe(5);
    expect(result.rightEnd).toBe(2);
  });

  it("throws on invalid tile+side combination", () => {
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 2,
      tiles: [],
    };
    // tile(3,7) matches neither leftEnd=5 nor rightEnd=2
    expect(() => place(tile(3, 7), "left", "p1", board)).toThrow(
      /cannot be placed/i,
    );
    expect(() => place(tile(3, 7), "right", "p1", board)).toThrow(
      /cannot be placed/i,
    );
  });

  it("does not mutate the original board", () => {
    const board = createBoard();
    const originalTiles = board.tiles;
    place(tile(4, 1), "left", "p1", board);
    expect(board.leftEnd).toBeNull();
    expect(board.rightEnd).toBeNull();
    expect(board.tiles).toBe(originalTiles);
  });

  it("appends to tiles array immutably", () => {
    const board1 = createBoard();
    const board2 = place(tile(4, 1), "left", "p1", board1);
    const board3 = place(tile(1, 3), "left", "p2", board2);
    expect(board1.tiles).toHaveLength(0);
    expect(board2.tiles).toHaveLength(1);
    expect(board3.tiles).toHaveLength(2);
    // board2.tiles should not be the same reference as board3.tiles
    expect(board2.tiles).not.toBe(board3.tiles);
  });
});
