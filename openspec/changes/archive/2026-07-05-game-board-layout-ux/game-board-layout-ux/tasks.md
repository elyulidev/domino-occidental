# Tasks: Game Board Layout & UX

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 200-280 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: layout restructure, PR 2: board pan+zoom |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Layout restructure (2-column grid, sidebar stack) | PR 1 | Base: feature/tracker branch |
| 2 | Board pan+zoom (drag, scroll, pinch, buttons) | PR 2 | Base: PR #1 branch |

## Phase 1: Layout Restructure (PR 1)

- [x] 1.1 Add `direction` prop to OpponentIndicator (supports "vertical" | "horizontal", default "horizontal")
- [x] 1.2 Add `compact` prop to TurnTimer (removes padding and border, renders as slim bar+label)
- [x] 1.3 Restructure `packages/frontend/src/app/(game)/match/[id]/page.tsx`: change `grid-cols-[220px_1fr_140px]` → `grid-cols-[260px_1fr]` on lg+, move OpponentIndicator + TurnTimer inside left panel with `flex-col`, add `overflow-y-auto` to left panel
- [x] 1.4 Verify: Page renders correct 2-column grid at ≥1024px, mobile (<lg) unchanged

## Phase 2: Board Pan + Zoom (PR 2)

- [x] 2.1 Add `PanZoomState` to `packages/frontend/src/components/game/game-board.tsx`: panX, panY, zoom, isDragging, dragStart; implement `onMouseDown`, `onMouseMove`, `onMouseUp` for drag-to-pan with 5px threshold
- [x] 2.2 Add scroll-wheel zoom: `onWheel` handler calculates zoom increment at cursor, clamps 0.25x–3x
- [x] 2.3 Add touch support: `touchstart`/`touchmove`/`touchend` handlers with `touch-action: none`, pinch-to-zoom detection using touch distance
- [x] 2.4 Add +/- zoom buttons overlay: click to increment/decrement zoom by 0.25x, positioned bottom-right of board container
- [x] 2.5 Add double-click/tap handler: reset zoom to 1x, pan to (0,0)
- [x] 2.6 Verify: Drag only activates when >5px movement, zoom buttons visible and functional, transform wrapper preserves existing tile absolute positioning

## Phase 3: Testing

- [ ] 3.1 Write unit tests: zoom clamp utilities, pan boundary calculations, click vs drag threshold logic
- [ ] 3.2 Component test: `OpponentIndicator` renders with `direction="vertical"` (expects `flex-col`)
- [ ] 3.3 Manual testing: drag board, zoom via wheel/buttons/pinch, double-click reset, ensure tile clicks still work, verify sidebar scroll independence