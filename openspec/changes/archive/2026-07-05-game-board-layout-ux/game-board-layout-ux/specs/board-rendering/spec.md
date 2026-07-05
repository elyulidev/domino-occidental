# Delta for Board Rendering

## ADDED Requirements

### Requirement: R9 — Board Pan

Board MUST support drag-to-pan via mouse and touch. A 5px threshold SHALL distinguish click from drag. Pan MUST be bounded so board center moves no more than 50% of container dimensions from each edge.

- Scenario: Drag pans board — GIVEN board extending beyond viewport; WHEN user drags 100px left; THEN panX SHALL decrease by 100px.
- Scenario: Click threshold — GIVEN user presses on a tile; WHEN mouse moves < 5px before release; THEN pan SHALL NOT activate; AND tile SHALL receive click event.
- Scenario: Touch drag — GIVEN touch device; WHEN user swipes right 200px on board; THEN panX SHALL increase by 200px.
- Scenario: Pan bounded — GIVEN board at max left pan; WHEN user continues dragging left; THEN panX SHALL NOT exceed boundary.

### Requirement: R10 — Board Zoom

Board MUST support zoom via scroll wheel (with Ctrl modifier) and pinch gesture. Zoom SHALL clamp between 0.25x and 3x. Overlay +/- buttons SHALL increment/decrement by 0.25x. Double-click SHALL reset zoom to 1x and pan to (0,0).

- Scenario: Scroll zooms at cursor — GIVEN board at 1x zoom; WHEN user scrolls up over board; THEN zoom SHALL increase to 1.25x centered at cursor position.
- Scenario: Pinch zoom — GIVEN touch device; WHEN user pinches outward; THEN zoom SHALL increase proportionally.
- Scenario: Zoom clamped — GIVEN board at 3x zoom; WHEN user continues zoom in; THEN zoom SHALL NOT exceed 3x.
- Scenario: Double-click reset — GIVEN board panned 100px and zoomed to 2.5x; WHEN user double-clicks; THEN zoom SHALL reset to 1x; AND pan SHALL reset to (0,0).
- Scenario: +/- buttons — GIVEN board at 1x zoom; WHEN user clicks + button 4 times; THEN zoom SHALL reach 2x.

### Requirement: R11 — Sidebar Layout (lg+)

On viewports ≥1024px, match page MUST use 2-column grid: `grid-cols-[260px_1fr]`. Left sidebar SHALL stack ScorePanel, compact TurnTimer, and opponent indicators vertically with `overflow-y-auto`.

- Scenario: lg+ renders 2 columns — GIVEN viewport 1280px; WHEN match page renders; THEN layout SHALL be `grid-cols-[260px_1fr]`; AND ScorePanel SHALL render in left column.
- Scenario: Sidebar scrolls independently — GIVEN sidebar content overflows; WHEN content exceeds container height; THEN sidebar SHALL show vertical scrollbar; AND SHALL NOT affect board scroll.

### Requirement: R12 — Mobile Layout Unchanged

Below 1024px (<lg), match page layout SHALL remain identical to current layout. No changes to mobile tile sizing, opponent placement, or timer position.

- Scenario: Mobile preserved — GIVEN viewport 768px; WHEN match page renders; THEN layout SHALL match current mobile layout exactly.
- Scenario: No regression — GIVEN existing mobile layout tests; WHEN run against new code; THEN all SHALL pass unchanged.

## MODIFIED Requirements

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

### Requirement: R7 — Container Resizing (Zoom Aware)

Board MUST recalculate coordinates on container resize via ResizeObserver, debounced to 100ms minimum. Recalculation SHALL preserve current zoom and pan state — only container dimensions update.
(Previously: "Recalculation with no zoom/pan state to preserve.")

- Scenario: Wider container — GIVEN 8 tiles at 1x zoom with a bend at tile 6; WHEN container widens by 200px; THEN positions SHALL recalculate; AND bend MAY shift later.
- Scenario: Resize preserves zoom — GIVEN board at 2x zoom, panned 100px left; WHEN container grows by 100px; THEN zoom SHALL remain 2x; AND pan SHALL remain (-100, currentY).
