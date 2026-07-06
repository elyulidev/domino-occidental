/**
 * 16×N Grid Layout Engine for Domino Occidental.
 *
 * Takes the ordered list of `PlacedTile` (from server BoardState) and computes
 * grid coordinates for each tile half on a 16-column serpentine board.
 *
 * COLUMNS:  C0..C15  (fixed)
 * ROWS:     F0 (start), F+1..F+N (above), F-1..F-N (below) — grow dynamically
 *
 * SERPENTINE: even rows (F0, F2, F-2, F4…) → RIGHT (→)
 *             odd rows  (F1, F-1, F3, F-3…) → LEFT  (←)
 *
 * PLACEMENT CASES (based on free cells from head to grid edge):
 *   Normal tiles:
 *     ≥ 2           → same row, horizontal
 *     = 1           → mixed vertical turn (edge cell + drop to next row)
 *     = 0 + giro    → L-corner from giro (1 new row, conn already at edge)
 *     = 0           → L-corner pure (2 new rows at edge column)
 *   Doubles:
 *     = 0 + giro    → vertical, 1 cell at adjacent row, no floats
 *     = 0           → L-corner (2 rows vertical, no floats)
 *     = 1           → mixed turn (2 cells vertical, no floats)
 *     ≥ 2 + newRow  → horizontal, no floats (spinner-ready)
 *     else          → 1 cell wide × 3 tall with floats
 *
 * VERTICAL DIRECTION (Rule 10): F0 collision avoidance via f0Dir tracking.
 *
 * The server's `board.ts` is NOT replaced — it validates moves using
 * leftEnd/rightEnd. This module is purely for VISUAL LAYOUT.
 *
 * @module grid-layout
 */

import type { PlacedTile, Side } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRID_COLS = 16;     // C0..C15
const CENTER_COL = 7;     // centre column for opening tile
const START_ROW = 0;      // F0

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Direction a row fills */
export type GridDir = "east" | "west";

/** Vertical direction for new rows */
export type VertDir = "up" | "down";

/** Grid position of a single tile half-cell */
export interface HalfCell {
  row: number;
  col: number;
  value: number;
}

/** A tile placed on the grid with its half-cell positions */
export interface GridTile {
  tileId: string;
  /** Canonical (post-flip) values: top = new-end, bottom = connection */
  top: number;
  bottom: number;
  isDouble: boolean;
  /** The two half-cells in display order: [halfA, halfB] */
  cells: [HalfCell, HalfCell];
  /** How the tile is oriented on the grid */
  orientation: "horizontal" | "vertical";
  /** Extra float cells for vertical doubles */
  floats: HalfCell[];
}

/** Head position for an end — where the NEXT tile on this side connects */
export interface HeadPos {
  row: number;
  col: number;
  dir: GridDir;
  /** True when this head was created by a mixed vertical turn (space=1).
   *  The connecting value is already at the edge cell. */
  giroExtreme?: boolean;
}

/** Complete 16×N grid layout for a board */
export interface GridLayout {
  /** Tiles placed on the grid (same order as input) */
  tiles: GridTile[];
  /** Occupied cells: key = "row:col" → domino value */
  occupied: Map<string, number>;
  /** All active row indices (sorted) */
  rows: number[];
  /** Head positions for both ends (null if board empty) */
  leftHead: HeadPos | null;
  rightHead: HeadPos | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

/** Is this row even (goes east)? */
function isEastRow(row: number): boolean {
  return row % 2 === 0;
}

/** Get the serpentine direction for a given row */
function rowDir(row: number): GridDir {
  return isEastRow(row) ? "east" : "west";
}

/** Number of free cells from `col` to the grid edge in given direction */
function freeCells(col: number, dir: GridDir): number {
  if (dir === "east") return GRID_COLS - 1 - col;
  return col; // west: cells from col down to 0 (excluding col itself)
}

/** Next column stepping in direction */
function stepCol(col: number, dir: GridDir): number {
  return dir === "east" ? col + 1 : col - 1;
}

/** Next row moving UP (+1) or DOWN (-1) from current, keeping col */
function wrapRow(currentRow: number, dir: "up" | "down"): number {
  return dir === "up" ? currentRow + 1 : currentRow - 1;
}

/**
 * Correct row direction at grid edges: if serpentine direction points OUT of
 * the grid (west at C0, east at C15), flip it inward to avoid dead ends.
 */
function edgeDir(row: number, col: number): GridDir {
  const d = rowDir(row);
  if (col <= 0 && d === "west") return "east";
  if (col >= GRID_COLS - 1 && d === "east") return "west";
  return d;
}

/**
 * Check if a row has exactly 1 occupied cell (i.e. was just created by a
 * giro/L-corner and no subsequent tile has extended it yet).
 */
function isNewRow(row: number, occupied: Map<string, number>): boolean {
  let count = 0;
  for (const [key] of occupied) {
    const r = Number(key.split(":")[0]);
    if (r === row) {
      count++;
      if (count > 1) return false;
    }
  }
  return count === 1;
}

/**
 * Decide vertical direction (up/down) with F0 collision avoidance.
 *
 * Rule 10 from AGENTS.md:
 *   1. The user decides left/right end.
 *   2. If neither F0 end has decided, left defaults UP, right defaults DOWN.
 *   3. If one F0 end has decided, the other goes the opposite way.
 *
 * Returns the chosen direction AND the updated f0Dir state.
 */
function decideVerticalDir(
  side: "left" | "right",
  f0Left: VertDir | null,
  f0Right: VertDir | null,
): { dir: VertDir; newF0Left: VertDir | null; newF0Right: VertDir | null } {
  if (side === "left") {
    if (f0Left !== null) return { dir: f0Left, newF0Left: f0Left, newF0Right: f0Right };
    if (f0Right !== null) {
      const dir: VertDir = f0Right === "up" ? "down" : "up";
      return { dir, newF0Left: dir, newF0Right: f0Right };
    }
    return { dir: "up", newF0Left: "up", newF0Right: f0Right };
  }

  // side === "right"
  if (f0Right !== null) return { dir: f0Right, newF0Left: f0Left, newF0Right: f0Right };
  if (f0Left !== null) {
    const dir: VertDir = f0Left === "up" ? "down" : "up";
    return { dir, newF0Left: f0Left, newF0Right: dir };
  }
  return { dir: "down", newF0Left: f0Left, newF0Right: "down" };
}

// ---------------------------------------------------------------------------
// Placement cases
// ---------------------------------------------------------------------------

interface PlacementResult {
  cells: [HalfCell, HalfCell];
  newHead: HeadPos;
  orientation: "horizontal" | "vertical";
  floats: HalfCell[];
}

/**
 * Place a normal (non-double) tile on the given head.
 *
 * Full cascade matching board-sim.mjs:
 *   space ≥ 2           → same row (horizontal)
 *   space = 1           → mixed vertical turn (edge cell + drop to next row)
 *   space = 0 + giro    → L-corner from giro (1 new row, connValue already at edge)
 *   space = 0           → L-corner pure (2 new rows at edge column)
 *
 * @param vertDir - Vertical direction when creating new rows (only used when space < 2)
 */
function placeNormal(
  tile: PlacedTile,
  head: HeadPos,
  occupied: Map<string, number>,
  vertDir?: VertDir,
): PlacementResult {
  const connValue = tile.tile.bottom;
  const freeValue = tile.tile.top;
  const space = freeCells(head.col, head.dir);
  const edgeCol = head.dir === "east" ? GRID_COLS - 1 : 0;

  if (space >= 2) {
    // ── Same row (horizontal) ──
    const c1 = stepCol(head.col, head.dir);
    const c2 = stepCol(c1, head.dir);
    return {
      cells: [
        { row: head.row, col: c1, value: connValue },
        { row: head.row, col: c2, value: freeValue },
      ],
      newHead: { row: head.row, col: c2, dir: head.dir },
      orientation: "horizontal",
      floats: [],
    };
  }

  if (space === 1) {
    // ── Mixed vertical turn (giro mixto) ──
    // Connection at edge cell, free value drops to adjacent row.
    // New head points TOWARDS the edge (dead end) to force next tile vertical.
    const dropRow = vertDir === "up" ? head.row + 1 : head.row - 1;
    const deadDir: GridDir = edgeCol <= 0 ? "west" : "east";
    return {
      cells: [
        { row: head.row, col: edgeCol, value: connValue },
        { row: dropRow, col: edgeCol, value: freeValue },
      ],
      newHead: { row: dropRow, col: edgeCol, dir: deadDir, giroExtreme: true },
      orientation: "vertical",
      floats: [],
    };
  }

  // ── space === 0 ──
  if (head.giroExtreme) {
    // L-corner FROM giro: 1 new row (connValue already at edge cell from the giro).
    // Only freeValue goes to the adjacent row.
    const dropRow = vertDir === "up" ? head.row + 1 : head.row - 1;
    const nd = edgeDir(dropRow, edgeCol);
    return {
      cells: [
        { row: head.row, col: edgeCol, value: connValue },
        { row: dropRow, col: edgeCol, value: freeValue },
      ],
      newHead: { row: dropRow, col: edgeCol, dir: nd },
      orientation: "vertical",
      floats: [],
    };
  }

  // ── Pure L-corner: 2 new rows (connValue at nextRow, freeValue at beyondRow) ──
  const nextRow = vertDir === "up" ? head.row + 1 : head.row - 1;
  const beyondRow = vertDir === "up" ? head.row + 2 : head.row - 2;
  const nd = edgeDir(beyondRow, edgeCol);
  return {
    cells: [
      { row: nextRow, col: edgeCol, value: connValue },
      { row: beyondRow, col: edgeCol, value: freeValue },
    ],
    newHead: { row: beyondRow, col: edgeCol, dir: nd },
    orientation: "vertical",
    floats: [],
  };
}

/**
 * Place a double tile on the given head.
 *
 * Full cascade matching board-sim.mjs:
 *   space=0 + giroExtreme → doubleFromGiro     (1 row vertical, no floats)
 *   space=0               → double L-corner     (2 rows vertical, no floats)
 *   space=1               → double giro         (2 cells vertical in new row, no floats)
 *   space≥2 + isNewRow    → double new-row-horiz (horizontal, no floats, with spinner)
 *   else                  → standard double     (1 cell × 3 with floats)
 *
 * @param vertDir - Vertical direction when creating new rows (only for space<2)
 */
function placeDouble(
  tile: PlacedTile,
  head: HeadPos,
  occupied: Map<string, number>,
  vertDir?: VertDir,
): PlacementResult {
  const value = tile.tile.top; // same as bottom (double)
  const space = freeCells(head.col, head.dir);
  const edgeCol = head.dir === "east" ? GRID_COLS - 1 : 0;

  // ── 1) Double from giro: space=0 + head.giroExtreme ──
  // connValue already at edge cell from giro — place only 1 cell at adjacent row.
  if (space === 0 && head.giroExtreme) {
    const dropRow = vertDir === "up" ? head.row + 1 : head.row - 1;
    const nd = edgeDir(dropRow, head.col);
    return {
      cells: [
        { row: head.row, col: head.col, value },
        { row: dropRow, col: head.col, value },
      ],
      newHead: { row: dropRow, col: head.col, dir: nd },
      orientation: "vertical",
      floats: [],
    };
  }

  // ── 2) Double L-corner: space=0 (no giro) ──
  if (space === 0) {
    const nextRow = vertDir === "up" ? head.row + 1 : head.row - 1;
    const beyondRow = vertDir === "up" ? head.row + 2 : head.row - 2;
    const nd = edgeDir(beyondRow, head.col);
    return {
      cells: [
        { row: nextRow, col: head.col, value },
        { row: beyondRow, col: head.col, value },
      ],
      newHead: { row: beyondRow, col: head.col, dir: nd },
      orientation: "vertical",
      floats: [],
    };
  }

  // ── 3) Double mixed turn: space=1 (acts like normal tile in _newRow) ──
  if (space === 1) {
    const dropRow = vertDir === "up" ? head.row + 1 : head.row - 1;
    const deadDir: GridDir = edgeCol <= 0 ? "west" : "east";
    return {
      cells: [
        { row: head.row, col: edgeCol, value },
        { row: dropRow, col: edgeCol, value },
      ],
      newHead: { row: dropRow, col: edgeCol, dir: deadDir, giroExtreme: true },
      orientation: "vertical",
      floats: [],
    };
  }

  // ── 4) Double as first tile in a new row: space≥2 + isNewRow ──
  if (space >= 2 && isNewRow(head.row, occupied)) {
    const c1 = stepCol(head.col, head.dir);
    const c2 = stepCol(c1, head.dir);
    // Spinner: add opposite-direction end at c1 so the double can be played
    // from both sides
    return {
      cells: [
        { row: head.row, col: c1, value },
        { row: head.row, col: c2, value },
      ],
      newHead: { row: head.row, col: c2, dir: head.dir },
      orientation: "horizontal",
      floats: [],
    };
  }

  // ── 5) Standard double: 1 cell × 3 vertical with floats ──
  const c = stepCol(head.col, head.dir);
  const floatUp = { row: head.row + 1, col: c, value };
  const floatDown = { row: head.row - 1, col: c, value };
  return {
    cells: [
      { row: head.row, col: c, value },
      { row: head.row, col: c, value },
    ],
    newHead: { row: head.row, col: c, dir: head.dir },
    orientation: "vertical",
    floats: [floatUp, floatDown],
  };
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

/**
 * Compute the 16×N grid layout from an ordered list of placed tiles.
 *
 * Pure function — no side effects, no mutations of inputs.
 *
 * @param tiles - Ordered list of PlacedTile from BoardState.tiles
 * @returns GridLayout with grid positions for every tile half
 */
export function computeGridLayout(tiles: PlacedTile[]): GridLayout {
  const occupied = new Map<string, number>();
  const gridTiles: GridTile[] = [];
  let leftHead: HeadPos | null = null;
  let rightHead: HeadPos | null = null;

  if (tiles.length === 0) {
    return {
      tiles: [],
      occupied,
      rows: [],
      leftHead: null,
      rightHead: null,
    };
  }

  // ── Place the opening tile ──
  const first = tiles[0];
  const isFirstDouble = first.tile.top === first.tile.bottom;

  if (isFirstDouble) {
    // Opening double at F0:C7 with floats above/below
    const centerHalf: HalfCell = { row: START_ROW, col: CENTER_COL, value: first.tile.top };
    const floatUp: HalfCell = { row: START_ROW + 1, col: CENTER_COL, value: first.tile.top };
    const floatDown: HalfCell = { row: START_ROW - 1, col: CENTER_COL, value: first.tile.top };

    occupied.set(cellKey(START_ROW, CENTER_COL), first.tile.top);
    occupied.set(cellKey(START_ROW + 1, CENTER_COL), first.tile.top);
    occupied.set(cellKey(START_ROW - 1, CENTER_COL), first.tile.top);

    gridTiles.push({
      tileId: first.tile.id,
      top: first.tile.top,
      bottom: first.tile.bottom,
      isDouble: true,
      cells: [centerHalf, centerHalf],
      orientation: "vertical",
      floats: [floatUp, floatDown],
    });

    // Both ends share the same value on a double
    leftHead = { row: START_ROW, col: CENTER_COL, dir: "west" };
    rightHead = { row: START_ROW, col: CENTER_COL, dir: "east" };
  } else {
    // Opening normal tile at F0:C7-C8
    // The canonical tile has: bottom = connecting, top = new end.
    // BUT the orientation depends on the side: when side="right", the board
    // inverts the ends (board.ts: leftEnd=tile.top, rightEnd=tile.bottom),
    // so the left cell gets tile.top and the right cell gets tile.bottom.
    const leftValue = first.side === "right" ? first.tile.top : first.tile.bottom;
    const rightValue = first.side === "right" ? first.tile.bottom : first.tile.top;
    const leftCell: HalfCell = { row: START_ROW, col: CENTER_COL, value: leftValue };
    const rightCell: HalfCell = { row: START_ROW, col: CENTER_COL + 1, value: rightValue };

    occupied.set(cellKey(START_ROW, CENTER_COL), leftValue);
    occupied.set(cellKey(START_ROW, CENTER_COL + 1), rightValue);

    gridTiles.push({
      tileId: first.tile.id,
      top: first.tile.top,
      bottom: first.tile.bottom,
      isDouble: false,
      cells: [leftCell, rightCell],
      orientation: "horizontal",
      floats: [],
    });

    leftHead = { row: START_ROW, col: CENTER_COL, dir: "west" };
    rightHead = { row: START_ROW, col: CENTER_COL + 1, dir: "east" };
  }

  // ── F0 direction tracking (Rule 10: avoid vertical collisions) ──
  let f0Left: VertDir | null = null;
  let f0Right: VertDir | null = null;

  // ── Place remaining tiles ──
  for (let i = 1; i < tiles.length; i++) {
    const placed = tiles[i];
    const head: HeadPos = placed.side === "left" ? leftHead! : rightHead!;
    const isDouble = placed.tile.top === placed.tile.bottom;
    const space = freeCells(head.col, head.dir);

    // Determine vertical direction when creating new rows (space < 2)
    let vertDir: VertDir | undefined;
    if (space < 2) {
      const decision = decideVerticalDir(placed.side, f0Left, f0Right);
      vertDir = decision.dir;
      f0Left = decision.newF0Left;
      f0Right = decision.newF0Right;
    }

    const result = isDouble
      ? placeDouble(placed, head, occupied, vertDir)
      : placeNormal(placed, head, occupied, vertDir);

    // Mark cells as occupied
    for (const cell of [...result.cells, ...result.floats]) {
      occupied.set(cellKey(cell.row, cell.col), cell.value);
    }

    gridTiles.push({
      tileId: placed.tile.id,
      top: placed.tile.top,
      bottom: placed.tile.bottom,
      isDouble,
      cells: result.cells,
      orientation: result.orientation,
      floats: result.floats,
    });

    // Update head
    if (placed.side === "left") {
      leftHead = result.newHead;
    } else {
      rightHead = result.newHead;
    }
  }

  // Collect all rows
  const rowSet = new Set<number>();
  for (const [key] of occupied) {
    const [r] = key.split(":");
    rowSet.add(Number(r));
  }
  const rows = Array.from(rowSet).sort((a, b) => a - b);

  return {
    tiles: gridTiles,
    occupied,
    rows,
    leftHead,
    rightHead,
  };
}
