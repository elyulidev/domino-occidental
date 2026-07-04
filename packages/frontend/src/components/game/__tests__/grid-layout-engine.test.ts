import { describe, expect, it } from "bun:test";
import {
  calculateGridLayout,
  type TilePosition,
  type LayoutResult,
} from "../grid-layout-engine";
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
// Constants matching grid-layout-engine.ts
// ---------------------------------------------------------------------------

const CELL_PX = 24;
const TILE_W = CELL_PX * 4; // 96
const TILE_H = CELL_PX * 2; // 48

// ---------------------------------------------------------------------------
// Tests — GridLayoutEngine
// ---------------------------------------------------------------------------

describe("grid-layout-engine", () => {
  describe("calculateGridLayout", () => {
    // Empty input
    it("returns empty result for empty input", () => {
      const result = calculateGridLayout([], 0, 600);
      expect(result.positions).toEqual([]);
      expect(result.boardWidth).toBe(0);
      expect(result.boardHeight).toBe(0);
    });

    // Single tile: centered at (0, 0)
    it("single tile centered at x=0, y=0", () => {
      const display = [placedTile(6, 6, "left", "t0", 0)];
      const { positions, boardWidth, boardHeight } = calculateGridLayout(
        display,
        0,
        600,
      );
      expect(positions).toHaveLength(1);
      expect(positions[0].x).toBe(0);
      expect(positions[0].y).toBe(0);
      expect(positions[0].isBend).toBe(false);
      // Opening slot is straight → horizontal orientation
      expect(positions[0].orientation).toBe("horizontal");
      // Board dimensions should be positive
      expect(boardWidth).toBeGreaterThan(0);
      expect(boardHeight).toBeGreaterThan(0);
    });

    // Center tile uses horizontal orientation (grid system)
    it("center tile is horizontal (opening slot is straight)", () => {
      const display = [placedTile(6, 6, "left", "t0", 0)];
      const { positions } = calculateGridLayout(display, 0, 600);
      expect(positions[0].orientation).toBe("horizontal");
    });

    // Right arm tiles: first right tile is to the right of center (col 7 > col 6)
    // Subsequent right tiles may share the same x (snake wrapping at col 7)
    it("right arm first tile is to the right of center", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
        placedTile(1, 2, "right", "t2", 2),
      ];
      const { positions } = calculateGridLayout(display, 0, 800);
      expect(positions).toHaveLength(3);
      // First right tile (slotIndex=1 → col=7) is to the right of center (col=6)
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
      // Second right tile (slotIndex=2 → col=7, next row) has same x due to snake wrap
      expect(positions[2].x).toBe(positions[1].x);
      // But second right tile is on the next row (higher y)
      expect(positions[2].y).toBeGreaterThan(positions[1].y);
    });

    // Left arm tiles extend to the left of center (col 6→5→4→3)
    // Display order: outermost first (as buildDisplayOrder produces)
    it("left arm tiles extend leftward from center", () => {
      const display = [
        placedTile(2, 3, "left", "t3", -3), // outermost (col=3)
        placedTile(1, 2, "left", "t2", -2), // middle (col=4)
        placedTile(5, 1, "left", "t1", -1), // innermost (col=5)
        placedTile(6, 6, "left", "t0", 0),  // center (col=6)
      ];
      const { positions } = calculateGridLayout(display, 3, 800);
      expect(positions).toHaveLength(4);
      // Left tiles should be to the left of center tile
      // Outermost (-3, col=3) is leftmost, innermost (-1, col=5) is rightmost among left tiles
      expect(positions[0].x).toBeLessThan(positions[1].x);
      expect(positions[1].x).toBeLessThan(positions[2].x);
      expect(positions[2].x).toBeLessThan(positions[3].x);
    });

    // Orientation mapping: straight → horizontal, corner → vertical
    it("straight slots get horizontal orientation", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
        placedTile(1, 2, "right", "t2", 2),
      ];
      const { positions } = calculateGridLayout(display, 0, 800);
      // Tiles near the opening are on straight slots
      expect(positions[0].orientation).toBe("horizontal");
      expect(positions[0].isBend).toBe(false);
    });

    // Corner tiles get vertical orientation and isBend=true
    it("corner slots get vertical orientation and isBend=true", () => {
      // Place right tiles to reach the grid corner (col=7 on row 6)
      // Opening at col=6, row=6. Right arm: col=7 is the first corner.
      const tiles = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
        placedTile(1, 2, "right", "t2", 2),
        placedTile(2, 3, "right", "t3", 3),
        placedTile(3, 4, "right", "t4", 4),
        placedTile(4, 5, "right", "t5", 5),
        placedTile(5, 6, "right", "t6", 6),
        placedTile(6, 7, "right", "t7", 7),
        placedTile(7, 8, "right", "t8", 8),
      ];
      const { positions } = calculateGridLayout(tiles, 0, 800);
      // Check that at least one tile has isBend=true (corner)
      const bends = positions.filter((p) => p.isBend);
      expect(bends.length).toBeGreaterThanOrEqual(1);
      // All bend tiles should be vertical
      for (const bend of bends) {
        expect(bend.orientation).toBe("vertical");
      }
    });

    // Flipped passthrough: uses stored flipped value
    it("passes through stored flipped value", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0, true),
        placedTile(6, 1, "right", "t1", 1, true),
        placedTile(5, 1, "left", "t2", -1, false),
      ];
      const { positions } = calculateGridLayout(display, 0, 600);
      expect(positions[0].flipped).toBe(true); // center: stored flipped
      expect(positions[1].flipped).toBe(true); // right: stored flipped
      expect(positions[2].flipped).toBe(false); // left: stored flipped
    });

    // No side effects: input not mutated
    it("does not mutate the input array", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
      ];
      const frozen = [...display];
      calculateGridLayout(display, 0, 600);
      expect(display).toEqual(frozen);
    });

    // Grid alignment: all positions are integers
    it("all positions are integer values (no sub-pixel fractions)", () => {
      const tiles = Array.from({ length: 10 }, (_, i) =>
        placedTile(i, (i + 1) % 10, "right", `t${i}`, i),
      );
      const { positions } = calculateGridLayout(tiles, 0, 600);
      for (const pos of positions) {
        expect(pos.x).toBe(Math.round(pos.x));
        expect(pos.y).toBe(Math.round(pos.y));
      }
    });

    // No overlap: tiles in the same row should not overlap
    // (corner tiles in Phase 1 may overlap adjacent-row tiles — skip those)
    it("straight tiles in the same row do not overlap", () => {
      const tiles = Array.from({ length: 8 }, (_, i) =>
        placedTile(i % 10, (i + 1) % 10, "right", `t${i}`, i),
      );
      const { positions } = calculateGridLayout(tiles, 0, 800);
      expect(positions).toHaveLength(8);

      // Filter to only straight (non-corner) tiles — these should never overlap
      const straightPositions = positions.filter((p) => !p.isBend);

      for (let i = 0; i < straightPositions.length; i++) {
        for (let j = i + 1; j < straightPositions.length; j++) {
          const a = straightPositions[i];
          const b = straightPositions[j];
          // Straight tiles are always horizontal in grid system
          const w = TILE_W;
          const h = TILE_H;

          const aLeft = a.x - w / 2;
          const aRight = a.x + w / 2;
          const aTop = a.y - h / 2;
          const aBottom = a.y + h / 2;

          const bLeft = b.x - w / 2;
          const bRight = b.x + w / 2;
          const bTop = b.y - h / 2;
          const bBottom = b.y + h / 2;

          const overlaps =
            aLeft < bRight &&
            aRight > bLeft &&
            aTop < bBottom &&
            aBottom > bTop;

          expect(overlaps).toBe(false);
        }
      }
    });

    // Centering: visual bounding box is symmetric around (0, 0)
    it("10-tile chain centers visual bounding box at origin", () => {
      const tiles = Array.from({ length: 10 }, (_, i) =>
        placedTile(i, (i + 1) % 10, "right", `t${i}`, i),
      );
      const { positions, boardWidth, boardHeight } = calculateGridLayout(
        tiles,
        0,
        600,
      );

      // After centering, visual bounding box should be symmetric:
      // boardWidth = maxX - minX, centered means visualMin = -boardWidth/2
      // Verify bounding box edges
      let visualMinX = Infinity;
      let visualMaxX = -Infinity;
      let visualMinY = Infinity;
      let visualMaxY = -Infinity;

      for (const pos of positions) {
        const isVertical = pos.orientation === "vertical";
        const vw = isVertical ? TILE_H : TILE_W;
        const vh = isVertical ? TILE_W : TILE_H;
        visualMinX = Math.min(visualMinX, pos.x - vw / 2);
        visualMaxX = Math.max(visualMaxX, pos.x + vw / 2);
        visualMinY = Math.min(visualMinY, pos.y - vh / 2);
        visualMaxY = Math.max(visualMaxY, pos.y + vh / 2);
      }

      // Visual bounding box should be centered at (0, 0)
      expect(Math.abs(visualMinX + visualMaxX)).toBeLessThan(1);
      expect(Math.abs(visualMinY + visualMaxY)).toBeLessThan(1);
      // boardWidth/boardHeight should match
      expect(Math.abs(boardWidth - (visualMaxX - visualMinX))).toBeLessThan(1);
      expect(Math.abs(boardHeight - (visualMaxY - visualMinY))).toBeLessThan(1);
    });

    // Mixed sides: left + center + right
    it("mixed left+right tiles positioned correctly", () => {
      const tiles = [
        placedTile(1, 9, "left", "L2", -2),
        placedTile(9, 0, "left", "L1", -1),
        placedTile(0, 0, "left", "C", 0),
        placedTile(0, 1, "right", "R1", 1),
        placedTile(1, 2, "right", "R2", 2),
      ];
      const { positions } = calculateGridLayout(tiles, 2, 400);
      expect(positions).toHaveLength(5);
      // Left tiles should be to the left of center, right to the right
      expect(positions[0].x).toBeLessThan(positions[2].x);
      expect(positions[1].x).toBeLessThan(positions[2].x);
      expect(positions[3].x).toBeGreaterThan(positions[2].x);
      expect(positions[4].x).toBeGreaterThan(positions[2].x);
    });

    // Edge case: 1 tile
    it("handles exactly 1 tile", () => {
      const display = [placedTile(5, 5, "left", "t0", 0)];
      const result = calculateGridLayout(display, 0, 600);
      expect(result.positions).toHaveLength(1);
      expect(result.positions[0].x).toBe(0);
      expect(result.positions[0].y).toBe(0);
      expect(result.boardWidth).toBeGreaterThan(0);
      expect(result.boardHeight).toBeGreaterThan(0);
    });

    // Edge case: 2 tiles (center + 1 right)
    it("handles 2 tiles (center + 1 right)", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
      ];
      const { positions } = calculateGridLayout(display, 0, 600);
      expect(positions).toHaveLength(2);
      // Both should be valid positions
      for (const pos of positions) {
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
      }
    });

    // Edge case: many tiles (40 = full game)
    it("handles 40 tiles (full game scenario)", () => {
      const tiles = Array.from({ length: 40 }, (_, i) => {
        const side = i === 0 ? "left" : i <= 20 ? "right" : "left";
        const slotIndex = i === 0 ? 0 : i <= 20 ? i : -(i - 20);
        return placedTile(
          i % 10,
          (i + 1) % 10,
          side as "left" | "right",
          `t${i}`,
          slotIndex,
        );
      });
      const { positions } = calculateGridLayout(tiles, 0, 400);
      expect(positions).toHaveLength(40);
      // All positions should be finite
      for (const pos of positions) {
        expect(Number.isFinite(pos.x)).toBe(true);
        expect(Number.isFinite(pos.y)).toBe(true);
      }
    });

    // Board dimensions are positive
    it("returns positive board dimensions", () => {
      const tiles = Array.from({ length: 5 }, (_, i) =>
        placedTile(i, (i + 1) % 10, "right", `t${i}`, i),
      );
      const { boardWidth, boardHeight } = calculateGridLayout(tiles, 0, 600);
      expect(boardWidth).toBeGreaterThan(0);
      expect(boardHeight).toBeGreaterThan(0);
    });

    // Container width is accepted but doesn't affect layout
    it("different container widths produce identical layout", () => {
      const tiles = Array.from({ length: 8 }, (_, i) =>
        placedTile(i, (i + 1) % 10, "right", `t${i}`, i),
      );
      const narrow = calculateGridLayout(tiles, 0, 320);
      const wide = calculateGridLayout(tiles, 0, 1200);
      // Grid layout is fixed — container width doesn't affect positions
      for (let i = 0; i < tiles.length; i++) {
        expect(narrow.positions[i].x).toBe(wide.positions[i].x);
        expect(narrow.positions[i].y).toBe(wide.positions[i].y);
        expect(narrow.positions[i].orientation).toBe(
          wide.positions[i].orientation,
        );
      }
    });

    // Y-ordering: right arm wraps to next row (y increases)
    it("right arm wraps to next row after reaching grid edge", () => {
      const tiles = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1), // col=7, row=6 (corner)
        placedTile(1, 2, "right", "t2", 2), // col=7, row=7
        placedTile(2, 3, "right", "t3", 3), // col=6, row=7
      ];
      const { positions } = calculateGridLayout(tiles, 0, 800);
      // Tile 1 (corner) should be at higher y than tile 0 (same row)
      // Tile 2 should be at higher y than tile 1 (next row)
      expect(positions[2].y).toBeGreaterThan(positions[0].y);
    });
  });
});
