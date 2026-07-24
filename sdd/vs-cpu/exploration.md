# Exploration: Play vs CPU (Practice Mode)

## Current State

### Game Engine Architecture
The game logic is split across three layers:

1. **`packages/shared/src/game/`** — Pure, immutable game functions:
   - `board.ts`: `canPlay()`, `place()`, `isBlocked()`, `createBoard()`
   - `turn.ts`: `advanceTurn()`, `calculateDeadline()`, `checkTurnTimeout()`, `getFirstPlayer()`
   - `match.ts`: `initializeMatch()`, `startHand()`, `redealHand()`, `playTile()`, `passTurn()`, `checkTimeout()`, `handleHandEnd()`
   - `scoring.ts`: `scoreHand()`, `applyHandResult()`, `checkMatchEnd()`, `getPairIndex()`
   - `deck.ts`: `createDeck()`, `shuffle()`, `deal()`
   - `player.ts`: `createPlayer()`, `removeTile()`, `hasTile()`, `sumHand()`, `allPlayersPassed()`

2. **`packages/backend/src/game/`** — Server-side orchestration:
   - `handler.ts`: Routes WS messages to shared game functions, persists to store, records moves
   - `store.ts`: In-memory `Map<string, MatchState>` for active matches
   - `bot.ts`: **Already has `findBotMove()` and `executeBotTurns()`** — a working bot AI that prefers doubles, sorts by pip count
   - `connection.ts`: Handles disconnect/reconnect/abandonment/forfeit

3. **`packages/frontend/src/lib/game/`** — Client-side engine abstraction:
   - `types.ts`: `GameEngine` interface with `playTile()`, `pass()`, `processBotTurns()`, `destroy()`, `remote` flag
   - `local-engine.ts`: `LocalGameEngine` — wraps shared functions, `remote = false`, **but `processBotTurns()` is a NO-OP**
   - `ws-engine.ts`: `WsGameEngine` — delegates to server via WS, `remote = true`
   - `bot.ts`: **EMPTY STUB** — `// Bot logic has been removed`

### Match Creation Flow
- **Online**: Matchmaker (`matchmaking.ts`) pairs players → `POST /api/v1/dev/create-match` creates match in store → players connect via WS
- **Dev**: `POST /api/v1/dev/create-match` creates a match with random deal, returns `{ matchId }`
- **Frontend**: Match page at `(game)/match/[id]/page.tsx` connects via `useWebSocket` hook → receives `game_state` → initializes `WsGameEngine` → syncs to Zustand store

### Frontend State Management
- Zustand store (`game-store.ts`) holds: `game` (board, scores, players, hand, turn), `ui` (selection, error), `engine` (GameEngine instance), `handOver`
- `initEngine(match)` creates a `LocalGameEngine` with playerIndex 0
- `setEngine(engine)` swaps in a `WsGameEngine` when WS connects
- `playTile(side)` and `pass()` check `engine.remote` to decide local vs remote path
- **Key**: The store already supports both local and remote engines — the branching logic exists

### Bot AI (Backend)
The backend `bot.ts` has a working `findBotMove()`:
- Empty board → play any tile (prefer doubles)
- Non-empty board → collect all valid moves, sort by `(pipSum * 10) + (isDouble ? 100 : 0)` descending
- Returns `{ tileId, side }` or `null` (must pass)
- `executeBotTurns(store, matchId)` loops through bot turns until human's turn or match ends

### Current Gaps for CPU Mode
1. **No entry point**: No "Play vs CPU" button in lobby
2. **No CPU route**: No `/cpu` or similar route
3. **Frontend bot.ts is empty**: Bot AI not available on client
4. **LocalGameEngine.processBotTurns() is a no-op**: Doesn't execute bot turns
5. **Match page is WebSocket-only**: Uses `useWebSocket` unconditionally — no local mode
6. **No result screen for CPU**: `GameStatusOverlay` exists but needs adaptation for "You won" / "You lost" (human is always pair 0)

## Affected Areas

### Files to Create
- `packages/frontend/src/lib/game/bot.ts` — Frontend bot AI (port from backend bot.ts)
- `packages/frontend/src/app/(game)/cpu/page.tsx` — CPU match page (or reuse match/[id] with local mode)
- `packages/frontend/src/app/(dashboard)/lobby/_components/play-vs-cpu-button.tsx` — Lobby button

### Files to Modify
- `packages/frontend/src/lib/game/local-engine.ts` — Implement `processBotTurns()` using bot AI
- `packages/frontend/src/stores/game-store.ts` — Add CPU match initialization action
- `packages/frontend/src/app/(dashboard)/lobby/page.tsx` — Add "Play vs CPU" card
- `packages/frontend/src/app/(game)/match/[id]/page.tsx` — Support local engine mode (skip WS when local)
- `packages/frontend/src/components/game/game-status-overlay.tsx` — Adapt for CPU mode result screen

### Files Unchanged
- `packages/shared/src/game/*` — Pure functions, no changes needed
- `packages/backend/*` — No backend changes (CPU mode is fully client-side)
- `packages/frontend/src/hooks/use-websocket.ts` — Not used in CPU mode

## Approaches

### Approach A: Frontend-Only (Recommended)
Run the entire game in the browser using `LocalGameEngine` + frontend bot AI.

**Pros:**
- Zero backend changes — no server load, no DB writes
- Instant startup — no matchmaking, no WS connection
- Simple architecture — all logic in the frontend
- Easy to test and debug
- Already 80% implemented (LocalGameEngine + shared game functions)

**Cons:**
- Bot logic duplicated between backend and frontend (mitigated: shared game functions are reused)
- CPU processing happens on main thread (acceptable for 3 bots)
- No anti-cheat (acceptable for practice mode)

**Effort:** Low-Medium

### Approach B: Backend Bot with WS
Create matches on the backend with bot players, connect via WS like normal.

**Pros:**
- Reuses existing WS infrastructure
- Server-side anti-cheat maintained
- Single bot implementation

**Cons:**
- Requires backend changes (new route, bot player creation)
- WS connection overhead for a local game
- More complex for a "simple" practice mode
- Backend must handle bot turns with timers

**Effort:** Medium-High

### Approach C: Hybrid (Backend Deal + Local Play)
Backend creates match and deals tiles, sends initial state to client, then client plays locally with bots.

**Pros:**
- Server-verified deal (no client-side randomness concerns)
- Minimal backend changes

**Cons:**
- Still requires WS connection for initial deal
- Over-engineered for practice mode
- Adds unnecessary complexity

**Effort:** Medium

## Recommendation

**Approach A: Frontend-Only.** The infrastructure is already 80% there:
- `LocalGameEngine` already wraps shared game functions
- The Zustand store already supports local vs remote via `engine.remote`
- The shared game functions (`playTile`, `passTurn`, etc.) work identically on client and server
- The backend bot AI (`findBotMove`) can be ported to the frontend with minimal changes
- `processBotTurns()` on `LocalGameEngine` just needs to call `findBotMove()` in a loop

The key insight: **the shared package IS the game engine**. Both backend and frontend import from it. The frontend can run the entire game loop locally without any server involvement.

## Risks

1. **Bot logic duplication**: The backend and frontend will each have a `findBotMove()`. Mitigation: the function is ~40 lines and uses the same shared `canPlay()` from `@domino/shared`. If we want to share, we could move `findBotMove` to the shared package, but that couples AI logic to shared types.

2. **Main thread blocking**: 3 bots executing synchronously on the main thread could cause UI jank. Mitigation: bots are simple (no deep search), and we can add `setTimeout` delays between bot turns for visual feedback.

3. **Match page WS dependency**: The current match page unconditionally calls `useWebSocket`. We need to conditionally skip WS when in CPU mode. Mitigation: Add a `mode` query param or use a separate route.

4. **Timer/timeout in CPU mode**: The `TurnTimer` component shows a 45s countdown. In CPU mode, bots should play faster (no real timeout). Mitigation: Disable the turn timer in local mode or use a shorter interval.

5. **Result screen**: The `GameStatusOverlay` currently shows "Pareja X Gana" — for CPU mode, it should say "You Won" / "You Lost" since the human is always in pair 0.

## Ready for Proposal

**Yes** — All integration points are identified, the recommended approach is clear (frontend-only with ~80% existing infrastructure), and the risks are manageable. The orchestrator can proceed to the proposal phase.
