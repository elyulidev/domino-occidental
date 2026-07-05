# Board Rendering Specification

## Purpose

Visual layout of the domino board — serpentine path generation, coordinate calculation, responsive sizing, tile positioning and orientation. Pure frontend capability.

## Requirements

### Requirement: R1 — Serpentine Path Formation

Tiles MUST form a single connected chain (serpentine), not disconnected rows. Board SHALL walk tiles sequentially, calculating absolute coordinates along the path.

- Scenario: Tiles form chain — GIVEN 5 tiles to display; WHEN board calculates coordinates; THEN each tile MUST be adjacent to previous in path order; AND tiles SHALL NOT split into separate rows.
- Scenario: Empty board — GIVEN no tiles played; WHEN board renders; THEN empty container SHALL display.

### Requirement: R2 — Bend Tile Placement

At container edge, a vertical bend tile MUST change direction. Direction SHALL alternate (up, down, up...). Board accumulates horizontally from center; at edge, insert bend and continue opposite.

- Scenario: Bend at right edge — GIVEN tiles reach right container edge; WHEN next tile would overflow; THEN vertical bend SHALL place at edge; AND subsequent tiles SHALL extend leftward.
- Scenario: Bend alternation — GIVEN first bend went up; WHEN second edge reached; THEN bend SHALL go down.
- Scenario: Short line — GIVEN all tiles fit within container; WHEN no overflow; THEN no bend SHALL insert.

### Requirement: R3 — Tile Orientation by Position

Tile orientation SHALL be determined by POSITION in the serpentine, not by whether the tile is a double:

- First tile → VERTICAL
- Tiles in horizontal runs (left/right arms) → HORIZONTAL, including doubles
- Bend tiles (at container edge changing direction) → VERTICAL, whether double or not

- Scenario: Double in horizontal run — GIVEN a 4/4 double mid-chain in a horizontal segment; WHEN board renders; THEN tile MUST appear HORIZONTAL (pips left-right).
- Scenario: Regular tile at bend — GIVEN a 6/9 tile at container edge bend position; WHEN board renders; THEN tile MUST appear VERTICAL.
- Scenario: Double at bend — GIVEN a 9/9 double at edge bend; WHEN board renders; THEN tile MUST appear VERTICAL (same orientation as any bend tile).
- Scenario: First tile double — GIVEN board starts with a 6/6 double; WHEN board renders; THEN tile MUST appear VERTICAL.

### Requirement: R4 — First Tile Centering

First played tile MUST start centered in viewport. User MAY pan away from center via drag. Double-click SHALL reset board to (0,0) pan, returning tile to center.
 (Previously: "Tile MUST stay centered — no panning allowed.")

- Scenario: Centered on start — GIVEN board with 10 tiles; WHEN board first renders; THEN first tile SHALL be at container horizontal center.
- Scenario: Single tile — GIVEN only first tile; WHEN board renders; THEN tile SHALL appear at container center.
- Scenario: Pan moves away from center — GIVEN first tile centered; WHEN user drags 200px right; THEN first tile SHALL shift 200px left of center.
- Scenario: Double-click resets to center — GIVEN board panned 300px off-center; WHEN user double-clicks; THEN pan SHALL reset to (0,0); AND first tile SHALL return to center.

### Requirement: R5 — Responsive Sizing (Zoom Aware)

Board SHALL render correctly from 320px to 1200px+ at default zoom (1x). Tile dimensions SHALL derive from DominoTile md size (64×88 vertical). Zoom level SHALL affect scale of rendered board via CSS transform; container layout calculations SHALL remain unaffected.
(Previously: "No zoom state — tile sizing was fixed per viewport.")

- Scenario: Mobile at 1x — GIVEN viewport 320px and zoom 1x; WHEN board renders 6 tiles; THEN tiles SHALL fit without overflow.
- Scenario: Desktop zoomed in — GIVEN viewport 1200px and zoom 2x; WHEN board renders 6 tiles; THEN fewer tiles SHALL fit before first bend versus 1x.
- Scenario: Desktop zoomed out — GIVEN viewport 1200px and zoom 0.5x; WHEN board renders same 6 tiles; THEN more tiles SHALL fit before bend versus 1x.

### Requirement: R6 — Tile Animation

New tiles SHOULD animate in via CSS transitions (all 0.3s ease) on transform and opacity.

- Scenario: Animates in — GIVEN a tile added to board state; WHEN board re-renders; THEN tile SHALL transition from invisible/offset to final position over 300ms.

### Requirement: R7 — Container Resizing (Zoom Aware)

Board MUST recalculate coordinates on container resize via ResizeObserver, debounced to 100ms minimum. Recalculation SHALL preserve current zoom and pan state — only container dimensions update.
(Previously: "Recalculation with no zoom/pan state to preserve.")

- Scenario: Wider container — GIVEN 8 tiles at 1x zoom with a bend at tile 6; WHEN container widens by 200px; THEN positions SHALL recalculate; AND bend MAY shift later.
- Scenario: Resize preserves zoom — GIVEN board at 2x zoom, panned 100px left; WHEN container grows by 100px; THEN zoom SHALL remain 2x; AND pan SHALL remain (-100, currentY).

### Requirement: R8 — Edge Cases

Board SHALL handle: single tile, many tiles, left-only, right-only, mixed sides.

- Scenario: Many tiles — GIVEN 20 tiles in serpentine; WHEN board renders; THEN tiles SHALL form multiple alternating bends; AND all within container bounds.
- Scenario: Left-only — GIVEN all tiles extend left of first; WHEN board renders; THEN first tile SHALL remain centered; AND left tiles SHALL bend at left edge.
- Scenario: Right-only — GIVEN all tiles extend right of first; WHEN board renders; THEN first tile SHALL remain centered; AND right tiles SHALL bend at right edge.
- Scenario: Mixed sides — GIVEN tiles extend both left and right of first; WHEN board renders; THEN chain SHALL bend independently on each side.
