# Design: Match Interface — Local Bot Game UI

## Technical Approach

Two-layer architecture: **engine** (pure logic adapter) and **UI** (Zustand store + React components). `GameEngine` interface so swapping local→WS changes one file.

Move pure game functions from `@domino/backend/src/game/` to `@domino/shared/src/game/` — zero server-only deps. Engine wraps them; store consumes engine; React renders from selectors.

## Architecture Decisions

### Engine abstraction

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `GameEngine` interface facade | More code upfront; clean WS swap | **Chosen** |
| Direct imports in store | Less code; hard to swap later | Rejected |

Interface: `{ state, hand, playerIndex, playTile(tileId, side), pass(), destroy() }`. `LocalGameEngine` wraps shared functions; WS adapter implements same shape.

### Store shape

| Slice | Fields |
|-------|--------|
| `game` | board, scores, players, ownHand, turn, status |
| `ui` | selectedTileId, connectionStatus, error |

Actions dispatch to engine → events → store applies. Zustand over Redux: less boilerplate, React Compiler-friendly.

### Route group

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `(game)/match/[id]` outside dashboard | Full viewport, no sidebar logic | **Chosen** |
| `(dashboard)/match/[id]` with sidebar suppression | Fragile pathname detection | Rejected |

Page is `"use client"`. Navigation: `useRouter().push("/lobby")`.

### Component tree

```
page → GameLayout (viewport grid)
  ├── OpponentPanel (×3: name, handSize, isConnected)
  ├── GameBoard (domino line-of-play, tile orientation)
  ├── PlayerHand (select tile → choose side)
  ├── ScorePanel (pair scores, round, target 200)
  ├── TurnTimer (45s countdown)
  └── GameStatusOverlay (hand/match ended + return button)
```

No prop drilling — all components read Zustand selectors.

### Bot & rendering

**Bot**: first valid tile (hand order) or pass. `setTimeout(fn, 1–2s)` after human action. No AI.

**Tiles**: DOM divs (`w-12 h-20`) with CSS pip rendering. Orientation via `rotate`. ~30 lines per tile.

## Data Flow

```
Click tile → selectTile(id) → ui.selectedTileId set
Click side → playTile(tileId, side) → engine.playTile()
  → engine returns { events, match }
  → store applies events → re-render
  → next turn bot? → setTimeout → engine.botPlay()
  → store applies → re-render
Match ends → status="finished" → overlay → router.push("/lobby")
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/game/` (6 files) | Move | board, player, deck, turn, scoring, match |
| `packages/backend/src/game/` (6 files) | Update | Import from `@domino/shared/src/game/` |
| `packages/frontend/src/app/(game)/match/[id]/page.tsx` | Create | `"use client"` — engine init, game layout |
| `packages/frontend/src/stores/game-store.ts` | Create | Zustand store (game + UI slices) |
| `packages/frontend/src/lib/game/types.ts` | Create | `GameEngine` interface |
| `packages/frontend/src/lib/game/local-engine.ts` | Create | LocalEngine: wraps shared + bot logic |
| `packages/frontend/src/lib/game/bot.ts` | Create | `chooseBotMove(hand, board) → move | null` |
| `packages/frontend/src/components/game/game-board.tsx` | Create | Board tiles renderer |
| `packages/frontend/src/components/game/player-hand.tsx` | Create | Hand + selection UI |
| `packages/frontend/src/components/game/opponent-indicator.tsx` | Create | Opponent cards |
| `packages/frontend/src/components/game/score-panel.tsx` | Create | Pair scores display |
| `packages/frontend/src/components/game/turn-timer.tsx` | Create | 45s countdown |
| `packages/frontend/src/components/game/game-status-overlay.tsx` | Create | Hand/match ended overlays |
| `packages/frontend/package.json` | Modify | Add `zustand` |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | Bot logic (first valid, pass) | Pure fn tests |
| Unit | Store action→event→state | Mock engine |
| Unit | Engine interface conformance | Known deck seeds |
| Regression | All backend tests | `bun test` |
| Visual | Components | Manual |

## Migration

Copy game files to shared. Update backend imports. Frontend imports from shared. No data migration.

## Open Questions

- React Compiler: ensure selectors return primitive/simple objects for stable memoization.
- Tile orientation CSS: confirm `rotate` approach before building.
