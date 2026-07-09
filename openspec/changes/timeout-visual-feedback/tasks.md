# Tasks: Timeout Visual Feedback

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 8 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | N/A |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Fix blocked tile visual feedback in player-hand | PR 1 | Remove `isMyTurn &&` guard, update DominoTile prop |
| 2 | Fix missing sanitizeState in 3 broadcastEvents calls | PR 1 | Add `sanitizeState(result.match)` to 3 locations |
| 3 | Fix missing yourHand after timeout redeal | PR 1 | Add yourHand delivery in timer-manager turn checker |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main|feature-branch-chain|size-exception|pending
400-line budget risk: Low

## Phase 1: Core Implementation

- [ ] 1.1 Fix blocked tile visual feedback in player-hand.tsx
  - Read `packages/frontend/src/components/game/player-hand.tsx`
  - Change line 101: `const blocked = isMyTurn && blockedTileIds.includes(tile.id);` → `const blocked = blockedTileIds.includes(tile.id);`
  - Read `packages/frontend/src/components/game/domino-tile.tsx` to verify the `blocked` prop is consumed correctly
  - Run existing tests for player-hand

- [ ] 1.2 Fix missing sanitizeState in broadcastEvents calls (Bug B)
  - Read `packages/backend/src/ws/timer-manager.ts`
  - At line 137: Add `sanitizeState(result.match)` as 6th argument to `broadcastEvents`
  - At line 189: Add `sanitizeState(result.match)` as 6th argument to `broadcastEvents`
  - Read `packages/backend/src/ws/connection.ts` — confirm `sanitizeState` is already imported (line 10)
  - At line 432: Add `sanitizeState(result.match)` as 6th argument to `broadcastEvents`
  - Run existing tests for timer-manager and connection

- [ ] 1.3 Fix missing yourHand after timeout redeal (Bug C)
  - In `packages/backend/src/ws/timer-manager.ts` after line 162 (broadcastEvents call)
  - Add the handler:
```ts
// After a hand redeal via timeout: each player needs their new hand
if (result.events.some((e) => e.type === "round_started")) {
    for (const p of result.match.players) {
        sendFn(p.id, {
            type: "game_events",
            events: [],
            state: sanitizeState(result.match),
            yourHand: p.hand,
        });
    }
}
```
  - Note: `result.match` is the updated state (already persisted at line 153), and `sendFn` is already in scope
  - Run existing tests

## Phase 2: Testing

- [ ] 2.1 Run backend tests
  - Execute: `cd packages/backend && bun test`

- [ ] 2.2 Run frontend tests
  - Execute: `cd packages/frontend && bun test`

## Phase 3: Cleanup

- [ ] 3.1 Ensure all tests pass
- [ ] 3.2 Remove any temporary code or comments
