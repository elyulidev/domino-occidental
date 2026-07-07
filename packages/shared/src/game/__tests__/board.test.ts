import { describe, expect, it } from "bun:test";
import type { Tile } from "../../types";
import { createBoard, place } from "../board";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTile(top: number, bottom: number, id = "t-1"): Tile {
  return { top, bottom, id };
}

// ---------------------------------------------------------------------------
// Tests — place() flipped + slotIndex
// ---------------------------------------------------------------------------

describe("place() — flipped and slotIndex", () => {
  // ── flipped (task 2.2) ──

  describe("flipped field", () => {
    it("center tile on right: tile(6,6) → flipped=true (top connects)", () => {
      const board = createBoard();
      const result = place(makeTile(6, 6), "right", "p0", board);
      expect(result.tiles[0].flipped).toBe(true);
    });

    it("center tile on left: tile(6,6) → flipped=true (top connects)", () => {
      const board = createBoard();
      const result = place(makeTile(6, 6), "left", "p0", board);
      expect(result.tiles[0].flipped).toBe(true);
    });

    it("rightEnd=5, tile(5,3) on right → flipped=true", () => {
      // Place center first
      let board = createBoard();
      board = place(makeTile(6, 6), "right", "p0", board);
      // Now rightEnd=6, place tile(6,1) to get rightEnd=1
      board = place(makeTile(6, 1), "right", "p1", board);
      // rightEnd=1, place tile(5,1) on right: bottom=1 matches, no flip needed
      // Actually let me set up rightEnd=5 properly
      board = createBoard();
      board = place(makeTile(5, 5), "right", "p0", board);
      // rightEnd=5, tile(5,3): top=5 matches rightEnd=5 → flipped=true
      const result = place(makeTile(5, 3), "right", "p1", board);
      expect(result.tiles[1].flipped).toBe(true);
    });

    it("rightEnd=5, tile(3,5) on right → flipped=true (right side non-center)", () => {
      let board = createBoard();
      board = place(makeTile(5, 5), "right", "p0", board);
      // rightEnd=5, tile(3,5): bottom=5 matches target, canonicalTile={top:3,bottom:5}
      // Right side non-center: display must swap so connecting value faces left
      const result = place(makeTile(3, 5), "right", "p1", board);
      expect(result.tiles[1].flipped).toBe(true);
    });

    it("leftEnd=3, tile(6,3) on left → flipped=false", () => {
      let board = createBoard();
      board = place(makeTile(3, 3), "left", "p0", board);
      // leftEnd=3, tile(6,3): bottom=3 matches target, canonicalTile={top:6,bottom:3}
      // Left side: connecting value (3) is at bottom → right side of display, facing center
      const result = place(makeTile(6, 3), "left", "p1", board);
      expect(result.tiles[1].flipped).toBe(false);
    });

    it("leftEnd=3, tile(3,6) on left → flipped=false (left side never flips)", () => {
      let board = createBoard();
      board = place(makeTile(3, 3), "left", "p0", board);
      // leftEnd=3, tile(3,6): top=3 matches target → auto-flip, canonicalTile={top:6,bottom:3}
      // Left side: connecting value (3) already at bottom → right side of display
      const result = place(makeTile(3, 6), "left", "p1", board);
      expect(result.tiles[1].flipped).toBe(false);
    });
  });

  // ── slotIndex (task 2.3) ──

  describe("slotIndex field", () => {
    it("center tile has slotIndex=0", () => {
      const board = createBoard();
      const result = place(makeTile(6, 6), "right", "p0", board);
      expect(result.tiles[0].slotIndex).toBe(0);
    });

    it("right tiles get sequential positive indices 1, 2, 3", () => {
      let board = createBoard();
      board = place(makeTile(6, 6), "right", "p0", board);
      board = place(makeTile(6, 1), "right", "p1", board);
      board = place(makeTile(1, 2), "right", "p2", board);
      board = place(makeTile(2, 3), "right", "p3", board);
      expect(board.tiles[1].slotIndex).toBe(1);
      expect(board.tiles[2].slotIndex).toBe(2);
      expect(board.tiles[3].slotIndex).toBe(3);
    });

    it("left tiles get sequential negative indices -1, -2, -3", () => {
      let board = createBoard();
      board = place(makeTile(6, 6), "left", "p0", board);
      board = place(makeTile(6, 1), "left", "p1", board);
      board = place(makeTile(1, 2), "left", "p2", board);
      board = place(makeTile(2, 3), "left", "p3", board);
      expect(board.tiles[1].slotIndex).toBe(-1);
      expect(board.tiles[2].slotIndex).toBe(-2);
      expect(board.tiles[3].slotIndex).toBe(-3);
    });

    it("mixed sides: center=0, left=-1, right=1", () => {
      let board = createBoard();
      board = place(makeTile(6, 6), "left", "p0", board);
      board = place(makeTile(6, 1), "left", "p1", board);
      board = place(makeTile(6, 3), "right", "p2", board);
      expect(board.tiles[0].slotIndex).toBe(0);
      expect(board.tiles[1].slotIndex).toBe(-1);
      expect(board.tiles[2].slotIndex).toBe(1);
    });
  });
});
