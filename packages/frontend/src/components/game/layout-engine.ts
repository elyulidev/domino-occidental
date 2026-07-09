import type { PlacedTile } from "@domino/shared";

// ---------------------------------------------------------------------------
// Constants — CELL-based square sub-cell grid
// ---------------------------------------------------------------------------

const CELL = 48;
const H_TILE_W = CELL * 2; // 96 — horizontal tile width
const H_TILE_H = CELL;     // 48 — horizontal tile height
const V_TILE_W = CELL;     // 48 — vertical tile width
const V_TILE_H = CELL * 2; // 96 — vertical tile height
const GAP = 0;
const PADDING = 16;
// Row step: distance between row centers.
// Must be H_TILE_H/2 + V_TILE_H/2 so the vertical bend tile
// (96px tall) touches the horizontal tiles (48px tall) of the
// adjacent row edge-to-edge.
const _ROW_STEP = H_TILE_H / 2 + V_TILE_H / 2; // 72

export interface TilePosition {
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
  isBend: boolean;
  /** Whether the renderer should swap top/bottom so the matching number
   *  appears on the connecting side. Computed by tracking the open value
   *  at each step along the serpentine. */
  flipped: boolean;
}

export interface LayoutResult {
  positions: TilePosition[];
  boardWidth: number;
  boardHeight: number;
}

/**
 * Pure function: compute pixel positions for tiles along a serpentine path.
 *
 * Two-pass center-outward algorithm:
 * - Left arm walks backward from centerIdx
 * - Right arm walks forward from centerIdx
 * - At container edges, vertical bend tiles flip direction and advance to next row
 * - Post-process centers the visual bounding box at x=0
 *
 * Orientation rules:
 * - Center tile: vertical
 * - Double in straight run: vertical (perpendicular to the flow — standard
 *   domino convention so the matching number is visible on the transverse axis)
 * - Non-double in straight run: horizontal
 * - Bend tile (any): vertical
 *
 * Flipped tracking:
 * - walkArm maintains openValue (the exposed number at the working end)
 * - Each tile's canonical bottom is the connecting value (guaranteed by place())
 * - flipped aligns the connecting value with the inward side:
 *   - Right arm (direction=1): connecting value goes on LEFT → flipped=true
 *   - Left arm (direction=-1): connecting value goes on RIGHT → flipped=false
 *
 * @param display - PlacedTile[] in display order (left-reversed → center → right)
 * @param centerIdx - Index of the center tile in the display array
 * @param containerWidth - Pixel width of the container
 * @returns LayoutResult with absolute pixel positions
 */
export function calculateLayout(
  display: PlacedTile[],
  centerIdx: number,
  containerWidth: number,
): LayoutResult {
  const n = display.length;
  if (n === 0) return { positions: [], boardWidth: 0, boardHeight: 0 };

  const positions: TilePosition[] = new Array(n);
  const usableW = containerWidth - PADDING * 2;

  // Single tile: centered, vertical
  if (n === 1) {
    positions[0] = {
      x: 0,
      y: 0,
      orientation: "vertical",
      isBend: false,
      flipped: display[0].flipped,
    };
    return { positions, boardWidth: V_TILE_W, boardHeight: V_TILE_H };
  }

  // Determine orientation for a tile at a given position.
  // Center: vertical. Bend: vertical. Double in straight run: vertical
  //   (perpendicular to flow — standard domino convention).
  // Non-double in straight run: horizontal.
  function getOrientation(
    idx: number,
    isBend: boolean,
  ): "horizontal" | "vertical" {
    if (isBend) return "vertical";
    if (idx === centerIdx) return "vertical";
    const tile = display[idx].tile;
    if (tile.top === tile.bottom) return "vertical";
    return "horizontal";
  }

  // Resolve the open value at the center tile for a given direction.
  // The center tile is the first placed tile. Its stored tile is the ORIGINAL
  // (not auto-flipped). The exposed ends depend on which side it was placed on.
  const centerTile = display[centerIdx].tile;
  const centerSide = display[centerIdx].side;
  // Right arm departing from center: exposed number on the right
  const rightOpenValue =
    centerSide === "left" ? centerTile.top : centerTile.bottom;
  // Left arm departing from center: exposed number on the left
  const leftOpenValue =
    centerSide === "left" ? centerTile.bottom : centerTile.top;

  // First tile: vertical at origin
  positions[centerIdx] = {
    x: 0,
    y: 0,
    orientation: "vertical",
    isBend: false,
    flipped: display[centerIdx].flipped,
  };

  let minX = 0;
  let maxX = 0;

  // Walk one arm in the given direction.
  // Tracks openValue (exposed number at the working end) at each step
  // so we can verify number-to-number matching and set flipped correctly.
  function walkArm(
    startIdx: number,
    direction: 1 | -1,
    bendUp: boolean,
    initialOpenValue: number,
  ): { bendUp: boolean } {
    let x = 0;
    let y = 0;
    let dir = direction;
    let up = bendUp;
    let openValue = initialOpenValue;
    // Track previous tile's half-width for center-to-center distance
    // Center tile is always vertical: half = V_TILE_W / 2
    let prevHalfW = V_TILE_W / 2;
    // Track used row y-levels to prevent position reuse
    const usedRows = new Set<number>([0]);

    // flipped base is determined by flow direction:
    // right arm (dir=1) → connecting value goes on LEFT side → flipped=true (base)
    // left arm (dir=-1) → connecting value goes on RIGHT side → flipped=false (base)
    // This base applies when the tile is in canonical form (bottom = connecting).
    // If the tile has top = connecting (non-canonical), flipped is inverted.
    const armFlipped = direction === 1;

    const step = direction === 1 ? 1 : -1;
    const limit = direction === 1 ? n : -1;

    for (let i = startIdx; i !== limit; i += step) {
      const tile = display[i].tile;
      // Detect bend BEFORE getOrientation so we don't classify as bend yet
      const orientation = getOrientation(i, false);
      const halfW = orientation === "vertical" ? V_TILE_W / 2 : H_TILE_W / 2;

      // Check if this tile's leading edge would overflow the container
      const nextCenter = x + dir * (prevHalfW + halfW);
      const leadingEdge = nextCenter + dir * halfW;

      // Resolve how this tile connects to the current openValue.
      // In canonical form (from place()) bottom = connecting value.
      // Tests and edge cases may supply non-canonical tiles where top = connecting.
      // We handle both: which end matches openValue determines flipped.
      let connectingValue: number;
      let localFlipped: boolean;
      if (tile.bottom === openValue) {
        // Canonical form — bottom carries the connecting value
        connectingValue = tile.bottom;
        localFlipped = armFlipped;
      } else if (tile.top === openValue) {
        // Non-canonical form — top carries the connecting value
        connectingValue = tile.top;
        localFlipped = !armFlipped;
      } else {
        throw new Error(
          `Number mismatch at tile ${i}: need ${openValue}, got ${tile.top}|${tile.bottom}`,
        );
      }
      // New exposed end is the opposite pip value
      const newEnd =
        connectingValue === tile.bottom ? tile.top : tile.bottom;

      if (Math.abs(leadingEdge) > usableW / 2) {
        // BEND — place bend tile at current position, advance to next row
        // Use V_TILE_H (not ROW_STEP) so consecutive same-direction bend
        // tiles (vertical, 96px tall) don't overlap. The 24px gap between
        // the bend bottom and the previous-row horizontal tiles is acceptable
        // — overlap is not.
        const ROW_ADVANCE = V_TILE_H + GAP;
        let rowY = y + (up ? -ROW_ADVANCE : ROW_ADVANCE);
        // If this row y-level is already used, keep advancing
        while (usedRows.has(rowY)) {
          rowY += up ? -ROW_ADVANCE : ROW_ADVANCE;
        }
        y = rowY;
        usedRows.add(y);

        // Bend tile: always vertical, flipped to put the connecting value
        // on the inward side of the serpentine
        positions[i] = {
          x,
          y,
          orientation: "vertical",
          isBend: true,
          flipped: localFlipped,
        };
        prevHalfW = V_TILE_W / 2; // bend tile is vertical

        openValue = newEnd;

        // Flip direction for next row
        dir *= -1;
        up = !up;
        // x stays at bend tile's center — next iteration computes proper offset
      } else {
        // Straight run: center-to-center = prevHalfW + currentHalfW
        const tileX = x + dir * (prevHalfW + halfW);
        positions[i] = {
          x: tileX,
          y,
          orientation,
          isBend: false,
          flipped: localFlipped,
        };
        x = tileX;
        prevHalfW = halfW;

        openValue = newEnd;
      }

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }

    return { bendUp: up };
  }

  // Left arm: walk backward from center
  const leftState = walkArm(centerIdx - 1, -1, true, leftOpenValue);

  // Right arm: walk forward from center, continuing left arm's bend state
  walkArm(centerIdx + 1, 1, leftState.bendUp, rightOpenValue);

  // Centering offsets: shift so visual bounding box is centered at (0,0)
  let visualMinX = Infinity;
  let visualMaxX = -Infinity;
  let visualMinY = Infinity;
  let visualMaxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const w = positions[i].orientation === "vertical" ? V_TILE_W : H_TILE_W;
    const h = positions[i].orientation === "vertical" ? V_TILE_H : H_TILE_H;
    const left = positions[i].x - w / 2;
    const right = positions[i].x + w / 2;
    const top = positions[i].y - h / 2;
    const bottom = positions[i].y + h / 2;
    if (left < visualMinX) visualMinX = left;
    if (right > visualMaxX) visualMaxX = right;
    if (top < visualMinY) visualMinY = top;
    if (bottom > visualMaxY) visualMaxY = bottom;
  }
  const offsetX = -(visualMinX + (visualMaxX - visualMinX) / 2);
  const offsetY = -(visualMinY + (visualMaxY - visualMinY) / 2);
  for (let i = 0; i < n; i++) {
    positions[i].x += offsetX;
    positions[i].y += offsetY;
  }

  const boardWidth = visualMaxX - visualMinX;
  const boardHeight = visualMaxY - visualMinY;

  return { positions, boardWidth, boardHeight };
}
