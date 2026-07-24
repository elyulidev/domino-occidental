# Tasks: CPU Game Bugfix & Abandon Feature

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 40–60 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Bugfix — `isConnected` in `initCpuMatch`

- [ ] 1.1 In `packages/frontend/src/stores/game-store.ts` → `initCpuMatch()`, after `startHand()` (line 160), map `handResult.match.players` to `{ ...p, isConnected: true }` before passing to `LocalGameEngine`
- [ ] 1.2 Verify `LocalGameEngine` receives all 4 players with `isConnected: true` — check that `validateAction()` no longer returns `PLAYER_DISCONNECTED`

## Phase 2: Abandon Button in CPU Page

- [ ] 2.1 In `packages/frontend/src/app/(game)/cpu/page.tsx`, import `LeaveMatchConfirmModal` from `@/components/game/leave-match-confirm-modal`
- [ ] 2.2 Add `useState` for modal open state and `useRef` for `isAbandoned` flag
- [ ] 2.3 Add "Abandonar Partida" button — absolute-positioned in the hand area, visible only when `currentTurn === 0 && status === "in_progress"`
- [ ] 2.4 Render `<LeaveMatchConfirmModal>` with `isOpen`, `onClose`, and `onConfirm` props
- [ ] 2.5 In `onConfirm`: set `isAbandonedRef.current = true`, call `reset()`, call `router.push("/lobby")`
- [ ] 2.6 Import `useRouter` from `next/navigation` and `useState` from `react`

## Phase 3: Guard Async Bot Callback

- [ ] 3.1 In `processBots` callback, add `isAbandonedRef.current` check at the top of the callback passed to `processBotTurnsAsync` — return early if true
- [ ] 3.2 Also guard the `.then()` block: only reset `isProcessing.current` if `!isAbandonedRef.current`

## Phase 4: Tests

- [ ] 4.1 Unit test: after `initCpuMatch()`, assert all `game.players` have `isConnected: true`
- [ ] 4.2 Unit test: set `isAbandonedRef.current = true` mid-bot-processing, verify store state is not updated
- [ ] 4.3 Integration test: mount `CpuMatchPage`, click abandon button, confirm modal → verify `reset()` called and router navigated to `/lobby`
