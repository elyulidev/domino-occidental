# Proposal: Timeout Visual Feedback

## Intent

Three bugs break visual feedback and game continuity after turn timeouts: blocked tiles never show their indicator, disconnected players stay "online" on opponents' screens, and timeout-caused redeals leave clients with stale hands. Players can't trust the UI to reflect the actual game state.

## Scope

### In Scope
- Fix `player-hand.tsx` blocked-tile indicator (Bug A)
- Add `sanitizeState` to 3 broadcastEvents calls (Bug B)
- Add `yourHand` delivery to timer-manager redeal path (Bug C)

### Out of Scope
- Timer-manager refactors or extraction
- UI/UX redesign of timeout feedback
- Reconnection flow beyond existing `isConnected` fix

## Capabilities

### New Capabilities
None — this change fixes bugs in existing capabilities.

### Modified Capabilities
- `ws-connection`: Disconnect events (`player_disconnected`, `match_abandoned`) must include sanitized player state (Bug B). Round-started events from timer-manager must deliver `yourHand` per player (Bug C).
- `round-match-flow`: Timer-manager must forward `yourHand` on timeout-caused redeals (Bug C).

## Approach

Three isolated fixes:
1. **Bug A**: Remove `isMyTurn &&` guard on blocked-tile CSS class. `canInteract` already prevents interaction.
2. **Bug B**: Pass `sanitizeState(result.match)` as 6th arg to `broadcastEvents` at 3 callsites (2 in `timer-manager.ts`, 1 in `connection.ts`).
3. **Bug C**: After `broadcastEvents` in timer-manager turn checker, iterate players and send `yourHand` when `events` includes `round_started` — same pattern as `connection.ts:396-405`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/components/game/player-hand.tsx` | Modified | Line 101: remove `isMyTurn &&` guard |
| `packages/backend/src/ws/timer-manager.ts` | Modified | +`sanitizeState` at lines 137 & 189; +`yourHand` handler |
| `packages/backend/src/ws/connection.ts` | Modified | +`sanitizeState` at line 432 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `sanitizeState` is stateful/per-call | Low | Already used elsewhere; pure function |
| Timer-manager `yourHand` leaks pool tiles | Low | `yourHand` bounded to player's hand |
| Blocked indicator shows during opponent's turn | Low | Intentional — tiles remain blocked |

## Rollback Plan

Revert the PR via `git revert`. Each fix is independent — cherry-pick only faulty commits if needed.

## Dependencies

None — all fixes are within the existing codebase. `sanitizeState` already imported.

## Success Criteria

- [ ] Scenario A: timed-out player sees red border + ✕ on blocked tiles; can't click them
- [ ] Scenario B: disconnected player shows as offline (red dot) for all opponents within 5s
- [ ] Scenario C: timeout-caused hand end redeals correctly; game continues without stale tiles
