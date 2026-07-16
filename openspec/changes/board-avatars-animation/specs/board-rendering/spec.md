# Delta for Board Rendering

## MODIFIED Requirements

### Requirement: R6 — Tile Animation

New tiles SHALL animate from the source player's avatar position to their final grid coordinate over 400ms using CSS `@keyframes` or the Web Animations API (`element.animate()`). No external animation library is permitted. The system MUST detect new tiles by comparing `board.tiles.length` between renders; the last tile in the array is the new play. Animation MUST originate from the avatar's screen center (not from a fixed point). The `prefers-reduced-motion: reduce` media query MUST disable the animation while preserving the final visual state.

(Previously: Tiles animate in via CSS transitions on transform and opacity over 300ms from an offset position.)

#### Scenario: Animates from avatar

- GIVEN a new tile added to `board.tiles` with `playerId = 'P3'`
- WHEN board re-renders and detects the length increase
- THEN the tile MUST animate from P3 avatar's screen center to final grid position
- AND animation duration MUST be 400ms
- AND the tile MUST be fully opaque at final position

#### Scenario: Reduced motion

- GIVEN user OS has `prefers-reduced-motion: reduce`
- WHEN a new tile is added to the board
- THEN the tile MUST appear instantly at its final position
- AND no translate/opacity animation SHALL execute

#### Scenario: Detection by length comparison

- GIVEN previous render had N tiles in `board.tiles`
- WHEN current render has N+1 tiles
- THEN the tile at index N (last) MUST be treated as the new play
- AND `playerId` from that tile MUST identify the source avatar for animation origin
