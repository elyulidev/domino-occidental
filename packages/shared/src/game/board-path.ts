import type { Side, Tile } from "../types";

/**
 * A slot on the abstract board path.
 * No pixel data — row width determined at render time by LayoutEngine.
 */
export interface BoardPathSlot {
  /** Slot index: center=0, right=+1..+N, left=-1..-N */
  index: number;
  /** Which arm this slot belongs to */
  arm: "left" | "center" | "right";
  /** True at row-wrap edges (where bends occur) */
  isCorner: boolean;
}

/**
 * Maximum number of tiles in a double-9 set: 10×11/2 = 55.
 * Board path has 109 slots (center + 54 right + 54 left).
 */
const TOTAL_SLOTS = 109;
const HALF_SLOTS = 54;

/**
 * Generates the abstract board path — 109 slots in a serpentine pattern.
 * Deterministic: same parameters always produce the same output.
 *
 * Row boundaries are NOT stored in the path; the LayoutEngine determines
 * fit at render time based on container width.
 */
export function generatePath(): BoardPathSlot[] {
  const slots: BoardPathSlot[] = [];

  // Center slot
  slots.push({ index: 0, arm: "center", isCorner: false });

  // Right arm: indices 1..54
  for (let i = 1; i <= HALF_SLOTS; i++) {
    // Corners at row-wrap boundaries (every N tiles depending on container,
    // but we mark potential corners at regular intervals)
    // For a 109-slot path, corners happen when the arm wraps rows.
    // Without knowing container width, mark every 4th slot as potential corner.
    // The LayoutEngine will determine actual bends at render time.
    const isCorner = i % 4 === 0;
    slots.push({ index: i, arm: "right", isCorner });
  }

  // Left arm: indices -1..-54
  for (let i = 1; i <= HALF_SLOTS; i++) {
    const isCorner = i % 4 === 0;
    slots.push({ index: -i, arm: "left", isCorner });
  }

  return slots;
}

/**
 * Resolves the slot index for a tile placed on a given side.
 *
 * Right side: positive consecutive indices starting from 1.
 * Left side: negative consecutive indices starting from -1.
 *
 * @param side - Which side of the board
 * @param currentCount - Number of tiles already on this side
 * @returns The slot index for the new tile
 */
export function resolveSlotIndex(side: Side, currentCount: number): number {
  return side === "right" ? currentCount + 1 : -(currentCount + 1);
}

/**
 * Determines whether a tile needs to be visually flipped for display.
 *
 * Right-side tiles always need visual swap (top/bottom) because the
 * canonical stored form has top=newEnd and bottom=connectingValue,
 * but horizontal display shows left=top, right=bottom.
 * For a right-side tile, the connecting value must be on the LEFT
 * (facing center), so top and bottom must be swapped.
 *
 * Center tile (slotIndex=0) is never flipped — both ends are exposed.
 *
 * @param side - Which side the tile is placed on
 * @param slotIndex - The tile's slot index (0 = center)
 * @returns true if the tile needs visual swap for display
 */
export function resolveFlipped(side: Side, slotIndex: number): boolean {
  return side === "right" && slotIndex !== 0;
}
