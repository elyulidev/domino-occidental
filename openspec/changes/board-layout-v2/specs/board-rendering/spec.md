# Delta for board-rendering

## ADDED Requirements

### Requirement: R9 — Abstract BoardPath

The system MUST maintain an abstract path model (`BoardPath`) independent of pixel dimensions. Slots SHALL know their index, row, column, direction, and corner status. Row width SHALL be determined at render time by the LayoutEngine, not precomputed.

(Implements 3-layer architecture: BoardPath → LayoutEngine → React)

- **Scenario: Path generation** — GIVEN a double-9 set; WHEN BoardPath is generated; THEN it MUST contain 109 slots (0–108) in a serpentine pattern; AND each slot SHALL have unique index, col, row, direction, and isCorner.
- **Scenario: Slot index range** — GIVEN an empty board; WHEN querying available slots; THEN center tile SHALL occupy slot 0; right arm SHALL extend 0→1→2…; left arm SHALL extend 0→−1→−2…
- **Scenario: Path is deterministic** — GIVEN the same seed/parameters; WHEN generating BoardPath twice; THEN both outputs SHALL be identical.

### Requirement: R10 — LayoutEngine Pure Function

The system MUST compute pixel positions via a pure function `(display: PlacedTile[], centerIdx: number, containerWidth: number) → TilePosition[]` with no React or DOM dependencies. It SHALL produce pixel output identical to the current `calculateSerpentineLayout` for the same input.

- **Scenario: Identity with current algorithm** — GIVEN 8 tiles at 600px width; WHEN LayoutEngine computes positions; THEN each (x, y) SHALL match `calculateSerpentineLayout` output within 0.5px.
- **Scenario: No side effects** — GIVEN an input array; WHEN LayoutEngine runs; THEN the input array SHALL NOT be mutated; AND the output SHALL be a new array.
- **Scenario: Empty input** — GIVEN an empty display array; WHEN LayoutEngine runs; THEN it SHALL return an empty array.

### Requirement: R11 — Flipped Field on PlacedTile

`PlacedTile` MUST include a `flipped: boolean` field computed at placement time by `place()`. `flipped` SHALL be `true` when the tile's top value connects to the existing end (requiring visual swap on display), `false` otherwise.

- **Scenario: Right-side connecting value** — GIVEN a board with rightEnd=5; WHEN a tile (5, 3) is placed on right; THEN `flipped` MUST be `true`; AND the renderer SHALL NOT perform additional swap logic.
- **Scenario: Left-side connecting value** — GIVEN a board with leftEnd=3; WHEN a tile (6, 3) is placed on left; THEN `flipped` MUST be `false`; AND renderer SHALL display tile as-is.

### Requirement: R12 — SlotIndex Field on PlacedTile

`PlacedTile` MUST include a `slotIndex: number` field set at placement time. The center tile SHALL have `slotIndex = 0`. Right-side extensions SHALL use positive indices (1, 2, 3…), left-side SHALL use negative (−1, −2, −3…).

- **Scenario: Right extension** — GIVEN a board with center placed; WHEN 3 tiles are played on the right; THEN their slotIndices SHALL be 1, 2, 3 in placement order.
- **Scenario: Left extension** — GIVEN a board with center placed; WHEN 2 tiles are played on the left; THEN their slotIndices SHALL be −1, −2 in placement order.

### Requirement: R13 — Invariant Test Coverage

The system MUST provide tests verifying: no tile overlap, correct orientation assignment, correct `flipped` calculation, and responsive layout consistency across container widths.

- **Scenario: No overlap** — GIVEN 20 tiles in a full serpentine; WHEN positions are computed; THEN no two tiles SHALL share a bounding box intersection.
- **Scenario: Correct orientation** — GIVEN any tile set; WHEN LayoutEngine assigns orientations; THEN every tile SHALL be `horizontal` or `vertical`; AND center tile SHALL always be `vertical`.
- **Scenario: Responsive consistency** — GIVEN the same 8 tiles at 320px, 600px, and 1200px widths; WHEN positions are computed; THEN the order of tiles SHALL be identical; AND more tiles SHALL fit before first bend at larger widths.

## MODIFIED Requirements

### Requirement: R3 — Simplified Orientation

LayoutEngine SHALL assign ONLY `horizontal` or `vertical` orientation. No L-tile, perpendicular, corner-right, or corner-left orientations exist. Orientation is determined by BOTH position AND tile type:

- First (center) tile → VERTICAL
- Non-double tiles in horizontal runs (left/right arms) → HORIZONTAL
- **Double tiles in horizontal runs** → **VERTICAL** (doubles preserve their orientation)
- Bend tiles (at container edge changing direction) → VERTICAL, regardless of double status

(Previously: 5 possible orientations including corner-right, corner-left, perpendicular, horizontal-flipped, and horizontal)

- **Scenario: Non-double in horizontal run** — GIVEN a 6/9 tile mid-chain in a horizontal segment; WHEN LayoutEngine computes positions; THEN tile orientation MUST be `horizontal`.
- **Scenario: Double in horizontal run** — GIVEN a 4/4 double mid-chain in a horizontal segment; WHEN LayoutEngine computes positions; THEN tile orientation MUST be `vertical`.
- **Scenario: Regular tile at bend** — GIVEN a 6/9 tile at container edge bend position; WHEN LayoutEngine computes positions; THEN tile orientation MUST be `vertical`.
- **Scenario: Double at bend** — GIVEN a 9/9 double at edge bend; WHEN LayoutEngine computes positions; THEN tile orientation MUST be `vertical`.
- **Scenario: First tile double** — GIVEN board starts with a 6/6 double; WHEN LayoutEngine computes positions; THEN tile orientation MUST be `vertical`.

### Requirement: R14 — Square Sub-Cell Grid Sizing

Each half of a domino tile SHALL occupy exactly one square cell (`CELL × CELL` px). This ensures a grid where tiles align without overlap and the board follows a chessboard-like coordinate system.

Tile dimensions derived from the square cell:
- Half-tile (one side): `CELL × CELL`
- Horizontal tile (two halves side-by-side): `2*CELL × CELL` (ratio 2:1)
- Vertical tile (two halves stacked): `CELL × 2*CELL` (ratio 1:2)

Default cell size: `CELL = 48px`.

- **Scenario: Horizontal tile dimensions** — GIVEN CELL=48; WHEN computing horizontal tile size; THEN WIDTH MUST be 96px; AND HEIGHT MUST be 48px.
- **Scenario: Vertical tile dimensions** — GIVEN CELL=48; WHEN computing vertical tile size; THEN WIDTH MUST be 48px; AND HEIGHT MUST be 96px.
- **Scenario: No overlap guarantee** — GIVEN tiles placed in adjacent grid cells; WHEN computing bounding boxes; THEN no two tiles SHALL overlap because each half occupies a discrete CELL-sized area.

## REMOVED Requirements

(No requirements removed — R3 is modified, behavior is refactored not removed.)

## RENAMED Requirements

(No requirements renamed.)
