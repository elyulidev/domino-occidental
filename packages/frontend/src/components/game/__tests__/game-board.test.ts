import { describe, expect, it } from "bun:test";
import type { PlacedTile, Tile } from "@domino/shared";
import {
  buildDisplayOrder,
  formatPipValue,
  isDoubleTile,
  playerColorClass,
  playerIdToIndex,
} from "../game-board";

// ---------------------------------------------------------------------------
// Helper to build a tile quickly
// ---------------------------------------------------------------------------

function makeTile(top: number, bottom: number, id = "tile-1"): Tile {
  return { top, bottom, id };
}

function placedTile(
  top: number,
  bottom: number,
  side: "left" | "right",
  id: string,
  playerId = "p0",
  slotIndex = 0,
  flipped = false,
): PlacedTile {
  return { tile: { top, bottom, id }, side, playerId, slotIndex, flipped };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("game-board helpers", () => {
  // ── isDoubleTile ──

  describe("isDoubleTile", () => {
    it("returns true when top equals bottom", () => {
      expect(isDoubleTile(makeTile(5, 5))).toBe(true);
    });

    it("returns false when top differs from bottom", () => {
      expect(isDoubleTile(makeTile(3, 7))).toBe(false);
    });

    it("returns true for double-zero", () => {
      expect(isDoubleTile(makeTile(0, 0))).toBe(true);
    });
  });

  // ── formatPipValue ──

  describe("formatPipValue", () => {
    it("returns empty string for zero", () => {
      expect(formatPipValue(0)).toBe("");
    });

    it("returns the number as string for non-zero values", () => {
      expect(formatPipValue(5)).toBe("5");
    });

    it("handles single-digit maximum (9 for double-9 set)", () => {
      expect(formatPipValue(9)).toBe("9");
    });
  });

  // ── playerColorClass ──

  describe("playerColorClass", () => {
    it("returns blue for player 0", () => {
      expect(playerColorClass(0)).toBe("bg-blue-500");
    });

    it("returns red for player 1", () => {
      expect(playerColorClass(1)).toBe("bg-red-500");
    });

    it("returns emerald for player 2", () => {
      expect(playerColorClass(2)).toBe("bg-emerald-500");
    });

    it("returns amber for player 3", () => {
      expect(playerColorClass(3)).toBe("bg-amber-500");
    });

    it("returns fallback for unknown index", () => {
      expect(playerColorClass(99)).toBe("bg-domino-500");
    });
  });

  // ── playerIdToIndex ──

  describe("playerIdToIndex", () => {
    it("extracts trailing digits from player id", () => {
      expect(playerIdToIndex("p0")).toBe(0);
      expect(playerIdToIndex("p1")).toBe(1);
      expect(playerIdToIndex("p2")).toBe(2);
      expect(playerIdToIndex("p3")).toBe(3);
    });

    it("returns 0 for ids without digits", () => {
      expect(playerIdToIndex("unknown")).toBe(0);
    });
  });

  // ── buildDisplayOrder ──

  describe("buildDisplayOrder", () => {
    it("returns empty for no tiles", () => {
      const { display, centerIdx } = buildDisplayOrder([]);
      expect(display).toEqual([]);
      expect(centerIdx).toBe(-1);
    });

    it("single tile → display has it at index 0", () => {
      const tiles = [placedTile(6, 6, "left", "t0")];
      const { display, centerIdx } = buildDisplayOrder(tiles);
      expect(display).toHaveLength(1);
      expect(display[0].tile.id).toBe("t0");
      expect(centerIdx).toBe(0);
    });

    it("left tiles go before center in reverse order", () => {
      const first = placedTile(5, 5, "left", "t0");
      const tiles = [
        first,
        placedTile(5, 1, "left", "t1"),
        placedTile(1, 3, "left", "t2"),
      ];
      const { display, centerIdx } = buildDisplayOrder(tiles);
      expect(centerIdx).toBe(2);
      expect(display.map((t) => t.tile.id)).toEqual(["t2", "t1", "t0"]);
    });

    it("right tiles go after center in play order", () => {
      const tiles = [
        placedTile(5, 5, "left", "t0"),
        placedTile(5, 1, "right", "t1"),
        placedTile(1, 3, "right", "t2"),
      ];
      const { display, centerIdx } = buildDisplayOrder(tiles);
      expect(centerIdx).toBe(0);
      expect(display.map((t) => t.tile.id)).toEqual(["t0", "t1", "t2"]);
    });

    it("left + center + right all positioned correctly", () => {
      const tiles = [
        placedTile(6, 6, "left", "t0"),
        placedTile(6, 1, "left", "t1"),
        placedTile(1, 2, "left", "t2"),
        placedTile(6, 3, "right", "t3"),
        placedTile(3, 4, "right", "t4"),
      ];
      const { display, centerIdx } = buildDisplayOrder(tiles);
      expect(centerIdx).toBe(2);
      expect(display.map((t) => t.tile.id)).toEqual(["t2", "t1", "t0", "t3", "t4"]);
    });
  });

});
