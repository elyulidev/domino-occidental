# Proposal: Game Board Layout & UX

## Intent

The current 3-column layout wastes vertical space on opponents in the center column and a standalone TurnTimer column. As the tile chain grows, parts go off-screen with no way to navigate. Players cannot pan or zoom on any screen size.

## Scope

### In Scope
- Restructure lg+ layout from 3-col to 2-col (left panel + center)
- Move ScorePanel + TurnTimer + all opponents into scrollable left sidebar
- Keep mobile (<lg) layout unchanged
- Add CSS-transform-based pan (drag) and zoom (scroll/pinch/buttons) to GameBoard
- Add +/- zoom overlay buttons on board

### Out of Scope
- Mobile layout changes
- Tile positioning logic (unchanged)
- Opponent indicator visual redesign
- Touch gesture config or accessibility menus

## Capabilities

### New Capabilities
- `board-pan-zoom`: Game board pan and zoom via CSS transforms with drag, scroll wheel, pinch gesture, and overlay +/- buttons. Range 0.25x–3x.

### Modified Capabilities
- None — tile positioning and board rendering logic unchanged

## Approach

**Part 1 — Layout**: Grid changes from `grid-cols-[220px_1fr_140px]` to `grid-cols-[260px_1fr]` on lg+. Left panel stacks ScorePanel → compact TurnTimer → opponent indicators (vertical stack). Panel scrolls independently via `overflow-y-auto`. Right column eliminated. Tile positioning math untouched.

**Part 2 — Pan/Zoom**: Wrap GameBoard tiles in a CSS transform layer. State: `{ panX, panY, zoom }`. Drag pan with 5px click/drag threshold. Scroll/pinch zoom at cursor position. Double-click resets to 1x/center. +/- buttons bottom-right. Custom impl (~150 lines), no library.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `match/[id]/page.tsx` | Modified | 3-col→2-col grid, opponents+timer to left panel |
| `game-board.tsx` | Modified | Pan/zoom state, drag handlers, transform layer, zoom controls |
| `opponent-indicator.tsx` | Modified | Accept `direction` prop for vertical mode |
| `turn-timer.tsx` | Minor | Compact variant for sidebar placement |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Drag interferes with tile click | Med | 5px threshold + pointer-events on separate layer |
| Zoom breaks container width calc | Low | Transform layer wraps existing layout; ResizeObserver unaffected |
| Touch pan conflicts with page scroll | Med | Prevent default on board container; pinch-zoom separate |

## Rollback Plan

Revert the grid CSS commit and the pan/zoom commit — each is isolated. No data migration since tile positioning is untouched.

## Dependencies

None — pure frontend. No backend, DB, or API changes.

## Success Criteria

- [ ] lg+ shows 2-column grid with all elements in left sidebar
- [ ] Mobile (<lg) layout visually identical to current
- [ ] Drag-pan works on desktop (mouse) and mobile (touch)
- [ ] Zoom via scroll wheel, pinch, and +/- buttons (range 0.25x–3x)
- [ ] Double-click resets to 1x at center
- [ ] All existing board tests pass unchanged
