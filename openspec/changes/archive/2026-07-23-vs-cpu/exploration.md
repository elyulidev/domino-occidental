## Exploration: Play vs CPU (Practice Mode)

### Current State

The game engine is cleanly layered:

1. **Shared package** (`packages/shared/src/game/`) — Pure, immutable game functions: `board.ts` (canPlay, place, isBlocked), `turn.ts` (advanceTurn, calculateDeadline, getFirstPlayer), `match.ts` (initializeMatch, startHand, redealHand, playTile, passTurn, checkTimeout, handleHandEnd), `scoring.ts` (scoreHand, applyHandResult, checkMatchEnd), `deck.ts` (createDeck, shuffle, deal), `player.ts` (createPlayer, removeTile, sumHand, allPlayersPassed). These work identically on client and server.

2. **Backend** (`packages/backend/src/game/`) — Server orchestration. **Critically, `bot.ts` already has a working `findBotMove()`** that prefers doubles, sorts by pip count, and returns `{ tileId, side }` or `null`. `executeBotTurns()` loops bot turns until human's turn or match ends. `handler.ts` routes WS messages. `store.ts` is an in-memory Map.

3. **Frontend** (`packages/frontend/src/lib/game/`) — `GameEngine` interface defines `playTile()`, `pass()`, `processBotTurns()`, `remote` flag. `LocalGameEngine` wraps shared functions with `remote = false`, **but `processBotTurns()` is a NO-OP**. `WsGameEngine` delegates to server via WS with `remote = true`. **`bot.ts` is an EMPTY STUB** (1-line comment).

4. **State management** — Zustand store (`game-store.ts`) already supports both local and remote engines via `engine.remote` flag. `initEngine(match)` creates `LocalGameEngine`, `setEngine(engine)` swaps in `WsGameEngine`. `playTile(side)` and `pass()` branch on `engine.remote`.

5. **Match page** (`(game)/match/[id]/page.tsx`) — Currently WebSocket-only. Uses `useWebSocket` unconditionally, which creates a `WsGameEngine` and wires it to the store.

**Key gap**: No entry point for CPU mode (no lobby button, no route), frontend bot AI is empty, `LocalGameEngine.processBotTurns()` is a no-op, and the match page has no local-mode path.

### Affected Areas

| Area | Files | Why |
|------|-------|-----|
| Bot AI | `packages/frontend/src/lib/game/bot.ts` | Empty stub — needs `findBotMove()` ported from backend |
| Local engine | `packages/frontend/src/lib/game/local-engine.ts` | `processBotTurns()` is no-op — needs bot loop |
| CPU page | `packages/frontend/src/app/(game)/cpu/page.tsx` | New route for local CPU matches |
| Lobby button | `packages/frontend/src/app/(dashboard)/lobby/_components/play-vs-cpu-button.tsx` | Entry point from lobby |
| Lobby page | `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | Add "Play vs CPU" card |
| Game store | `packages/frontend/src/stores/game-store.ts` | Add `initCpuMatch()` action |
| Match page | `packages/frontend/src/app/(game)/match/[id]/page.tsx` | Support local engine mode (skip WS) |
| Result overlay | `packages/frontend/src/components/game/game-status-overlay.tsx` | Adapt for "You Won" / "You Lost" |

### Approaches

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **A: Frontend-Only** — Run entire game in browser via `LocalGameEngine` + frontend bot AI | Zero backend changes, instant startup, already 80% implemented, no server load | Bot logic duplicated (~40 lines), main thread blocking (acceptable for 3 bots), no anti-cheat (acceptable for practice) | Low-Medium |
| **B: Backend Bot + WS** — Create matches on backend with bot players, connect via WS | Reuses WS infra, server-side anti-cheat, single bot impl | Requires backend changes, WS overhead for local game, complex for "simple" practice mode | Medium-High |
| **C: Hybrid** — Backend deals tiles, client plays locally with bots | Server-verified deal | Still needs WS for initial deal, over-engineered, adds complexity | Medium |

### Recommendation

**Approach A: Frontend-Only.** The infrastructure is already 80% there. The shared package IS the game engine — both backend and frontend import from it. `LocalGameEngine` already wraps shared functions. The Zustand store already supports local vs remote via `engine.remote`. The backend `findBotMove()` is ~40 lines and uses the same shared `canPlay()`. The only real work is: (1) port bot AI to frontend, (2) implement `processBotTurns()` on `LocalGameEngine`, (3) create a CPU match page that initializes the local engine without WS, (4) add lobby entry point.

### Risks

- **Bot logic duplication**: Backend and frontend each have `findBotMove()`. Mitigated by small size (~40 lines) and shared `canPlay()` from `@domino/shared`. Could move to shared package if desired.
- **Main thread blocking**: 3 bots executing synchronously could cause UI jank. Mitigated by simple AI (no deep search) and adding `setTimeout` delays for visual feedback.
- **Match page WS dependency**: Current page unconditionally calls `useWebSocket`. Need conditional skip in CPU mode (separate route or `mode` query param).
- **Timer in CPU mode**: `TurnTimer` shows 45s countdown. Bots should play faster. Mitigate by disabling timer or using shorter interval in local mode.
- **Result screen**: `GameStatusOverlay` shows "Pareja X Gana" — needs adaptation for "You Won" / "You Lost" since human is always pair 0.

### Ready for Proposal

**Yes** — All integration points identified, recommended approach is clear (frontend-only with ~80% existing infrastructure), risks are manageable. The orchestrator can proceed to proposal.
