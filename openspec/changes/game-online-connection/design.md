# Design: Game Online Connection

## Technical Approach

Replace the local-only game path with a WS-driven one. `WsGameEngine` implements `GameEngine` and delegates `playTile`/`pass` over the socket instead of executing locally. A `useWebSocket` hook manages the connection lifecycle and feeds server state into the store via `applyWsUpdate()`. The lobby gets a quick-match button that calls `POST /api/v1/dev/create-match`, navigates to the match with `?playerId=p0&mode=online`, and the page boots the WS path instead of the local engine.

## Architecture Decisions

| # | Decision | Choice | Alternatives | Rationale |
|---|----------|--------|-------------|-----------|
| 1 | **WsGameEngine pattern** | Implements `GameEngine`; `playTile`/`pass` send WS and optimistically update `_hand`; `processBotTurns()` is no-op | Separate engine type with different store actions | Keeps store API uniform — the store calls `engine.playTile()` then `engine.processBotTurns()` regardless of engine type |
| 2 | **State sync** | `applyWsUpdate()` on store ingests `SanitizedMatchState` + `yourHand` and sets `game` subtree | Inline sync in the hook | Single path for all WS-driven updates (join, tile_played, hand_ended, reconnect) |
| 3 | **Initial hand** | Extend `WsServerMessage` with optional `yourHand: Tile[]` — populated only for the connecting player's first message | Separate `join_ack` message type | Minimal wire change, backward-compatible (existing fields unchanged) |
| 4 | **Turn tracking** | Extend `SanitizedMatchState` with `turnDeadline`, `consecutiveNullRounds`, `lastHandWinner` | Track locally, derive from events | Server is source of truth; these fields already exist on server-side `TurnState` |
| 5 | **Quick match** | Lobby button → `fetch POST /api/v1/dev/create-match` → receive `{ matchId }` → `router.push(/match/${matchId}?playerId=p0&mode=online)` | Inline WS connect from lobby | Match page owns the WS lifecycle; navigation is a clean reset point |
| 6 | **Opponent hand sizes** | `computeOpponents` reads `players[i].handSize` from store — populated from server `SanitizedMatchState` | Derive from board tile count | Server state is authoritative; board-derived sizes drift |

## Data Flow

```
Lobby button
  ↓ fetch POST /api/v1/dev/create-match
  ↓ { matchId }
  ↓ router.push(/match/{matchId}?playerId=p0&mode=online)

MatchPage mount
  ↓ read ?playerId=p0, ?mode=online
  ↓ create WsGameEngine(connection)
  ↓ useWebSocket(matchId, playerId)

WS connect → open handler on server
  ↓ { type: "game_events", events: [], state, yourHand }
  ↓ hook → engine.applyState(state, yourHand) → store.applyWsUpdate(sanitized, hand)

Player clicks tile + side
  ↓ store.playTile(side)
  ↓ engine.playTile(tileId, side)
  ↓ WS.send({ type: "play_tile", tileId, side })
  ↓ engine removes tile from _hand (optimistic)
  ↓ store re-syncs from engine (tile removed from ownHand)

Server processes → broadcasts to all 4 players
  ↓ WS message → { type: "game_events", events: [tile_played], state: SanitizedMatchState }
  ↓ hook → store.applyWsUpdate(sanitized) → board, turn, scores updated
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/handler.ts` | Modify | Add `turnDeadline`, `consecutiveNullRounds`, `lastHandWinner` to `SanitizedMatchState` |
| `packages/shared/src/ws.ts` | Modify | Add optional `yourHand: Tile[]` to `WsServerMessage` |
| `packages/backend/src/ws/connection.ts` | Modify | Populate `yourHand` from `match.players[].hand` in `open` handler |
| `packages/frontend/src/lib/game/ws-engine.ts` | **Create** | `WsGameEngine` implementing `GameEngine` — stores `_sanitized`, `_hand`, sends WS messages |
| `packages/frontend/src/hooks/use-websocket.ts` | **Create** | WS lifecycle: connect, send, receive, reconnect; calls `engine.applyState()` on `game_events` |
| `packages/frontend/src/stores/game-store.ts` | Modify | Add `applyWsUpdate()`, import `WsGameEngine`, pass engine type in `initEngine()` |
| `packages/frontend/src/app/(game)/match/[id]/page.tsx` | Modify | Read `?playerId` and `?mode` from URL; create `WsGameEngine` path when `mode=online` |
| `packages/frontend/src/components/game/opponent-indicator.tsx` | Modify | `computeOpponents` reads real `handSize` from store players array |
| `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | Modify | Add quick-match button that calls dev endpoint and navigates |

## Interfaces / Contracts

```typescript
// packages/shared/src/ws.ts — extended
type WsServerMessage = {
  type: "game_events";
  events: GameEvent[];
  state?: SanitizedMatchState;
  yourHand?: Tile[];                     // ← new: only for join/reconnect
};

// packages/shared/src/handler.ts — extended
interface SanitizedMatchState {
  // existing fields…
  turnDeadline: number | null;           // ← new
  consecutiveNullRounds: number;         // ← new
  lastHandWinner: number | null;         // ← new
}

// packages/frontend/src/lib/game/ws-engine.ts — new
class WsGameEngine implements GameEngine {
  private _sanitized: SanitizedMatchState;
  private _hand: Tile[];
  private _playerIndex: number;
  private _send: (msg: WsClientMessage) => void;

  get state(): MatchState { /* convert sanitized → MatchState shape */ }
  get hand(): Tile[] { return this._hand; }
  get playerIndex(): number { return this._playerIndex; }

  playTile(tileId: string, side: Side): ActionResult;  // sends WS + optimistic remove
  pass(): ActionResult;                                 // sends WS
  processBotTurns(): MatchState;                        // no-op — returns asMatchState()
  applyState(sanitized: SanitizedMatchState, yourHand?: Tile[]): void;  // called by hook
  destroy(): void;                                      // close WS
}

// packages/frontend/src/hooks/use-websocket.ts — return type
interface UseWebSocketReturn {
  status: "connecting" | "connected" | "disconnected";
  send: (msg: WsClientMessage) => void;
  engine: WsGameEngine;
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `WsGameEngine` isolated | Mock `_send` fn; verify `playTile`/`pass` emit correct WS messages; verify `processBotTurns()` returns current state unchanged; verify optimistic hand removal |
| Unit | `applyWsUpdate` | Feed `SanitizedMatchState` + hand into store; verify board, turn, scores, ownHand, handSize render correctly |
| Integration | WS round-trip (dev) | Spin up Elysia backend; `POST /dev/create-match`; WS connect; play tile; verify `game_events` received with updated state |
| Integration | Lobby → match flow | Fetch dev endpoint; navigate; verify engine type is `WsGameEngine` and WS connects |

## Migration / Rollout

No migration required. The feature is gated by `?mode=online` URL parameter. Local mode remains the default for existing functionality. The dev endpoint is unauthenticated and localhost-only.

## Open Questions

- Should `WsGameEngine.state` return a full `MatchState` with dummy hands for opponents, or should we widen the store's `syncGameState` to accept `SanitizedMatchState` directly? Decision: keep `state` getter for backward compat; convert sanitized → MatchState with empty opponent hands.
- Do we queue WS messages received before the store is ready? For dev mode the window is negligible — skip v1.
