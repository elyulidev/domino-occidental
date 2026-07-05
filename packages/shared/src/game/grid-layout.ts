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
 * 3 PLACEMENT CASES (based on free cells from head to grid edge):
 *   ≥ 2  → same row, horizontal
 *   = 1  → mixed vertical turn (connection at edge cell, free value drops)
 *   = 0  → L-corner pure (new rows created at edge column)
 *
 * DOUBLES: 3 cells vertical with floats; exceptions for new-row and L-corner.
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
 * Cases:
 *   space ≥ 2  → same row (horizontal)
 *   space = 1  → mixed vertical turn (edge cell + drop to next row)
 *   space = 0  → L-corner pure (new row at edge)
 */
function placeNormal(
  tile: PlacedTile,
  head: HeadPos,
  occupied: Map<string, number>,
): PlacementResult {
  const connValue = tile.tile.bottom; // value that connects
  const freeValue = tile.tile.top;    // value that becomes new end
  const space = freeCells(head.col, head.dir);

  if (space >= 2) {
    // ── Same row (horizontal) ──
    const c1 = stepCol(head.col, head.dir);
    const c2 = stepCol(c1, head.dir);
    const cells: [HalfCell, HalfCell] = [
      { row: head.row, col: c1, value: connValue },
      { row: head.row, col: c2, value: freeValue },
    ];
    const newHead: HeadPos = { row: head.row, col: c2, dir: head.dir };
    return { cells, newHead, orientation: "horizontal", floats: [] };
  }

  if (space === 1) {
    // ── Mixed vertical turn ──
    // Connection goes at the last free cell (edge cell)
    const edgeCol = head.dir === "east" ? GRID_COLS - 1 : 0;
    // Free value drops to next row, same column
    const dropRow = tile.side === "right"
      ? wrapRow(head.row, "up")
      : wrapRow(head.row, "down");
    const cells: [HalfCell, HalfCell] = [
      { row: head.row, col: edgeCol, value: connValue },
      { row: dropRow, col: edgeCol, value: freeValue },
    ];
    const newDir = rowDir(dropRow);
    const newHead: HeadPos = { row: dropRow, col: edgeCol, dir: newDir };
    return { cells, newHead, orientation: "vertical", floats: [] };
  }

  // ── space === 0: L-corner pure ──
  // Connection value IS already at the edge cell (head.col = edge).
  // Create new row above/below at the same column.
  // The tile's two halves occupy the same column in different rows.
  const edgeCol = head.col;
  const nextRow = tile.side === "right"
    ? wrapRow(head.row, "up")
    : wrapRow(head.row, "down");
  const beyondRow = tile.side === "right"
    ? wrapRow(nextRow, "up")
    : wrapRow(nextRow, "down");
  const cells: [HalfCell, HalfCell] = [
    { row: nextRow, col: edgeCol, value: connValue },
    { row: beyondRow, col: edgeCol, value: freeValue },
  ];
  const newDir = rowDir(beyondRow);
  const newHead: HeadPos = { row: beyondRow, col: edgeCol, dir: newDir };
  return { cells, newHead, orientation: "vertical", floats: [] };
}

/**
 * Place a double tile on the given head.
 *
 * Doubles occupy 1 cell wide × 3 cells tall (vertical with floats),
 * except when space=0 (L-corner, 2 cells vertical, no floats) or
 * when starting a new row (horizontal, no floats).
 */
function placeDouble(
  tile: PlacedTile,
  head: HeadPos,
  occupied: Map<string, number>,
): PlacementResult {
  const value = tile.tile.top; // same as bottom (double)
  const space = freeCells(head.col, head.dir);

  if (space === 0) {
    // ── L-corner double: 2 cells vertical, no floats ──
    const edgeCol = head.col;
    const nextRow = tile.side === "right"
      ? wrapRow(head.row, "up")
      : wrapRow(head.row, "down");
    const beyondRow = tile.side === "right"
      ? wrapRow(nextRow, "up")
      : wrapRow(nextRow, "down");
    const cells: [HalfCell, HalfCell] = [
      { row: nextRow, col: edgeCol, value },
      { row: beyondRow, col: edgeCol, value },
    ];
    const newDir = rowDir(beyondRow);
    const newHead: HeadPos = { row: beyondRow, col: edgeCol, dir: newDir };
    return { cells, newHead, orientation: "vertical", floats: [] };
  }

  // Check if this is the opening tile (no tiles yet on the board)
  // or if this starts a new row (no occupied cells in the target direction)
  const opening = occupied.size === 0;
  const isNewRow = space >= GRID_COLS - 1 || head.row !== START_ROW;

  if (opening || isNewRow) {
    // ── New row / opening: horizontal, no floats ──
    const c1 = stepCol(head.col, head.dir);
    const c2 = stepCol(c1, head.dir);
    const cells: [HalfCell, HalfCell] = [
      { row: head.row, col: c1, value },
      { row: head.row, col: c2, value },
    ];
    const newHead: HeadPos = { row: head.row, col: c2, dir: head.dir };
    return { cells, newHead, orientation: "horizontal", floats: [] };
  }

  // ── Standard double: 1 cell × 3 vertical with floats ──
  const c = stepCol(head.col, head.dir);
  // The double sits in the middle row; floats above and below
  const cells: [HalfCell, HalfCell] = [
    { row: head.row, col: c, value },
    { row: head.row, col: c, value },
  ];
  const floats: HalfCell[] = [
    { row: wrapRow(head.row, "up"), col: c, value },
    { row: wrapRow(head.row, "down"), col: c, value },
  ];
  const newHead: HeadPos = {
    row: head.row,
    col: c,
    dir: head.dir,
  };
  // Double doesn't change the end value, but new end position is at the
  // double's cell. The SERVER tracks ends by VALUE; the GRID tracks by POSITION.
  // After a double, the next tile connects to the same VALUE but the HEAD
  // position is at the double cell (NOT moved further).
  return { cells, newHead, orientation: "vertical", floats };
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
    // The canonical tile has: bottom = connecting, top = new end
    // For the first tile both are the values
    const leftCell: HalfCell = { row: START_ROW, col: CENTER_COL, value: first.tile.bottom };
    const rightCell: HalfCell = { row: START_ROW, col: CENTER_COL + 1, value: first.tile.top };

    occupied.set(cellKey(START_ROW, CENTER_COL), first.tile.bottom);
    occupied.set(cellKey(START_ROW, CENTER_COL + 1), first.tile.top);

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

  // ── Place remaining tiles ──
  for (let i = 1; i < tiles.length; i++) {
    const placed = tiles[i];
    const head: HeadPos = placed.side === "left" ? leftHead! : rightHead!;
    const isDouble = placed.tile.top === placed.tile.bottom;

    const result = isDouble
      ? placeDouble(placed, head, occupied)
      : placeNormal(placed, head, occupied);

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
