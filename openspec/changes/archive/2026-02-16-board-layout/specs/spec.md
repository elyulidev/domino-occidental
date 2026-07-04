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

First played tile MUST stay centered in viewport regardless of board length. All coordinates offset so anchor sits at container center.

- Scenario: Centered in long board — GIVEN 10 tiles; WHEN board renders; THEN first tile SHALL be at container horizontal center.
- Scenario: Single tile — GIVEN only first tile; WHEN board renders; THEN tile SHALL appear at container center.

### Requirement: R5 — Responsive Sizing

Board SHALL render correctly from 320px (mobile) to 1200px+ (desktop). Tile dimensions SHALL derive from DominoTile md size (64×88 vertical). Container SHALL use fixed max-width.

- Scenario: Mobile — GIVEN viewport 320px; WHEN board renders 6 tiles; THEN tiles SHALL fit without overflow; AND bends SHALL insert at correct edge.
- Scenario: Desktop — GIVEN viewport 1200px; WHEN board renders same 6 tiles; THEN more tiles SHALL fit before first bend versus mobile.

### Requirement: R6 — Tile Animation

New tiles SHOULD animate in via CSS transitions (all 0.3s ease) on transform and opacity.

- Scenario: Animates in — GIVEN a tile added to board state; WHEN board re-renders; THEN tile SHALL transition from invisible/offset to final position over 300ms.

### Requirement: R7 — Container Resizing

Board MUST recalculate coordinates on container resize via ResizeObserver, debounced to 100ms minimum.

- Scenario: Wider container — GIVEN 8 tiles where 6th is a bend; WHEN container widens by 200px; THEN positions SHALL recalculate; AND bend MAY shift later if tiles now fit without bending.

### Requirement: R8 — Edge Cases

Board SHALL handle: single tile, many tiles, left-only, right-only, mixed sides.

- Scenario: Many tiles — GIVEN 20 tiles in serpentine; WHEN board renders; THEN tiles SHALL form multiple alternating bends; AND all within container bounds.
- Scenario: Left-only — GIVEN all tiles extend left of first; WHEN board renders; THEN first tile SHALL remain centered; AND left tiles SHALL bend at left edge.
- Scenario: Right-only — GIVEN all tiles extend right of first; WHEN board renders; THEN first tile SHALL remain centered; AND right tiles SHALL bend at right edge.
- Scenario: Mixed sides — GIVEN tiles extend both left and right of first; WHEN board renders; THEN chain SHALL bend independently on each side.
