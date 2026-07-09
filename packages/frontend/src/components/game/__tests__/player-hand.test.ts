import { describe, expect, it } from "bun:test";
import type { BoardState, Tile } from "@domino/shared";
import { canPlayOnSide, getPlayableSides, isTilePlayable } from "../player-hand";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTile(top: number, bottom: number, id = "t1"): Tile {
  return { top, bottom, id };
}

function emptyBoard(): BoardState {
  return { leftEnd: null, rightEnd: null, tiles: [] };
}

function boardWith(left: number, right: number): BoardState {
  return {
    leftEnd: left,
    rightEnd: right,
    tiles: [
      { tile: makeTile(left, 0, "b1"), side: "left", playerId: "p0" },
      { tile: makeTile(0, right, "b2"), side: "right", playerId: "p1" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("player-hand helpers", () => {
  // ── canPlayOnSide ──

  describe("canPlayOnSide", () => {
    it("allows any tile on an empty board", () => {
      const tile = makeTile(3, 7);
      expect(canPlayOnSide(tile, emptyBoard(), "left")).toBe(true);
      expect(canPlayOnSide(tile, emptyBoard(), "right")).toBe(true);
    });

    it("matches top value against left end", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(5, 3); // top matches leftEnd=5
      expect(canPlayOnSide(tile, board, "left")).toBe(true);
    });

    it("matches bottom value against left end", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(3, 5); // bottom matches leftEnd=5
      expect(canPlayOnSide(tile, board, "left")).toBe(true);
    });

    it("rejects tile with no matching value on left", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(3, 7); // neither 3 nor 7 match 5
      expect(canPlayOnSide(tile, board, "left")).toBe(false);
    });

    it("matches against right end", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(8, 2); // top matches rightEnd=8
      expect(canPlayOnSide(tile, board, "right")).toBe(true);
    });

    it("rejects tile with no matching value on right", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(3, 7); // neither matches 8
      expect(canPlayOnSide(tile, board, "right")).toBe(false);
    });
  });

  // ── getPlayableSides ──

  describe("getPlayableSides", () => {
    it("returns both sides on empty board", () => {
      const tile = makeTile(3, 7);
      expect(getPlayableSides(tile, emptyBoard())).toEqual(["left", "right"]);
    });

    it("returns only left when only left matches", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(5, 3); // only left matches
      expect(getPlayableSides(tile, board)).toEqual(["left"]);
    });

    it("returns only right when only right matches", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(8, 2); // only right matches
      expect(getPlayableSides(tile, board)).toEqual(["right"]);
    });

    it("returns both sides when both ends match", () => {
      const board = boardWith(5, 5);
      const tile = makeTile(5, 5); // double — matches both
      expect(getPlayableSides(tile, board)).toEqual(["left", "right"]);
    });

    it("returns empty array when no side matches", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(3, 7);
      expect(getPlayableSides(tile, board)).toEqual([]);
    });
  });

  // ── isTilePlayable ──

  describe("isTilePlayable", () => {
    it("returns true when tile can play on at least one side", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(5, 3);
      expect(isTilePlayable(tile, board)).toBe(true);
    });

    it("returns false when tile cannot play on any side", () => {
      const board = boardWith(5, 8);
      const tile = makeTile(3, 7);
      expect(isTilePlayable(tile, board)).toBe(false);
    });

    it("returns true on empty board for any tile", () => {
      const tile = makeTile(0, 9);
      expect(isTilePlayable(tile, emptyBoard())).toBe(true);
    });
  });
});
