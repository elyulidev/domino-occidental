# Tasks: Board Avatars & Play Animation

## Task Breakdown

### T1: Add `avatarUrls` to shared types
**Files**: `packages/shared/src/types.ts`
**Description**: Add `avatarUrls: [string, string, string, string]` to `SanitizedMatchState` type. This is the canonical type used by both server and client.
**Verification**: TypeScript compiles without errors; existing tests pass.
**Estimated lines**: +1

### T2: Expand `playerNamesStore` to include avatar URLs
**Files**: `packages/backend/src/game/store.ts`
**Description**:
- Rename internal type from `PlayerNameEntry` to `PlayerProfile` with `{ name: string; avatarUrl: string }`
- Rename `playerNamesStore` → `playerProfilesStore`
- Update `setPlayerNames` → `setPlayerProfiles` and `getPlayerNames` → `getPlayerProfiles`
- Export both old and new names for backward compatibility during migration
**Verification**: Backend compiles; existing `store.test.ts` passes after updating imports.
**Estimated lines**: +12

### T3: Fetch `avatar_url` from profiles in match creation
**Files**: `packages/backend/src/game/matchmaking.ts`
**Description**:
- In `resolvePartner()`: add `avatarUrl` to the raw SQL SELECT (fallback to `''` if null)
- In `fetchPlayerNames()` → rename to `fetchPlayerProfiles()`: add `avatar_url` to Drizzle query, map to `{ name, avatarUrl }` shape
- Update callers in `server.ts` to use new function name
**Verification**: `matchmaking.test.ts` passes; `fetchPlayerProfiles` returns avatar URLs.
**Estimated lines**: +14

### T4: Include `avatarUrls` in `sanitizeState()`
**Files**: `packages/shared/src/handler.ts`
**Description**:
- In `sanitizeState()`: accept player profiles as parameter (or read from game state)
- Add `avatarUrls: [p0.avatarUrl, p1.avatarUrl, p2.avatarUrl, p3.avatarUrl]` to the sanitized output
- Fallback: if profiles not available, use `['', '', '', '']`
**Verification**: `handler.test.ts` passes; `sanitizeState()` output includes `avatarUrls` tuple.
**Estimated lines**: +6

### T5: Update `game-store.ts` to store `avatarUrls`
**Files**: `packages/frontend/src/stores/game-store.ts`
**Description**:
- Add `avatarUrls: [string, string, string, string]` to `GameState` interface
- In `applyWsUpdate()`: copy `avatarUrls` from incoming state
- In `syncGameState()`: include `avatarUrls`
- Add `disconnectedSince: Map<string, number | null>` for tracking disconnect timestamps
**Verification**: Frontend compiles; store tests pass.
**Estimated lines**: +20

### T6: Create `PlayerAvatar` component
**Files**: `packages/frontend/src/components/game/player-avatar.tsx` (NEW)
**Description**:
- Circular avatar component (64px desktop, 40px mobile via `useMediaQuery` or Tailwind `sm:` breakpoint)
- If `avatarUrl` is non-empty: render `<img>` with `rounded-full`
- If empty: render SVG default avatar (simple person silhouette, ~20 lines of SVG)
- Active highlight: `ring-2 ring-yellow-400 animate-pulse` when `isActive`
- Disconnected gray-out: `grayscale opacity-50` after 30s from `disconnectedSince`
- Accept `avatarRef` for WAAPI coordinate calculation
**Verification**: Component renders; shows default SVG when no URL; highlight toggles; gray-out after timeout.
**Estimated lines**: +110

### T7: Integrate avatars into `game-board.tsx`
**Files**: `packages/frontend/src/components/game/game-board.tsx`
**Description**:
- Render 4 `PlayerAvatar` components around the board container
- Position with CSS absolute: bottom (self), left (P2), top (P3/partner), right (P4)
- Seat mapping: `seatIndex = (playerIndex - currentPlayerIndex + 4) % 4`
- Pass `isActive` based on `turn.currentTurn === playerIndex`
- Pass `isConnected` and `disconnectedSince` from player state
- Read `avatarUrls` from game store
**Verification**: 4 avatars render at correct positions for each seat perspective.
**Estimated lines**: +40

### T8: Create tile animation system
**Files**: `packages/frontend/src/components/game/board-tile.tsx` (NEW) or inline in `game-board.tsx`
**Description**:
- Extract tile rendering into a component with `useRef` for the DOM element
- Detect new tile: compare `board.tiles.length` via `useRef` (existing pattern)
- When new tile appears: calculate avatar origin coords from `avatarRef.current.getBoundingClientRect()`
- Calculate target coords from tile's `left`/`top` in grid layout space
- Reverse pan/zoom: `originX = (screenX - containerRect.left - pan.x) / zoom`
- Execute WAAPI: `element.animate([{...}, {...}], { duration: 400, easing: 'ease-out' })`
- Respect `prefers-reduced-motion`: skip animation if true
**Verification**: New tile animates from avatar to position; rapid plays don't conflict; reduced-motion skips animation.
**Estimated lines**: +85

### T9: Update server callers
**Files**: `packages/backend/src/server.ts`
**Description**: Update imports and calls from `fetchPlayerNames` → `fetchPlayerProfiles`, `setPlayerNames` → `setPlayerProfiles`.
**Verification**: Server compiles and starts; match creation includes avatar URLs.
**Estimated lines**: +5 (mostly rename)

### T10: Run all tests and verify
**Files**: N/A
**Description**: Run `bun test` across all packages. Fix any regressions. Verify `bun run build` succeeds.
**Verification**: All tests pass; build succeeds; no TypeScript errors.
**Estimated lines**: 0 (verification only)

---

## Dependency Graph

```
T1 (shared types) ─┬─→ T2 (store) ─→ T3 (matchmaking) ─→ T4 (sanitize) ─→ T9 (server callers)
                    │
                    └─→ T5 (frontend store) ─→ T6 (PlayerAvatar) ─→ T7 (board integration) ─→ T8 (animation)
                                                                                                  │
                                                                                                  └─→ T10 (verify)
```

## Parallelizable
- T1 is prerequisite for everything
- T2/T5 can run in parallel (backend store vs frontend store)
- T3/T4 are sequential (backend chain)
- T6/T7/T8 are sequential (frontend chain)
- T9 depends on T3+T4
- T10 depends on all

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Total estimated lines | ~292 |
| New files | 2 (`player-avatar.tsx`, `board-tile.tsx`) |
| Modified files | 5 (`types.ts`, `store.ts`, `matchmaking.ts`, `handler.ts`, `game-board.tsx`, `game-store.ts`, `server.ts`) |
| Chained PRs recommended | **No** (under 400-line budget) |
| Risk | **Low** — additive changes, no breaking API changes, no migration needed |
| Backend tests affected | `store.test.ts`, `matchmaking.test.ts`, `handler.test.ts` |
| Frontend tests affected | `game-board.tsx` (if tests exist) |
