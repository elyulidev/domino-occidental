# Delta for round-match-flow

## MODIFIED Requirements

### Requirement: Match Lifecycle Functions — Turn Timeout

The system MUST provide `checkTimeout` which forces a pass if `now > turnDeadline`. When the forced pass triggers a hand end + redeal, the timer-manager MUST deliver each player's new hand (`yourHand`) so the frontend can update its local tile state.
(Previously: timer-manager broadcast `round_started` events after timeout-based redeal but did not send `yourHand` per player, leaving clients with stale hands from the previous round)

#### Scenario: Turn timeout forces pass (unchanged)

- GIVEN `now > turnDeadline` for current player
- WHEN `checkTimeout` is called
- THEN `turn_timeout` event is emitted
- AND a forced `player_passed` follows, turn advances

#### Scenario: C-1 — Timeout-triggered hand end delivers yourHand

- GIVEN a game where Player 0's forced pass makes the board blocked
- WHEN `checkTimeout` returns events including `hand_ended` → `hand_scored` → `round_started`
- AND `broadcastEvents` runs at timer-manager.ts:155
- THEN the timer-manager SHALL iterate over `match.players` and call `sendFn(p.id, { type: "game_events", events: [], state: sanitizeState(match), yourHand: p.hand })` for each player whose hand changed
- AND each client receives the correct `yourHand` matching their new 10-tile hand
- AND the game continues with a fresh board after the HandOverModal

#### Scenario: C-2 — Normal play redeal unchanged

- GIVEN a hand ends via normal play (non-timeout)
- WHEN handleMessage in connection.ts processes the result
- THEN the existing `yourHand` delivery at connection.ts:396-405 fires correctly (unchanged by this fix)
- AND this scenario continues to pass

## Technical Enforcement

After the turn checker broadcast at timer-manager.ts:155-162, add a block that reads the fresh match from the store and sends per-player `yourHand` when `events` includes `round_started`. Reuse the same pattern as connection.ts:396-405. `sendFn` and `sanitizeState` are already in scope.
