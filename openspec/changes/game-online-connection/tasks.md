# Tasks: Game Online Connection

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR1: Shared types + Backend → PR2: WsGameEngine + Hook → PR3: Store + UI integration |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Shared type extensions + backend yourHand population | PR 1 | Foundation — handler.ts, ws.ts, connection.ts |
| 2 | WsGameEngine + useWebSocket hook | PR 2 | Core — ws-engine.ts, use-websocket.ts |
| 3 | Store refactor + page wiring + lobby button | PR 3 | Integration — game-store.ts, page.tsx, lobby, opponent-indicator |

## Phase 1: Foundation — Shared Types & Backend

- [x] 1.1 Add `turnDeadline`, `consecutiveNullRounds`, `lastHandWinner` to `SanitizedMatchState` in `packages/shared/src/handler.ts`
- [x] 1.2 Add optional `yourHand: Tile[]` to `WsServerMessage` in `packages/shared/src/ws.ts`
- [x] 1.3 Populate `yourHand` from `match.players[i].hand` in `open` handler of `packages/backend/src/ws/connection.ts`

## Phase 2: Core — WsGameEngine & WebSocket Hook

- [ ] 2.1 Create `packages/frontend/src/lib/game/ws-engine.ts` with `WsGameEngine` class implementing `GameEngine`:
  - Store `_sanitized: SanitizedMatchState`, `_hand: Tile[]`, `_playerIndex`, `_send` function
  - `state` getter converts sanitized → MatchState shape
  - `hand` getter returns `_hand`
  - `playTile(tileId, side)` sends `{ type: "play_tile", tileId, side }` via `_send` + removes from `_hand`
  - `pass()` sends `{ type: "pass" }` via `_send`
  - `processBotTurns()` returns current state as MatchState (no-op, server handles bots)
  - `applyState(sanitized, yourHand?)` updates internal state
  - `destroy()` closes WS
- [ ] 2.2 Create `packages/frontend/src/hooks/use-websocket.ts` hook:
  - Connect to `ws://localhost:3001/ws/game/{matchId}/{playerId}`
  - `status` state: "connecting" | "connected" | "disconnected"
  - `send` function that sends JSON over WS
  - On `message`, parse `WsServerMessage`, call `engine.applyState(state, yourHand)` + `store.applyWsUpdate(sanitized, hand)`
  - `engine` getter returns the `WsGameEngine` instance
  - Cleanup on unmount: `engine.destroy()`

## Phase 3: Integration — Store, Page & UI

- [ ] 3.1 Add `applyWsUpdate(sanitized: SanitizedMatchState, yourHand?: Tile[])` to `packages/frontend/src/stores/game-store.ts`:
  - Update board, scores, currentTurn, players (handSize), turnDeadline, status
  - If `yourHand` provided, set `ownHand`
  - If no `yourHand` (subsequent events), preserve existing `ownHand`
- [ ] 3.2 Modify `initEngine(type: 'local' | 'online', ...)` in store to accept WsGameEngine
- [ ] 3.3 Update `packages/frontend/src/app/(game)/match/[id]/page.tsx`:
  - Read `?playerId=p0` and `?mode=online` from URL search params
  - If `mode=online`: use `useWebSocket` hook, create `WsGameEngine`, call `store.initEngine('online', wsEngine)`
  - If `mode=local` (default): existing local engine path
- [ ] 3.4 Update `packages/frontend/src/components/game/opponent-indicator.tsx`:
  - Read `handSize` from store's `players[i].handSize` instead of hardcoded `10`
- [ ] 3.5 Add quick match button to `packages/frontend/src/app/(dashboard)/lobby/page.tsx`:
  - Button text: "Jugar ahora" or "Quick Match"
  - On click: `fetch POST /api/v1/dev/create-match` → receive `{ matchId }` → `router.push(/match/${matchId}?playerId=p0&mode=online)`
  - Loading state while fetching

## Phase 4: Tests

- [ ] 4.1 Unit test `WsGameEngine` — mock `_send`, verify `playTile`/`pass` emit correct WS messages, verify `processBotTurns()` returns current state
- [ ] 4.2 Unit test `applyWsUpdate` — feed `SanitizedMatchState` + hand into store, verify board/turn/scores/ownHand
- [ ] 4.3 Integration test — spin up Elysia backend, POST /dev/create-match, WS connect, play tile, verify `game_events` received
