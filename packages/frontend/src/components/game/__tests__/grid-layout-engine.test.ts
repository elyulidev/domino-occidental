import { describe, expect, it } from "bun:test";
import type { PlacedTile, Tile } from "@domino/shared";
import { computeGridLayout } from "@domino/shared/src/game/grid-layout";
import {
  calculateGridLayout,
} from "../grid-layout-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _makeTile(top: number, bottom: number, id = "t-1"): Tile {
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
      const { positions } = calculateGridLayout(
        display,
        0,
        600,
      );
      expect(positions).toHaveLength(1);
      expect(positions[0].x).toBe(0);
      expect(positions[0].y).toBe(0);
      expect(positions[0].isBend).toBe(false);
      // Opening double sits vertical with floats
      expect(positions[0].orientation).toBe("vertical");
    });

    // Right arm: tiles extend rightward in same row (16-column grid)
    it("right arm tiles extend rightward in same row", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
        placedTile(1, 2, "right", "t2", 2),
      ];
      const { positions } = calculateGridLayout(display, 0, 800);
      expect(positions).toHaveLength(3);
      // All tiles on same row (16×N grid doesn't wrap at container edge)
      expect(positions[0].y).toBe(positions[1].y);
      expect(positions[1].y).toBe(positions[2].y);
      // Tiles extend rightward: center < tile1 < tile2
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
      expect(positions[2].x).toBeGreaterThan(positions[1].x);
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

    // Opening double is vertical (standard double with floats)
    it("straight slots get horizontal orientation", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),
        placedTile(1, 2, "right", "t2", 2),
      ];
      const { positions } = calculateGridLayout(display, 0, 800);
      // Opening double is vertical (standard double with floats);
      // subsequent straight tiles are horizontal
      expect(positions[0].orientation).toBe("vertical");
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

    // Flipped: computed from geometry, not from stored placed.flipped
    it("computes flipped from geometry", () => {
      const display = [
        placedTile(6, 6, "left", "t0", 0, true),  // center double — vertical, same col
        placedTile(6, 1, "right", "t1", 1, true),  // right — cells[0].col < cells[1].col
        placedTile(5, 1, "left", "t2", -1, false), // left  — cells[0].col > cells[1].col
      ];
      const { positions } = calculateGridLayout(display, 0, 600);
      // Double at center: vertical, both cells at same col → no swap
      expect(positions[0].flipped).toBe(false);
      // Right side: conn at LEFT cell, DominoTile LEFT=top needs conn → swap
      expect(positions[1].flipped).toBe(true);
      // Left side: conn at RIGHT cell, DominoTile LEFT=top=free ✓ → no swap
      expect(positions[2].flipped).toBe(false);
    });

    // Center non-double horizontal — side="right":
    //   leftEnd=tile.top, rightEnd=tile.bottom
    //   cells = [{col:7, val:tile.top=4}, {col:8, val:tile.bottom=9}]
    //   tile.bottom (conn) is in RIGHT cell → connCell.col > freeCell.col → no swap
    it("does NOT flip center non-double tile when side=right", () => {
      const display = [
        placedTile(4, 9, "right", "center", 0, false), // center [9|4] side=right
      ];
      const { positions } = calculateGridLayout(display, 0, 600);
      expect(positions[0].flipped).toBe(false);
    });

    // Center non-double horizontal — side="left":
    //   leftEnd=tile.bottom, rightEnd=tile.top
    //   cells = [{col:7, val:tile.bottom=2}, {col:8, val:tile.top=7}]
    //   tile.bottom (conn) is in LEFT cell → connCell.col < freeCell.col → swap
    it("flips center non-double tile when side=left", () => {
      const display = [
        placedTile(7, 2, "left", "center", 0, false), // center [7|2] side=left
      ];
      const { positions } = calculateGridLayout(display, 0, 600);
      expect(positions[0].flipped).toBe(true);
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

    // Y-ordering: right arm wraps to next row after filling grid width
    // 16-column grid wraps at col 15 → L-corner turns create new row
    it("right arm wraps to next row after reaching grid edge", () => {
      // 8 right-side tiles fill from C7→C15 and wrap (4 tiles × 2 cells = 8 cols)
      const tiles = [
        placedTile(6, 6, "left", "t0", 0),
        placedTile(6, 1, "right", "t1", 1),  // C8,C9
        placedTile(1, 2, "right", "t2", 2),  // C10,C11
        placedTile(2, 3, "right", "t3", 3),  // C12,C13
        placedTile(3, 4, "right", "t4", 4),  // C14,C15 — reaches grid edge
        placedTile(4, 5, "right", "t5", 5),  // L-corner at C15, new row
        placedTile(5, 6, "right", "t6", 6),  // new row, same column
        placedTile(6, 7, "right", "t7", 7),  // new row, continues
      ];
      const { positions } = calculateGridLayout(tiles, 0, 800);
      expect(positions).toHaveLength(8);
      // Tile 3 (last in first row, slotIndex=4) reaches C15 → same row as center
      expect(positions[4].y).toBe(positions[0].y);
      // Tile 4 (slotIndex=5) wraps to next row → different y
      expect(positions[5].y).not.toBe(positions[0].y);
    });

    // ── Problem 2: Double at space=1 (left edge), next tile horizontal ──
    it("places next tile HORIZONTAL after double mixed turn (space=1)", () => {
      // Opening [7|2] left → left tiles reach C0 at space=1 → double [8|8]
      // → next tile [8|5] should be HORIZONTAL in the new row above.
      // Play order (what computeGridLayout receives):
      //   center, L1, L2, L3, double, L5
      const grid = computeGridLayout([
        placedTile(7, 2, "left", "center", 0, false), // F0:C7-C8
        placedTile(2, 1, "left", "L1", -1, false),    // F0:C6-C5
        placedTile(1, 9, "left", "L2", -2, false),    // F0:C4-C3
        placedTile(9, 8, "left", "L3", -3, false),    // F0:C2-C1 → space=1 at C1
        placedTile(8, 8, "left", "double", -4, false), // DOUBLE at C0 (space=1)
        placedTile(8, 5, "left", "L5", -5, false),    // After double → should be horizontal!
      ]);
      expect(grid.tiles).toHaveLength(6);

      // Tiles 0-3: horizontal in F0
      for (let i = 0; i < 4; i++) {
        expect(grid.tiles[i].orientation).toBe("horizontal");
      }

      // Tile 4 (double): vertical at C0 (mixed turn)
      expect(grid.tiles[4].orientation).toBe("vertical");
      expect(grid.tiles[4].cells[0].col).toBe(0);
      expect(grid.tiles[4].cells[0].row).toBe(0);
      expect(grid.tiles[4].cells[1].col).toBe(0);
      // dropRow: going UP (default for left side) → row 0 + 1 = row 1

      // Tile 5 (after double): MUST be horizontal in the new row
      // If bug is present, this would be vertical (giroExtreme) overlapping the double
      expect(grid.tiles[5].orientation).toBe("horizontal");

      // No overlapping cells between double and next tile
      const doubleCells = new Set(grid.tiles[4].cells.map(c => `${c.row}:${c.col}`));
      const nextCells = new Set(grid.tiles[5].cells.map(c => `${c.row}:${c.col}`));
      for (const cell of nextCells) {
        expect(doubleCells.has(cell)).toBe(false);
      }
    });

    // ── Problem 2 mirrored: Double at space=1 (right edge), going down ──
    // Center [7|2] non-double takes C7-C8. Right tiles go east from C9.
    // 3 right tiles: C9-C10, C11-C12, C13-C14 → head at C14, space=1 → double
    it("places next tile HORIZONTAL after double mixed turn (space=1) on right edge", () => {
      const grid = computeGridLayout([
        placedTile(7, 2, "left", "center", 0, false),  // F0:C7-C8 non-double
        placedTile(2, 1, "right", "R1", 1, false),     // F0:C9-C10
        placedTile(1, 9, "right", "R2", 2, false),     // F0:C11-C12
        placedTile(9, 8, "right", "R3", 3, false),     // F0:C13-C14 → head at C14, space=1!
        placedTile(8, 8, "right", "double", 4, true),  // DOUBLE at C15 (space=1 mixed turn)
        placedTile(8, 5, "right", "R5", 5, false),     // After double → should be horizontal!
      ]);
      expect(grid.tiles).toHaveLength(6);

      // Center: horizontal
      expect(grid.tiles[0].orientation).toBe("horizontal");
      // Tiles 1-3: horizontal in F0
      for (let i = 1; i < 4; i++) {
        expect(grid.tiles[i].orientation).toBe("horizontal");
      }

      // Tile 4 (double at space=1): vertical at C15
      expect(grid.tiles[4].orientation).toBe("vertical");
      expect(grid.tiles[4].isDouble).toBe(true);
      // Right edge default vertDir = "down" → dropRow = -1
      expect(grid.tiles[4].cells[1].row).toBe(-1); // dropRow

      // Tile 5 (after double): MUST be horizontal in the new row
      expect(grid.tiles[5].orientation).toBe("horizontal");

      // No overlap with the double
      const doubleCells = new Set(grid.tiles[4].cells.map(c => `${c.row}:${c.col}`));
      const nextCells = new Set(grid.tiles[5].cells.map(c => `${c.row}:${c.col}`));
      for (const cell of nextCells) {
        expect(doubleCells.has(cell)).toBe(false);
      }
    });

    // ── Pure L-corner (space=0) going DOWN —─
    it("pure L-corner going down produces correct head and no overlap", () => {
      // Opening double → right tiles reach C15 at space=0 → L-corner
      // After L-corner: conn at F-1, free at F-2. Head at F-3 (one more row).
      const grid = computeGridLayout([
        placedTile(6, 6, "left", "center", 0, true),   // F0:C7 double (vertical)
        placedTile(6, 1, "right", "R1", 1, false),     // F0:C8-C9
        placedTile(1, 2, "right", "R2", 2, false),     // F0:C10-C11
        placedTile(2, 3, "right", "R3", 3, false),     // F0:C12-C13
        placedTile(3, 4, "right", "R4", 4, false),     // F0:C14-C15 → head at C15, space=0
        placedTile(4, 5, "right", "R5", 5, false),     // Pure L-corner: 2 rows down ↓
      ]);
      expect(grid.tiles).toHaveLength(6);

      // T0: center double is vertical with floats
      expect(grid.tiles[0].orientation).toBe("vertical");
      expect(grid.tiles[0].isDouble).toBe(true);
      // T1-T4: right-arm horizontals before the edge
      for (let i = 1; i < 5; i++) {
        expect(grid.tiles[i].orientation).toBe("horizontal");
      }

      // Tile 5 (L-corner): vertical
      expect(grid.tiles[5].orientation).toBe("vertical");
      expect(grid.tiles[5].isDouble).toBe(false);
      // cells[0] = conn at F-1 C15; cells[1] = free at F-2 C15
      expect(grid.tiles[5].cells[0].row).toBe(-1);
      expect(grid.tiles[5].cells[0].col).toBe(15);
      expect(grid.tiles[5].cells[1].row).toBe(-2);
      expect(grid.tiles[5].cells[1].col).toBe(15);

      // RightHead one MORE row beyond freeValue: row -3, same col, west
      expect(grid.rightHead).not.toBeNull();
      expect(grid.rightHead?.row).toBe(-3);
      expect(grid.rightHead?.col).toBe(15);
      expect(grid.rightHead?.dir).toBe("west");
    });

    // ── Mixed turn (space=1) → next tile HORIZONTAL in new row ──
    it("mixed turn (space=1) is followed by horizontal tile in new row", () => {
      // Center [7|2] non-double at C7-C8. Right arm from C9.
      // 3 right tiles reach C13-C14 → head at C14, space=1 → mixed turn
      const grid = computeGridLayout([
        placedTile(7, 2, "left", "center", 0, false),     // F0:C7-C8 non-double
        placedTile(2, 1, "right", "R1", 1, false),        // F0:C9-C10
        placedTile(1, 9, "right", "R2", 2, false),        // F0:C11-C12
        placedTile(9, 8, "right", "R3", 3, false),        // F0:C13-C14 → head at C14, space=1!
        placedTile(8, 5, "right", "R4", 4, false),        // Mixed turn: conn at F0 C15, free at F-1 C15
        placedTile(5, 3, "right", "R5", 5, false),        // New row horizontal at F-2 C15-C14 (connecting VERTICALLY)
      ]);
      expect(grid.tiles).toHaveLength(6);

      // Center: horizontal
      expect(grid.tiles[0].orientation).toBe("horizontal");
      // T1-T3: right-arm horizontal
      for (let i = 1; i < 4; i++) {
        expect(grid.tiles[i].orientation).toBe("horizontal");
      }

      // Tile 4 (mixed turn): vertical
      expect(grid.tiles[4].orientation).toBe("vertical");
      expect(grid.tiles[4].cells[0].row).toBe(0);  // conn at F0
      expect(grid.tiles[4].cells[0].col).toBe(15); // edge cell
      expect(grid.tiles[4].cells[1].row).toBe(-1); // free at F-1
      expect(grid.tiles[4].cells[1].col).toBe(15);

      // Tile 5 (after mixed turn): HORIZONTAL in new row (F-2), connecting
      // VERTICALLY at C15 (same column as freeValue in F-1), extending west
      expect(grid.tiles[5].orientation).toBe("horizontal");
      // First cell at head column (C15) — vertical connection, second cell at C14
      expect(grid.tiles[5].cells[0].row).toBe(-2);
      expect(grid.tiles[5].cells[0].col).toBe(15);
      expect(grid.tiles[5].cells[1].row).toBe(-2);
      expect(grid.tiles[5].cells[1].col).toBe(14);

      // No overlap between tiles 4 and 5
      const t4cells = new Set(grid.tiles[4].cells.map(c => `${c.row}:${c.col}`));
      const t5cells = new Set(grid.tiles[5].cells.map(c => `${c.row}:${c.col}`));
      for (const cell of t5cells) {
        expect(t4cells.has(cell)).toBe(false);
      }
    });
  });
});
