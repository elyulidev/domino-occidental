# Design: Game Board Layout & UX

## Technical Approach

Two isolated changes delivered as a feature branch chain:

**Part 1 — Layout restructure**: Change the `lg:` grid from `[220px_1fr_140px]` to `[260px_1fr]`. Move OpponentIndicator + TurnTimer into the left panel as a vertical flex stack. ScorePanel stays on top. Left panel gets `overflow-y-auto` for independent scroll.

**Part 2 — Pan/Zoom**: Wrap the tile container in a CSS transform layer (`translate + scale`). Pan by dragging with 5px click/drag threshold. Zoom via scroll wheel, pinch gesture, and overlay +/- buttons. Range 0.25x–3x. State is local to GameBoard (ephemeral UI, not in Zustand).

Tile positioning math (`grid-layout-engine.ts`, `grid-layout.ts`) is untouched — the transform layer sits on top of existing absolute positioning.

## Architecture Decisions

### Decision: Pan/zoom mechanism — custom CSS transform vs react-zoom-pan-pinch

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Custom CSS transform | ~150 lines, full control over click/tap interference, no dep | **Chosen** |
| react-zoom-pan-pinch | 12 kB dep, opinionated API, overkill for simple translate+scale | Rejected |

**Rationale**: Board interactions are simple — translate on drag, scale on scroll/pinch. No need for an external library that would add bundle weight and potential conflicts with tile click handlers.

### Decision: Opponent indicator orientation — `direction` prop vs separate component

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `direction` prop | Same component, CSS `flex-col` vs `flex-row` switch | **Chosen** |
| Separate VerticalOpponentIndicator | Duplicates card structure | Rejected |

**Rationale**: The card internals (back tile, label, hand size, connection dot) are identical. Only the outer flex container changes. A prop keeps DRY.

### Decision: Click vs drag disambiguation — threshold tracking

**Choice**: Track `mousedown` position → if `mouseup` within 5px in both axes, treat as no-drag. Otherwise pan.
**Alternatives**: `pointer-events: auto` on tiles vs separate event layer.
**Rationale**: Board tiles have no click handlers currently, so the drag/click conflict is minimal. The 5px threshold prevents accidental pans when the user intends to click a tile in the future.

### Decision: Touch vs scroll conflict — `touch-action: none` on board

**Choice**: Set `touch-action: none` and `overflow: hidden` on the board container to prevent browser scroll/zoom interference. On pinch zoom, `e.preventDefault()` on `touchmove`.
**Alternatives**: Let browser handle vs capture all touch events.
**Rationale**: The board is a self-contained interaction surface — page scrolling happens in the sidebar, not here. CSS `touch-action: none` is the standard way to declare this.

## Data Flow

```
GameBoard (local state)
  ├── panZoom: { panX, panY, zoom, isDragging, dragStart }
  │
  ├── onMouseDown → record dragStart (x, y)
  ├── onMouseMove → if dragStart, delta > 5px → set isDragging, update panX/panY
  ├── onMouseUp → if isDragging, end drag. Else ignore (no tile click atm)
  ├── onWheel → deltaY > 0 ? zoom out : zoom in (at cursor position)
  ├── onDoubleClick → reset to panX=0, panY=0, zoom=1
  │
  └── Render transform:
        <div style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}>
          {existing absolute-positioned tiles}
        </div>

Left Sidebar (CSS grid area)
  ├── ScorePanel (unchanged)
  ├── TurnTimer compact (padding removed, bar+label only)
  └── OpponentIndicator direction="vertical"
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/frontend/src/app/(game)/match/[id]/page.tsx` | Modify | 3-col → 2-col grid on lg+. Move OpponentIndicator + TurnTimer inside left panel with `flex-col`. Add `overflow-y-auto` to left panel. |
| `packages/frontend/src/components/game/opponent-indicator.tsx` | Modify | Add `direction: "vertical" \| "horizontal"` prop. Default `"horizontal"` for backward compat. Vertical mode uses `flex-col` with centered items. |
| `packages/frontend/src/components/game/turn-timer.tsx` | Modify | Accept `compact?: boolean` prop. Compact mode removes outer `p-4` padding and border — renders as a slim bar progress + label only. |
| `packages/frontend/src/components/game/game-board.tsx` | Modify | Add pan/zoom state, drag handlers, zoom controls overlay (+/- buttons bottom-right), transform wrapper. All behind existing tile render. |

## Interfaces / Contracts

```typescript
// Local to GameBoard — not exported, not in Zustand
interface PanZoomState {
  panX: number        // pixels
  panY: number        // pixels
  zoom: number        // 0.25–3.0
  isDragging: boolean
  dragStart: { x: number; y: number } | null
}

// OpponentIndicator
interface OpponentIndicatorProps {
  direction?: "horizontal" | "vertical"  // default "horizontal"
}

// TurnTimer
interface TurnTimerProps {
  compact?: boolean  // default false
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Pan/zoom clamp utilities, zoomAtCursor center calc | Pure function tests with bun test |
| Component | Render sidebar layout at lg+ breakpoint, verify OpponentIndicator vertical mode | Component test via render + query for `flex-col` presence |
| Manual | Drag doesn't interfere with tile click, zoom range 0.25x–3x, pinch zoom | Browser test with various viewports |

## Migration / Rollout

**Strategy**: Feature branch chain (2 PRs).

**PR #1 — Layout restructure**:
- Grid CSS change, OpponentIndicator + TurnTimer in sidebar
- OpponentIndicator `direction` prop (horizontal by default — backward compatible)
- TurnTimer `compact` prop
- Tests: verify 2-col grid at lg+, sidebar renders all elements

**PR #2 — Pan/Zoom**:
- Transform wrapper, drag handlers, zoom controls
- CSS `touch-action: none` on board
- Tests: utility functions only (drag/zoom logic is DOM-event-driven, component tests limited)

No data migration — pure frontend.

## Open Questions

- [ ] Should zoom buttons be visible at all times or only on hover of board? (Design decision, not technical blocker)
- [ ] Animate pan with CSS `transition` on transform? Instant on drag, smooth on zoom button / double-click reset.
