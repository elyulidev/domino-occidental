# Proposal: Reconnection & Abandonment

## Intent

Module 7 of 7 — the final game engine module. Production domino matches must survive network drops. Without reconnection handling, a brief WiFi flicker ends the game. This module defines the lifecycle: disconnect → reconnect window → forced passes → abandonment/forfeit.

## Scope

### In Scope
- `connection.ts`: 6 pure functions (disconnect/reconnect/force-pass/window-check/abandonment/forfeit)
- New `GameEvent` variants: player_disconnected, player_reconnected, reconnection_window_expiring, match_abandoned
- `DisconnectRecord` type, timer constants
- Unit tests in `__tests__/connection.test.ts`

### Out of Scope
- ELO penalty, heartbeat (5s) infrastructure, WS event broadcasting
- Persistent storage of abandoned matches
- `handleHandEnd` on abandonment (match simply ends per AGENTS.md §5)

## Capabilities

### New Capabilities
- `reconnection-abandonment`: Disconnect/reconnect lifecycle, forced passes for disconnected players, match abandonment, forfeit

### Modified Capabilities
- `round-match-flow`: `GameEvent` union extended with 4 new event variants; `MatchState` unchanged

## Proposed Functions (in `connection.ts`)

| Function | Signature | Pre → Post | Events |
|----------|-----------|------------|--------|
| `disconnectPlayer` | `(match, playerId, disconnectedAt)` → `ActionResult` | Player connected, match active → `isConnected=false`, timer starts | `player_disconnected` |
| `reconnectPlayer` | `(match, playerId, now)` → `ActionResult` | Player disconnected, match active → `isConnected=true`, `lastActionAt` updated | `player_reconnected` |
| `forcePassForDisconnected` | `(match, playerId, now)` → `ActionResult` | Player is disconnected AND is current turn → pass forced, turn advanced, deadline reset | `turn_timeout {forcedPass:true}` + hand-end cascade if blocked |
| `checkReconnectWindow` | `(match, record, now)` → `boolean` | Pure check — no state change | None |
| `checkAbandonment` | `(match, record, now)` → `ActionResult` | `now - disconnectedAt >= 60s` → `status='abandoned'` | `match_abandoned {reason:'abandonment'}` |
| `forfeitMatch` | `(match, playerId, now)` → `ActionResult` | Match active → `status='abandoned'`, `isConnected=false` | `match_abandoned {reason:'forfeit'}` |

## Design Decisions

- **Disconnect records live outside MatchState**: WS layer manages `Map<matchId, Map<playerId, DisconnectRecord>>`. Pure functions accept `now` and `DisconnectRecord` as params — no coupling to WS infra.
- **Abandonment does NOT call `handleHandEnd`**: No hand scoring. Match ends immediately (status → `'abandoned'`). ELO is a separate concern.
- **Reconnect resets the timer**: Each disconnect creates a fresh `DisconnectRecord`. Reconnect removes it. New disconnect = new 60s window.
- **Forfeit = immediate abandonment**: Same outcome as timeout > 60s but reason='forfeit'. No wait.

## Timer Interaction

```
Timeline:
0s ─ player disconnects (isConnected=false)
    └─ 45s turn timeout runs independently (may force passes)
30s ─ reconnection_window_expiring emitted (informational)
60s ─ ABANDONMENT → status='abandoned', match ends
```

The 45s turn timeout (in `match.ts:checkTimeout`) and 60s abandonment (`checkAbandonment`) run independently. A disconnected player may have passes forced by `checkTimeout` while the abandonment clock ticks. If they reconnect before 60s, normal play resumes regardless of forced passes.

## Edge Cases

| Case | Behavior |
|------|----------|
| Disconnect during own turn | `forcePassForDisconnected` or `checkTimeout` forces pass |
| Disconnect during opponent's turn | Game continues; `checkAbandonment` still counts down |
| Two players disconnect | Independent records; each tracked separately |
| Forfeit | Immediate `status='abandoned'` — no timer, no window |
| Reconnect just after 60s | Race: whichever fires first wins. Abandonment check should verify player is still disconnected |
| Match already finished | `checkAbandonment`/`disconnectPlayer` return unchanged match + empty events |
| Multiple disconnect-reconnect cycles | Each disconnect creates new record; reconnect removes it |
| Disconnected player is next hand's starter | `startHand` proceeds normally (player still `in_progress`, just disconnected) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Timer race: 45s timeout vs 60s abandonment fire simultaneously | Low | Abandonment check verifies `status !== 'abandoned'` before proceeding |
| State inconsistency if reconnect and timeout co-occur | Low | Pure functions are deterministic; WS layer serializes events |
| Abandonment + hand-end collision | Med | `checkAbandonment` guards: if hand ended before abandonment, that event wins |

## Rollback Plan

Delete `connection.ts`, `connection.test.ts`, revert `GameEvent` additions in `types.ts`. Existing match.ts, turn.ts, player.ts unchanged.

## Dependencies

- `player.ts`: `setConnected`, `updateLastAction`, `incrementPasses`
- `turn.ts`: `advanceTurn`, `calculateDeadline`
- `match.ts`: `handleHandEnd` (for blocked board after forced pass)
- `types.ts`: new `GameEvent` variants, `DisconnectRecord`, timer constants

## Success Criteria

- [ ] `bun test` passes all connection tests (~20 cases)
- [ ] `bun run biome:check` passes
- [ ] `tsc --noEmit` passes
- [ ] All 6 function specs implemented and tested
- [ ] All edge cases covered
- [ ] No existing tests broken (0 regressions)
