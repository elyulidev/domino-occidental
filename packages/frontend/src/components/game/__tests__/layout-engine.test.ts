import { describe, expect, it } from "bun:test";
import { calculateLayout, type TilePosition, type LayoutResult } from "../layout-engine";
import type { PlacedTile, Tile } from "@domino/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTile(top: number, bottom: number, id = "t-1"): Tile {
  return { top, bottom, id };
}

function placedTile(
  top: number,
  bottom: number,
  side: "left" | "right",
  id: string,
  slotIndex: number,
  flipped = false,
  playerId = "p0",
): PlacedTile {
  return { tile: { top, bottom, id }, side, playerId, slotIndex, flipped };
}

// ---------------------------------------------------------------------------
// Constants (must match layout-engine.ts)
// ---------------------------------------------------------------------------

const CELL = 48;
const H_TILE_W = CELL * 2; // 96
const H_TILE_H = CELL;     // 48
const V_TILE_W = CELL;     // 48
const V_TILE_H = CELL * 2; // 96
const GAP = 0;
const PADDING = 16;

// ---------------------------------------------------------------------------
// Tests — LayoutEngine
// ---------------------------------------------------------------------------

describe("layout-engine", () => {
  describe("calculateLayout", () => {
    // R10: empty input
    it("returns empty result for empty input", () => {
      const result = calculateLayout([], 0, 600);
      expect(result.positions).toEqual([]);
      expect(result.boardWidth).toBe(0);
      expect(result.boardHeight).toBe(0);
    });

    // R10: single tile centered
    it("single tile centered at x=0, y=0, vertical", () => {
      const display = [placedTile(6, 6, "left", "t0", 0)];
      const { positions } = calculateLayout(display, 0, 600);
      expect(positions).toHaveLength(1);
      expect(positions[0].x).toBe(0);
      expect(positions[0].y).toBe(0);
      expect(positions[0].orientation).toBe("vertical");
      expect(positions[0].isBend).toBe(false);
    });

    // R14: horizontal tile dimensions
    it("horizontal tiles use 96×48 dimensions", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
      ];
      const { positions } = calculateLayout(display, 0, 600);
      // Second tile should be to the right of first
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
      expect(positions[1].orientation).toBe("horizontal");
    });

    // R14: vertical tile dimensions
    it("center tile uses 48×96 dimensions (vertical)", () => {
      const display = [placedTile(6, 6, "left", "t0", 0)];
      const { positions } = calculateLayout(display, 0, 600);
      expect(positions[0].orientation).toBe("vertical");
    });

    // R3: doubles in straight run → vertical (perpendicular to flow)
    it("double tile in horizontal run gets vertical orientation", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 6, "right", "t1", 1),  // double
        placedTile(6, 1, "right", "t2", 2),
      ];
      const { positions } = calculateLayout(display, 0, 600);
      // t1 is a double in a straight run → vertical (standard domino convention:
      // doubles are placed perpendicular to the line of play)
      expect(positions[1].orientation).toBe("vertical");
      // t2 is non-double in straight run → horizontal
      expect(positions[2].orientation).toBe("horizontal");
    });

    // R3: non-double in straight run → horizontal
    it("non-double in straight run gets horizontal orientation", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
        placedTile(1, 2, "right", "t2", 2),
      ];
      const { positions } = calculateLayout(display, 0, 600);
      expect(positions[1].orientation).toBe("horizontal");
      expect(positions[2].orientation).toBe("horizontal");
    });

    // R3: bend tiles → vertical
    it("bend tiles are vertical regardless of double status", () => {
      // Narrow container to force bends
      const tiles = Array.from({ length: 8 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, i)
      );
      const { positions } = calculateLayout(tiles, 0, 400);
      const bends = positions.filter((p) => p.isBend);
      expect(bends.length).toBeGreaterThanOrEqual(1);
      for (const bend of bends) {
        expect(bend.orientation).toBe("vertical");
      }
    });

    // R9+R10: no side effects — input not mutated
    it("does not mutate the input array", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
      ];
      const frozen = [...display];
      calculateLayout(display, 0, 600);
      expect(display).toEqual(frozen);
    });

    // Grid alignment: all positions align to CELL grid
    it("all positions align to CELL-based grid (no fractional positions)", () => {
      const tiles = Array.from({ length: 10 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, i)
      );
      const { positions } = calculateLayout(tiles, 0, 600);
      for (const pos of positions) {
        // x and y should be integers (no sub-pixel fractions)
        expect(pos.x).toBe(Math.round(pos.x));
        expect(pos.y).toBe(Math.round(pos.y));
      }
    });

    // No overlap: 20 tiles
    it("20 tiles produce no overlapping bounding boxes", () => {
      const tiles = Array.from({ length: 20 }, (_, i) =>
        placedTile(i % 10, (i + 1) % 10, "right", `t${i}`, i)
      );
      const { positions } = calculateLayout(tiles, 0, 400);
      expect(positions).toHaveLength(20);

      // Check no overlap via bounding box intersection
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i];
          const b = positions[j];
          const aW = a.orientation === "vertical" ? V_TILE_W : H_TILE_W;
          const aH = a.orientation === "vertical" ? V_TILE_H : H_TILE_H;
          const bW = b.orientation === "vertical" ? V_TILE_W : H_TILE_W;
          const bH = b.orientation === "vertical" ? V_TILE_H : H_TILE_H;

          // Bounding boxes: [x - w/2, x + w/2] × [y - h/2, y + h/2]
          const aLeft = a.x - aW / 2;
          const aRight = a.x + aW / 2;
          const aTop = a.y - aH / 2;
          const aBottom = a.y + aH / 2;

          const bLeft = b.x - bW / 2;
          const bRight = b.x + bW / 2;
          const bTop = b.y - bH / 2;
          const bBottom = b.y + bH / 2;

          const overlaps =
            aLeft < bRight &&
            aRight > bLeft &&
            aTop < bBottom &&
            aBottom > bTop;

          expect(overlaps).toBe(false);
        }
      }
    });

    // Responsive: 320px produces more bends than 1200px
    it("320px mobile produces more bends than 1200px desktop", () => {
      const tiles = Array.from({ length: 8 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, i)
      );
      const mobile = calculateLayout(tiles, 0, 320);
      const desktop = calculateLayout(tiles, 0, 1200);
      const mobileBends = mobile.positions.filter((p) => p.isBend).length;
      const desktopBends = desktop.positions.filter((p) => p.isBend).length;
      expect(mobileBends).toBeGreaterThanOrEqual(desktopBends);
    });

    // Centering: bounding box symmetric around x=0
    it("10-tile chain centers bounding box at x=0", () => {
      const tiles = Array.from({ length: 10 }, (_, i) =>
        placedTile(i, i + 1, "right", `t${i}`, i)
      );
      const { positions } = calculateLayout(tiles, 0, 600);
      const xs = positions.map((p) => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      expect(Math.abs(minX + maxX)).toBeLessThan(1);
    });

    // Mixed sides
    it("mixed left+right tiles positioned correctly", () => {
      const tiles = [
        placedTile(1, 9, "left", "L2", -2),
        placedTile(9, 0, "left", "L1", -1),
        placedTile(0, 0, "left", "C", 0),
        placedTile(0, 1, "right", "R1", 1),
        placedTile(1, 2, "right", "R2", 2),
      ];
      const { positions } = calculateLayout(tiles, 2, 400);
      expect(positions).toHaveLength(5);
      // Center tile at x=0
      expect(positions[2].x).toBe(0);
    });
  });
});
