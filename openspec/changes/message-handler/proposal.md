# Proposal: Module 9 — Message Handler

## Intent

Bridge WebSocket messages to engine functions. A thin adapter that reads MatchState from the store, calls the pure engine functions, writes the updated state back, and returns sanitized events + state for broadcast — no WS or timer logic.

## Scope

### In Scope
- `handleMessage(store, matchId, playerId, message)` — single entry point
- Message routing: `play_tile` → `playTile()`, `pass` → `passTurn()`, `leave` → `forfeitMatch()`
- Match lookup + error on unknown matchId
- State sanitization (strip `pool` field before broadcast)
- Structured event array returned for the upstream broadcast layer

### Out of Scope
- WS connection lifecycle (JWT auth, socket join/leave — Module 11)
- Timer workers (heartbeat, turn timeout, abandonment — Module 12)
- `game_state` initial send (needs socket context — Module 11)
- Disconnect record tracking (ephemeral, external storage)
- `reconnecting` message handling (JWT re-validation + disconnect check — Module 11)
- Rate limiting (10 msg/sec — WS layer)
- Matchmaking, REST API, or client-side code

## Capabilities

### New Capabilities
- `message-handler`: Routes typed WS messages to engine functions, persists state changes, and returns sanitized outputs for broadcast

### Modified Capabilities
- None

## Architecture

```
WS Message (parsed JSON)
  → handleMessage(store, matchId, playerId, { type, ...payload })
    → getGame(matchId) → null? → [{ game_error: "MATCH_NOT_FOUND" }]
    → route by message.type:
        "play_tile"  → playTile(match, playerId, tileId, side)
        "pass"       → passTurn(match, playerId)
        "leave"      → forfeitMatch(match, playerId, new Date())
        unknown      → [{ game_error: "UNKNOWN_MESSAGE_TYPE" }]
    → updateGame(matchId, result.match)
    → sanitize(result.match) → strip pool, server-only fields
    → return { events: result.events, state: sanitized }
```

## Public API

```typescript
function handleMessage(
  store: GameStore,
  matchId: string,
  playerId: string,
  message: ClientMessage,
): HandlerResult

interface HandlerResult {
  events: GameEvent[];
  state: SanitizedState;
}

interface SanitizedState {
  matchId: string;
  players: SanitizedPlayerState[];
  board: BoardState;
  turn: TurnState;
  scores: ScoreState;
  poolCount: number;
  status: MatchStatus;
  targetScore: number;
}
```

## State Sanitization

Before returning match state, strip:
- `pool: Tile[]` → remove entirely (server-only, never sent to clients)
- Keep `poolCount: number` (public count only)
- Players' `hand: Tile[]` is kept per-client (WS layer filters per player)

## Error Handling

| Scenario | Response |
|----------|----------|
| Unknown matchId | `[{ game_error: "MATCH_NOT_FOUND" }]`, null state |
| Unknown playerId | routed to engine → engine returns `[{ game_error: "PLAYER_NOT_FOUND" }]` |
| Unknown message type | `[{ game_error: "UNKNOWN_MESSAGE_TYPE" }]`, current state |
| Engine action error | engine returns `[{ game_error }]` — passed through as-is |
| Disconnected player | engine returns `[{ game_error: "PLAYER_DISCONNECTED" }]` |

## Dependencies

| Dependency | Module | Purpose |
|---|---|---|
| `src/game/store.ts` | 5 | `getGame`, `updateGame` |
| `src/game/match.ts` | 6 | `playTile()`, `passTurn()` |
| `src/game/connection.ts` | 7 | `forfeitMatch()` |
| `src/game/types.ts` | 2 | `GameEvent`, `MatchState`, `ActionResult` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Pool field leaked to client | Low | Single sanitize() function, tested. If field is added to MatchState, sanitize() must be updated |
| Race condition on store | Low | Store ops are sync (Map); WS messages processed sequentially per match |

## Rollback Plan

Revert the single handler file (`src/game/handler.ts`). No schema or config changes. The WS layer in Module 11 will call handleMessage — if back-revved, Module 11 needs the matching revert.

## Success Criteria

- [ ] `play_tile` routes to `playTile()` and returns updated state + events
- [ ] `pass` routes to `passTurn()` and returns correct events
- [ ] `leave` routes to `forfeitMatch()` and marks match abandoned
- [ ] Unknown matchId returns `MATCH_NOT_FOUND` error, null state
- [ ] Unknown message type returns `UNKNOWN_MESSAGE_TYPE` error
- [ ] `pool` field is NEVER present in returned state
- [ ] All existing tests still pass
- [ ] New handler tests cover all message types + error paths
