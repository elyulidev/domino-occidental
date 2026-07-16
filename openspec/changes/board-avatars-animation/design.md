# Design: Board Avatars & Play Animation

## Technical Approach

Add player avatar rendering around the game board perimeter and animate tile plays from the source avatar to the final grid position. The server extends `SanitizedMatchState` with `avatarUrls`, the frontend renders circular avatars at fixed board-edge positions (rotated per seat index), and tile plays animate via the Web Animations API using dynamically computed start/end coordinates.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Animation API | Web Animations API vs CSS @keyframes | CSS keyframes require static `from`/`to` values; WAAPI allows runtime coordinate calculation per tile play | **Web Animations API** |
| Avatar data delivery | In `SanitizedMatchState` vs separate WS message | Extra message = extra complexity; in-state = piggybacks on existing flow, small payload (~400 bytes for 4 URLs) | **In SanitizedMatchState** |
| Avatar positioning | CSS absolute (board edges) vs CSS Grid overlay vs positioned relative to grid | Grid overlay requires layout refactoring; absolute is simple, performant, and composable with pan/zoom | **CSS absolute with fixed offsets** |
| Disconnected gray-out | Client-side timer (30s from disconnect event) vs server-side flag | Server would need new state; client already receives `player_disconnected` with `reconnectWindowMs` | **Client-side timer** |

## Data Flow

```
Server                              Client
──────                              ──────
profiles.avatar_url ─┐
                     ├─→ fetchPlayerProfiles()
playerNamesStore      │   returns { name, avatarUrl }[]
                     │
sanitizeState() ─────┘
  adds avatarUrls: [string × 4]
       │
       ▼
  WsServerMessage.state
       │
       ▼
  useWebSocket → applyWsUpdate()
       │
       ▼
  game-store: avatarUrls in GameState
       │
       ▼
  GameBoard reads avatarUrls
  └─► PlayerAvatar × 4 (absolute positioned)
  └─► BoardTile detects new tile → WAAPI animate from avatar → grid pos
```

## File Changes

| File | Action | Change | ~Lines |
|------|--------|--------|--------|
| `packages/shared/src/handler.ts` | Modify | Add `avatarUrls` to `SanitizedMatchState`; include in `sanitizeState()` | +6 |
| `packages/backend/src/game/store.ts` | Modify | Expand `playerNamesStore` shape to `{ name, avatarUrl }[]`; add `setPlayerProfiles`/`getPlayerProfiles` | +12 |
| `packages/backend/src/game/matchmaking.ts` | Modify | `fetchPlayerNames` → `fetchPlayerProfiles`; SELECT `avatar_url` alongside `username` | +14 |
| `packages/frontend/src/components/game/player-avatar.tsx` | **Create** | Circular avatar component: image/SVG fallback, active highlight, disconnected gray-out | +110 |
| `packages/frontend/src/stores/game-store.ts` | Modify | Add `avatarUrls` to `GameState`; update `applyWsUpdate` and `syncGameState`; add `disconnectedSince` Map | +20 |
| `packages/frontend/src/components/game/game-board.tsx` | Modify | Render 4 `PlayerAvatar` around board; add tile animation detection + WAAPI orchestration | +85 |
| `packages/frontend/src/components/game/board-tile.tsx` | **Create** | Extract `BoardTile` sub-component for animation isolation (ref-based WAAPI trigger) | +45 |

**Estimated total: ~292 lines (70 new, 222 modified)**

## Interfaces / Contracts

```typescript
// packages/shared/src/handler.ts — SanitizedMatchState gains:
avatarUrls: [string, string, string, string]; // indexed by seat position

// packages/backend/src/game/store.ts — expanded profile shape:
interface PlayerProfile {
  name: string;
  avatarUrl: string; // "" if null in profiles table
}
// playerNamesStore: Map<string, Map<string, PlayerProfile>>

// packages/frontend/src/components/game/player-avatar.tsx:
interface PlayerAvatarProps {
  avatarUrl: string;
  playerName: string;
  isActive: boolean;          // current turn
  isConnected: boolean;
  disconnectedSince: number | null; // Date.now() or null
  reconnectWindowMs: number;        // 30000
  size: 'sm' | 'lg';              // 40px | 64px
  seatPosition: 'bottom' | 'left' | 'top' | 'right';
  avatarRef: React.RefObject<HTMLDivElement>;
}
```

## Avatar Positioning Math

Avatars are absolutely positioned inside the board container (the `relative min-h-0 flex-1` div). Positions are fixed offsets from container edges, rotated per player's seat index:

| Seat (relative) | CSS position | Center coords (for animation) |
|-----------------|-------------|-------------------------------|
| Bottom (self) | `bottom: 8px; left: 50%; transform: translateX(-50%)` | `(containerW/2, containerH - avatarR)` |
| Left (P2) | `left: 8px; top: 50%; transform: translateY(-50%)` | `(avatarR, containerH/2)` |
| Top (P3, partner) | `top: 8px; left: 50%; transform: translateX(-50%)` | `(containerW/2, avatarR)` |
| Right (P4) | `right: 8px; top: 50%; transform: translateY(-50%)` | `(containerW - avatarR, containerH/2)` |

Seat mapping: `seatIndex = (playerIndex - currentPlayerIndex + 4) % 4` → `{ 0: bottom, 1: left, 2: top, 3: right }`.

## Animation System

### Detection
Compare `board.tiles.length` via `useRef` (existing `prevTileCount` pattern in `game-board.tsx`). When length increases, `board.tiles[N-1]` is the new tile. Extract `playerId` to identify the source avatar.

### Coordinate Calculation
1. **Avatar origin** (container coords): `avatarRef.current.getBoundingClientRect()` → subtract `boardContainer.getBoundingClientRect()` → divide by zoom, subtract pan/offset.
2. **Tile target** (pan/zoom coords): from `calculateGridLayout()` result, same space as tile's `left`/`top` inline styles.
3. **Reverse pan/zoom**: `originX = (screenX - containerRect.left - pan.x) / zoom`.

### Execution
```typescript
avatarEl.animate([
  { left: `${originX}px`, top: `${originY}px`, opacity: 0, scale: 0.8 },
  { left: `${targetX}px`, top: `${targetY}px`, opacity: 1, scale: 1 }
], { duration: 400, easing: 'ease-out', fill: 'forwards' });
```

Final state set via `onfinish` callback → React re-render places tile at grid position.

### Reduced Motion
Check `matchMedia('(prefers-reduced-motion: reduce)').matches`. If true, skip WAAPI call; tile appears instantly at final position.

### Rapid Consecutive Plays
Each tile animation is independent (separate `element.animate()` call on separate DOM nodes). No queuing needed — the board renders all tiles; animations run in parallel.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Avatar positioning math, seat rotation | Pure functions, `bun test` |
| Unit | Animation coordinate calculation | Mock `getBoundingClientRect`, verify reversed pan/zoom |
| Integration | `avatarUrls` in sanitized state | Mock `sanitizeState()`, verify tuple shape |
| Integration | `fetchPlayerProfiles` SELECT | Mock Drizzle, verify `avatar_url` in query |
| E2E | Avatar renders at correct position | Playwright: verify 4 avatar elements, check CSS positions |
| Visual | Active highlight transition | Playwright screenshot diff |

## Migration / Rollout

No database migration required — `profiles.avatar_url` already exists in schema (line 19 of `profiles.ts`). The change is purely additive: server sends new field, client renders new components. Previous clients ignore unknown fields in `SanitizedMatchState`.

## Open Questions

- None. All key decisions resolved via user input (64px/40px, circular, glow highlight, 30s gray-out, 400ms, WAAPI).
