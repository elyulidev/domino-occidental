# Proposal: Game Online Connection

## Intent

Connect the visual game frontend to the backend WebSocket for online play — 1 human player vs 3 server-controlled bots — replacing the current local-only game engine path.

## Scope

### In Scope
- WsGameEngine implementing GameEngine interface for WS-backed actions
- `useWebSocket` hook for connection lifecycle and message routing
- Store refactor to support WsGameEngine injection instead of hardcoded LocalGameEngine
- Quick match button in lobby → `POST /api/v1/dev/create-match` → WS connect
- Opponent hand sizes from `SanitizedMatchState` (dynamic, not hardcoded 10)
- Player identity resolved from URL param `?playerId=` (dev mode, no auth)

### Out of Scope
- Reconnection UI and reconnection lifecycle (stable connection assumed)
- Multi-hand/round scoring (single hand only; no 200-point target)
- Real multiplayer (4 humans) — all opponents are server bots
- Match creation UI and matchmaking preferences
- Auth integration (JWT, Supabase Auth)

## Capabilities

### New Capabilities
- `online-game-connection`: Frontend WebSocket client for game play — WS connection lifecycle, message routing to Zustand store, and WsGameEngine abstraction over the backend WS protocol

### Modified Capabilities
- None — `ws-connection` backend spec is sufficient and unchanged. No frontend spec exists yet to modify.

## Approach

Replace the local engine path with a WS-driven path. WsGameEngine delegates `playTile`/`pass` to WS messages and applies server events to Zustand store via `applyServerEvents()`. `useWebSocket` manages `connect/disconnect/message`.

Flow: User Click → Store → WsGameEngine → WS.send() → Server processes → WS.onmessage → Store.applyServerEvents(). Keep LocalGameEngine as reference only.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/stores/game-store.ts` | Modified | Support WsGameEngine injection, add `applyServerEvents()` |
| `packages/frontend/src/lib/game/types.ts` | Modified | Export GameEngine interface for both engine impls |
| `packages/frontend/src/lib/game/local-engine.ts` | Reference | No changes — kept for offline reference |
| `packages/frontend/src/lib/game/ws-engine.ts` | **New** | GameEngine impl sending WS messages |
| `packages/frontend/src/hooks/use-websocket.ts` | **New** | WS connection lifecycle hook |
| `packages/frontend/src/components/game/opponent-indicator.tsx` | Modified | Show dynamic `handSize` from SanitizedMatchState |
| `packages/frontend/src/app/(game)/match/[id]/page.tsx` | Modified | Use WsGameEngine when mode=online |
| `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | Modified | Add quick match button |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| WS events arrive before store/WS is initialized | Low | Queue events during initialization |
| Dev endpoint `POST /api/v1/dev/create-match` unavailable | Low | Graceful error toast, stay in lobby |
| No auth — any URL param connects | High (dev) | Documented dev-mode limitation |

## Rollback Plan

Remove `ws-engine.ts` and `use-websocket.ts`. Restore LocalGameEngine as default in store. Revert lobby button and page.tsx changes.

## Dependencies

- Backend WS endpoint `/ws/game/:matchId/:playerId` (existing: `ws-connection` spec, `connection.ts`)
- Backend dev endpoint `POST /api/v1/dev/create-match`

## Success Criteria

- [ ] Human clicks "Quick Match" in lobby → match created → WS connects → initial state renders
- [ ] Human plays a tile → tile appears on board via WS round-trip
- [ ] Server bot plays tile automatically via WS event
- [ ] OpponentIndicators show correct hand sizes from server state
- [ ] Full hand completes (hand_ended event received)
