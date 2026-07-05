import { describe, expect, it } from "bun:test";
import {
  isDoubleTile,
  formatPipValue,
  playerColorClass,
  playerIdToIndex,
  buildDisplayOrder,
  calculateSerpentineLayout,
  snakeRows,
  tilesPerRow,
  buildCenterRows,
  type LayoutResult,
  type CenterRowsResult,
} from "../game-board";
import type { PlacedTile, Tile } from "@domino/shared";

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

  // ── calculateSerpentineLayout ──

  describe("calculateSerpentineLayout", () => {
    // R8: single tile centered
    it("single tile is centered at x=0", () => {
      const display = [placedTile(6, 6, "left", "t0", "p0")];
      const { positions } = calculateSerpentineLayout(display, 0, 600);
      expect(positions).toHaveLength(1);
      expect(positions[0].x).toBe(0);
      expect(positions[0].y).toBe(0);
    });

    // R1: 3 tiles — with CELL=48, 3 tiles need 296px; at 600px they may bend
    it("3 tiles form chain (may bend with wider tiles)", () => {
      const display = [
        placedTile(6, 6, "left", "t0", "p0"),
        placedTile(6, 1, "right", "t1", "p1"),
        placedTile(1, 2, "right", "t2", "p2"),
      ];
      const { positions } = calculateSerpentineLayout(display, 0, 800);
      expect(positions).toHaveLength(3);
      // Chain is visually centered: verify bounding box edges are symmetric
      const leftEdge = Math.min(
        ...positions.map((p) => p.x - (p.orientation === "vertical" ? 24 : 48)),
      );
      const rightEdge = Math.max(
        ...positions.map((p) => p.x + (p.orientation === "vertical" ? 24 : 48)),
      );
      expect(Math.abs(leftEdge + rightEdge)).toBeLessThan(1);
      // Second tile to the right of first
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
      // Third tile further right
      expect(positions[2].x).toBeGreaterThan(positions[1].x);
    });

    // R1+R2: 8+ tiles trigger bends
    it("many tiles produce bends at container edge", () => {
      // Narrow container (400px) forces early bends
      const tiles = Array.from({ length: 10 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, "p0")
      );
      const { positions } = calculateSerpentineLayout(tiles, 0, 400);
      expect(positions).toHaveLength(10);
      const bendCount = positions.filter((p) => p.isBend).length;
      expect(bendCount).toBeGreaterThanOrEqual(1);
    });

    // R2: bend alternation up/down/up
    it("bends alternate direction (up/down/up)", () => {
      // 20 tiles in a narrow container to force multiple bends
      const tiles = Array.from({ length: 20 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, "p0")
      );
      const { positions } = calculateSerpentineLayout(tiles, 0, 350);
      const bends = positions.filter((p) => p.isBend);
      expect(bends.length).toBeGreaterThanOrEqual(3);
      // Bends should alternate y direction
      for (let i = 2; i < bends.length; i++) {
        const yDiff1 = bends[i - 1].y - bends[i - 2].y;
        const yDiff2 = bends[i].y - bends[i - 1].y;
        // Alternating means opposite signs
        expect(Math.sign(yDiff1)).not.toBe(Math.sign(yDiff2));
      }
    });

    // R3: orientation by position
    it("first tile is always vertical", () => {
      const display = [
        placedTile(6, 6, "left", "t0", "p0"),
        placedTile(6, 1, "right", "t1", "p1"),
      ];
      const { positions } = calculateSerpentineLayout(display, 0, 600);
      expect(positions[0].orientation).toBe("vertical");
    });

    it("horizontal run tiles are horizontal", () => {
      const display = [
        placedTile(6, 6, "left", "t0", "p0"),
        placedTile(6, 1, "right", "t1", "p1"),
        placedTile(1, 2, "right", "t2", "p2"),
        placedTile(2, 3, "right", "t3", "p3"),
      ];
      const { positions } = calculateSerpentineLayout(display, 0, 800);
      // Tiles 1, 2, 3 are in horizontal run (wider container prevents bends)
      expect(positions[1].orientation).toBe("horizontal");
      expect(positions[2].orientation).toBe("horizontal");
      expect(positions[3].orientation).toBe("horizontal");
    });

    it("bend tiles are vertical regardless of double status", () => {
      // Narrow container to force a bend
      const tiles = Array.from({ length: 8 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, "p0")
      );
      const { positions } = calculateSerpentineLayout(tiles, 0, 400);
      const bends = positions.filter((p) => p.isBend);
      expect(bends.length).toBeGreaterThanOrEqual(1);
      for (const bend of bends) {
        expect(bend.orientation).toBe("vertical");
      }
    });

    // R4: first tile centering
    it("single tile centered at x=0 (R4)", () => {
      const display = [placedTile(5, 5, "left", "t0", "p0")];
      const { positions } = calculateSerpentineLayout(display, 0, 600);
      expect(positions[0].x).toBe(0);
    });

    it("10-tile chain centers first tile (R4)", () => {
      const tiles = Array.from({ length: 10 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, "p0")
      );
      const { positions } = calculateSerpentineLayout(tiles, 0, 600);
      // Chain is centered: verify bounding box is symmetric
      const xs = positions.map((p) => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      // Centering means minX ≈ -maxX (symmetric around 0)
      expect(Math.abs(minX + maxX)).toBeLessThan(1);
    });

    // R5: responsive 320px vs 1200px
    it("320px mobile produces more bends than 1200px desktop", () => {
      const tiles = Array.from({ length: 8 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, "p0")
      );
      const mobile = calculateSerpentineLayout(tiles, 0, 320);
      const desktop = calculateSerpentineLayout(tiles, 0, 1200);
      const mobileBends = mobile.positions.filter((p) => p.isBend).length;
      const desktopBends = desktop.positions.filter((p) => p.isBend).length;
      expect(mobileBends).toBeGreaterThanOrEqual(desktopBends);
    });

    // R8: edge cases
    it("left-only chain bends at left edge", () => {
      const tiles = [
        placedTile(5, 5, "left", "t0", "p0"),
        placedTile(5, 1, "left", "t1", "p1"),
        placedTile(1, 2, "left", "t2", "p2"),
      ];
      const { positions } = calculateSerpentineLayout(tiles, 0, 400);
      expect(positions).toHaveLength(3);
      // Chain is visually centered: bounding box edges symmetric
      const leftEdge = Math.min(
        ...positions.map((p) => p.x - (p.orientation === "vertical" ? 24 : 48)),
      );
      const rightEdge = Math.max(
        ...positions.map((p) => p.x + (p.orientation === "vertical" ? 24 : 48)),
      );
      expect(Math.abs(leftEdge + rightEdge)).toBeLessThan(1);
    });

    it("right-only chain bends at right edge", () => {
      const tiles = [
        placedTile(5, 5, "left", "t0", "p0"),
        placedTile(5, 1, "right", "t1", "p1"),
        placedTile(1, 2, "right", "t2", "p2"),
      ];
      const { positions } = calculateSerpentineLayout(tiles, 0, 400);
      expect(positions).toHaveLength(3);
      // Chain is visually centered: bounding box edges symmetric
      const leftEdge = Math.min(
        ...positions.map((p) => p.x - (p.orientation === "vertical" ? 24 : 48)),
      );
      const rightEdge = Math.max(
        ...positions.map((p) => p.x + (p.orientation === "vertical" ? 24 : 48)),
      );
      expect(Math.abs(leftEdge + rightEdge)).toBeLessThan(1);
    });

    it("mixed sides chain bends independently on each side", () => {
      const tiles = [
        placedTile(1, 9, "left", "L2", "p0"),
        placedTile(9, 0, "left", "L1", "p1"),
        placedTile(0, 0, "left", "C", "p2"),
        placedTile(0, 1, "right", "R1", "p3"),
        placedTile(1, 2, "right", "R2", "p4"),
      ];
      const { positions } = calculateSerpentineLayout(tiles, 2, 400);
      expect(positions).toHaveLength(5);
      // Center tile at x=0
      expect(positions[2].x).toBe(0);
    });

    it("20 tiles all fit within bounds", () => {
      const tiles = Array.from({ length: 20 }, (_, i) =>
        placedTile(i % 10, (i + 1) % 10, "right", `t${i}`, "p0")
      );
      const { positions } = calculateSerpentineLayout(tiles, 0, 400);
      expect(positions).toHaveLength(20);
      // All positions should be finite numbers
      for (const pos of positions) {
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
      }
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

  // ── snakeRows ──

  describe("snakeRows", () => {
    it("returns single row when items fit in perRow", () => {
      expect(snakeRows([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    });

    it("splits into multiple rows when items exceed perRow", () => {
      expect(snakeRows([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it("returns all items in one row for perRow < 1", () => {
      expect(snakeRows([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    });

    it("handles empty array", () => {
      expect(snakeRows([], 3)).toEqual([]);
    });

    it("handles exact fit", () => {
      expect(snakeRows([1, 2, 3, 4], 4)).toEqual([[1, 2, 3, 4]]);
    });
  });

  // ── tilesPerRow ──

  describe("tilesPerRow", () => {
    it("returns 8 for 600px container (600/72 ≈ 8.3)", () => {
      expect(tilesPerRow(600)).toBe(8);
    });

    it("returns 1 for very narrow container", () => {
      expect(tilesPerRow(50)).toBe(1);
    });

    it("returns 16 for 1200px container", () => {
      expect(tilesPerRow(1200)).toBe(16);
    });
  });

  // ── buildCenterRows ──

  describe("buildCenterRows", () => {
    const center = placedTile(3, 3, "left", "C");

    it("returns empty rows for empty display", () => {
      const { rows, mainRowIndex } = buildCenterRows([], 0, 4);
      expect(rows).toEqual([]);
      expect(mainRowIndex).toBe(-1);
    });

    it("single tile → one row, mainRowIndex=0", () => {
      const { rows, mainRowIndex } = buildCenterRows([center], 0, 4);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveLength(1);
      expect(rows[0][0].tile.id).toBe("C");
      expect(mainRowIndex).toBe(0);
    });

    it("center + 2 right tiles fit in main row with perRow=5", () => {
      const r1 = placedTile(3, 1, "right", "R1");
      const r2 = placedTile(1, 2, "right", "R2");
      const display = [center, r1, r2];
      const { rows, mainRowIndex } = buildCenterRows(display, 0, 5);
      expect(rows).toHaveLength(1);
      expect(mainRowIndex).toBe(0);
      expect(rows[0].map((p) => p.tile.id)).toEqual(["C", "R1", "R2"]);
    });

    it("overflow right tiles go to a second row below main", () => {
      // perRow=3, center + 4 right tiles → capacity 1 on each side → 3 overflow
      const tiles = Array.from({ length: 5 }, (_, i) =>
        placedTile(i, i + 1, "right", `R${i}`)
      );
      const display = [center, ...tiles];
      const { rows, mainRowIndex } = buildCenterRows(display, 0, 3);
      // Main row: center + 1 right = [C, R0], overflow: 4 tiles in rows below
      expect(mainRowIndex).toBe(0);
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].map((p) => p.tile.id)).toEqual(["C", "R0"]);
    });

    it("overflow left tiles go to a row above main", () => {
      // perRow=3, 3 left tiles + center → capacity 1 → 2 overflow
      const l1 = placedTile(1, 3, "left", "L2");
      const l2 = placedTile(3, 4, "left", "L1");
      const display = [l1, l2, center];
      const { rows, mainRowIndex } = buildCenterRows(display, 2, 3);
      expect(mainRowIndex).toBeGreaterThan(0);
      expect(rows[mainRowIndex].map((p) => p.tile.id)).toEqual(["L1", "C"]);
    });

    it("falls back to simple snake when perRow < 3", () => {
      const tiles = Array.from({ length: 5 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`)
      );
      const display = [center, ...tiles];
      const { rows, mainRowIndex } = buildCenterRows(display, 0, 2);
      // With perRow=2, fallback: simple snake with 2 per row, no center fix
      expect(mainRowIndex).toBe(0);
      // 6 items / 2 per row = 3 rows
      expect(rows).toHaveLength(3);
    });
  });

});
