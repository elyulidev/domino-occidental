/**
 * 16×N Grid Layout Engine — Pixel Positioning Layer.
 *
 * Takes the shared GridLayout (grid coordinates from computeGridLayout)
 * and computes pixel positions (x, y) for each tile, plus centering.
 *
 * CELL_PX = 48px per half-cell.
 * Normal tile (horizontal) = 2 cells wide = 96px × 48px tall.
 * Normal vertical (turn/corner) = 1 cell wide × 2 cells tall = 48px × 96px.
 * Double vertical (with floats) = 1 cell wide × 3 cells tall = 48px × 144px.
 *
 * IMPORTANT: This function receives tiles in DISPLAY order
 * (left-reversed → center → right) but computeGridLayout expects
 * PLAY order (center first, then remaining tiles in play sequence).
 * The function handles the reordering internally.
 *
 * @module frontend/grid-layout-engine
 */

import type { PlacedTile } from "@domino/shared";
import { computeGridLayout, type GridTile } from "@domino/shared/src/game";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CELL_PX = 48; // px per grid cell (half-tile)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TilePosition {
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
  isBend: boolean;
  flipped: boolean;
}

export interface LayoutResult {
  positions: TilePosition[];
  boardWidth: number;
  boardHeight: number;
}

// ---------------------------------------------------------------------------
// Reordering helpers
// ---------------------------------------------------------------------------

/**
 * Reorder tiles from display order to play order.
 *
 * Display order: [left-reversed..., center, right...]
 * Play    order: [center, right..., left-play...]
 *
 * Where left-play = reverse of display-order left tiles = original play order.
 */
function displayToPlayOrder(
  tiles: PlacedTile[],
  centerIdx: number,
): PlacedTile[] {
  if (tiles.length <= 1) return tiles;
  const center = tiles[centerIdx];
  const leftRev = tiles.slice(0, centerIdx); // leftmost first (display order)
  const rightArm = tiles.slice(centerIdx + 1); // play order (first played first)
  const leftPlay = leftRev.slice().reverse(); // innermost left first (play order)
  return [center, ...rightArm, ...leftPlay];
}

// ---------------------------------------------------------------------------
// Main layout function
// ---------------------------------------------------------------------------

/**
 * Compute pixel positions for tiles on the 16×N grid.
 *
 * Input: PlacedTile[] in DISPLAY order (left-reversed → center → right).
 *        centerIdx is the index of the center tile in the display array.
 * Output: LayoutResult with pixel positions centered at (0, 0).
 *
 * Container width is accepted for API compatibility but has no effect —
 * the 16×N grid is fixed-width, not container-dependent.
 */
export function calculateGridLayout(
  tiles: PlacedTile[],
  centerIdx: number,
  _containerWidth: number,
): LayoutResult {
  if (tiles.length === 0) {
    return { positions: [], boardWidth: 0, boardHeight: 0 };
  }

  // Reorder to play order for the shared grid engine
  const playOrder = displayToPlayOrder(tiles, centerIdx);

  // Compute grid positions using the shared layout engine
  const grid = computeGridLayout(playOrder);

  // Build a tileId → GridTile lookup
  const gridMap = new Map<string, GridTile>();
  for (const gt of grid.tiles) {
    gridMap.set(gt.tileId, gt);
  }

  // Build positions in DISPLAY order (matching input order)
  const positions: TilePosition[] = [];
  const cellRects: { x: number; y: number; w: number; h: number }[] = [];

  for (let i = 0; i < tiles.length; i++) {
    const placed = tiles[i];
    const gt = gridMap.get(placed.tile.id)!;
    const isDouble = gt.isDouble;

    // Determine pixel center from the mid-point of the tile's cells
    const cols = gt.cells.map((c) => c.col);
    const rows = gt.cells.map((c) => c.row);
    const avgCol = (Math.min(...cols) + Math.max(...cols)) / 2;
    const avgRow = (Math.min(...rows) + Math.max(...rows)) / 2;

    const x = avgCol * CELL_PX + CELL_PX / 2;
    const y = avgRow * CELL_PX + CELL_PX / 2;

    // Visual dimensions
    let w: number;
    let h: number;

    if (isDouble && gt.orientation === "vertical") {
      // Double with floats: 1 cell wide, 3 cells tall
      w = CELL_PX;
      h = CELL_PX * 3;
    } else if (gt.orientation === "vertical") {
      // Normal vertical (turn/corner): 1 cell wide, 2 cells tall
      w = CELL_PX;
      h = CELL_PX * 2;
    } else {
      // Horizontal (normal or new-row double): 2 cells wide, 1 cell tall
      w = CELL_PX * 2;
      h = CELL_PX;
    }

    cellRects.push({ x, y, w, h });

    // Flipped: use the server-stored flipped value from PlacedTile
    const flipped = placed.flipped;

    // isBend: true for tiles that sit at a grid corner (direction change).
    // Vertical tiles that are NOT doubles are always at corners.
    // Vertical doubles with floats are NOT bends (they sit mid-row).
    const isBend = gt.orientation === "vertical" && !(isDouble && gt.cells[0].row === gt.cells[1].row);

    positions.push({
      x,
      y,
      orientation: gt.orientation === "vertical" && !isDouble ? "vertical" : "horizontal",
      isBend,
      flipped,
    });
  }

  // Center the bounding box at (0, 0)
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const rect of cellRects) {
    const left = rect.x - rect.w / 2;
    const right = rect.x + rect.w / 2;
    const top = rect.y - rect.h / 2;
    const bottom = rect.y + rect.h / 2;

    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }

  const boardWidth = maxX - minX;
  const boardHeight = maxY - minY;

  const offsetX = boardWidth > 0 ? -(minX + boardWidth / 2) : 0;
  const offsetY = boardHeight > 0 ? -(minY + boardHeight / 2) : 0;

  for (let i = 0; i < positions.length; i++) {
    positions[i].x += offsetX;
    positions[i].y += offsetY;
  }

  return { positions, boardWidth, boardHeight };
}
