import type { PlacedTile } from "@domino/shared";

// ---------------------------------------------------------------------------
// Grid constants (from public/board-layout/board-path.ts)
// ---------------------------------------------------------------------------

const CELL_PX = 24;
const HALF_W = CELL_PX * 2; // 48
const HALF_H = CELL_PX * 2; // 48
const TILE_W = CELL_PX * 4; // 96
const TILE_H = CELL_PX * 2; // 48
const BOARD_COLS = 8;
const BOARD_ROWS = 15;
const TOTAL_SLOTS = 109;
const OPENING_SLOT_INDEX = 54;

// ---------------------------------------------------------------------------
// Interfaces (same shape as layout-engine.ts for drop-in compatibility)
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
// Snake path generation
// ---------------------------------------------------------------------------

interface PathSlot {
  index: number;
  col: number;
  row: number;
  direction: "right" | "left";
  isCorner: boolean;
}

/**
 * Generates the snake path for the grid-based board layout.
 *
 * The path snakes through an 8-column × 15-row grid (109 slots).
 * Starting at (col=0, row=0), moving right; at the right wall it
 * drops a row and reverses; at the left wall it drops and reverses again.
 *
 * Slot 54 (OPENING_SLOT_INDEX) is roughly centered in the grid.
 */
function generateSnakePath(): PathSlot[] {
  const path: PathSlot[] = [];
  let col = 0;
  let row = 0;
  let direction: "right" | "left" = "right";

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const isRightCorner = direction === "right" && col === BOARD_COLS - 1;
    const isLeftCorner = direction === "left" && col === 0;
    const isCorner = isRightCorner || isLeftCorner;

    path.push({
      index: i,
      col,
      row,
      direction,
      isCorner,
    });

    if (isCorner) {
      row += 1;
      direction = direction === "right" ? "left" : "right";
    } else {
      col += direction === "right" ? 1 : -1;
    }
  }

  return path;
}

// ---------------------------------------------------------------------------
// Slot index mapping
// ---------------------------------------------------------------------------

/**
 * Maps the store's slot index (center=0, right=+1..+N, left=-1..-N)
 * to the grid path index (opening=54, right=55..108, left=53..0).
 */
function oldSlotToNewSlotIndex(oldSlotIndex: number): number {
  return OPENING_SLOT_INDEX + oldSlotIndex;
}

// ---------------------------------------------------------------------------
// Main layout function — drop-in replacement for calculateLayout
// ---------------------------------------------------------------------------

/**
 * Pure function: compute pixel positions for tiles along the grid-based snake path.
 *
 * Uses a fixed 8×15 grid (109 slots) with the opening at slot 54.
 * Each tile is placed at its grid cell's center, then the entire board
 * is centered at (0, 0).
 *
 * Orientation rules (Phase 1 approximation):
 * - Straight slot (non-corner) → "horizontal"
 * - Corner slot → "vertical" (isBend=true)
 *
 * Flipped: uses the stored `placed.flipped` value directly (computed by board.ts).
 *
 * @param display - PlacedTile[] in display order (left-reversed → center → right)
 * @param centerIdx - Index of the center tile in the display array
 * @param containerWidth - Pixel width of the container (unused in grid system, kept for interface compat)
 * @returns LayoutResult with absolute pixel positions centered at (0,0)
 */
export function calculateGridLayout(
  display: PlacedTile[],
  centerIdx: number,
  containerWidth: number,
): LayoutResult {
  const n = display.length;
  if (n === 0) return { positions: [], boardWidth: 0, boardHeight: 0 };

  // Generate snake path once (deterministic, same output every call)
  const path = generateSnakePath();

  const positions: TilePosition[] = new Array(n);

  // Compute raw grid positions for each tile
  for (let i = 0; i < n; i++) {
    const placed = display[i];
    const newSlotIndex = oldSlotToNewSlotIndex(placed.slotIndex);

    // Clamp to valid range (safety check)
    const clampedIndex = Math.max(0, Math.min(TOTAL_SLOTS - 1, newSlotIndex));
    const slot = path[clampedIndex];

    // Pixel position: center of the grid cell
    const x = slot.col * TILE_W + TILE_W / 2;
    const y = slot.row * TILE_H + TILE_H / 2;

    // Orientation mapping (Phase 1 approximation)
    const isBend = slot.isCorner;
    const orientation: "horizontal" | "vertical" = isBend
      ? "vertical"
      : "horizontal";

    positions[i] = {
      x,
      y,
      orientation,
      isBend,
      flipped: placed.flipped,
    };
  }

  // Center the visual bounding box at (0, 0)
  // Compute bounding box including each tile's visual dimensions
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < n; i++) {
    const isVertical = positions[i].orientation === "vertical";
    // DominoTile "md" size: vertical = w-48 h-96, horizontal = w-96 h-48
    const visualW = isVertical ? TILE_H : TILE_W;
    const visualH = isVertical ? TILE_W : TILE_H;

    const left = positions[i].x - visualW / 2;
    const right = positions[i].x + visualW / 2;
    const top = positions[i].y - visualH / 2;
    const bottom = positions[i].y + visualH / 2;

    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  }

  const boardWidth = maxX - minX;
  const boardHeight = maxY - minY;

  const offsetX = -(minX + boardWidth / 2);
  const offsetY = -(minY + boardHeight / 2);

  for (let i = 0; i < n; i++) {
    positions[i].x += offsetX;
    positions[i].y += offsetY;
  }

  return { positions, boardWidth, boardHeight };
}
