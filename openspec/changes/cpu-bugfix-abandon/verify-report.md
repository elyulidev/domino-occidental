# Verify Report: cpu-bugfix-abandon

**Status**: FAIL
**Next**: fixes-required

---

## Checks

### Bugfix: `isConnected: true` in `initCpuMatch`

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | CPU match initialized, player plays tile → action succeeds | PASS | `initCpuMatch()` maps all 4 players to `isConnected: true` before `LocalGameEngine` construction (game-store.ts:162-168) |
| 2 | CPU match initialized, player passes → turn advances | PASS | Same fix enables pass flow — no `PLAYER_DISCONNECTED` |
| 3 | CPU match initialized, bot takes turn → no connectivity errors | PASS | All players connected; bot processing callback in `processBots` works |

**Verdict**: ✅ Bugfix implemented correctly. Test `initCpuMatch sets all players as connected (bugfix)` confirms it.

---

### Feature: Abandon Button

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Abandon button visible during player's turn | PASS | `canAbandon = status === "in_progress" && currentTurn === 0` — visible to human (cpu/page.tsx:104) |
| 2 | Abandon button visible during bot's turn | **FAIL** | Button hidden when `currentTurn !== 0`. Spec scenario 2 requires visibility "regardless of whose turn it is" (spec.md § Abandon Button Visibility) |
| 3 | Abandon button hidden when match finished | PASS | `canAbandon` requires `status === "in_progress"` |
| 4 | Online match does not show abandon button | PASS | Button only in `cpu/page.tsx`, not in `match/[id]/page.tsx` |

**Verdict**: ❌ Spec requires button visible during bot's turn. Implementation restricts to human's turn only.

---

### Feature: Abandon Confirmation Dialog

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | User clicks Cancel → dialog closes, match continues | PASS | `window.confirm` returns `false` on Cancel — early return (cpu/page.tsx:98) |
| 2 | User clicks "Yes, abandon" → state reset + navigate to `/lobby` | PASS | `isAbandonedRef = true → reset() → router.push("/lobby")` (cpu/page.tsx:99-101) |
| 3 | User closes dialog via backdrop/Escape | **FAIL** | `window.confirm` is native browser dialog — no backdrop click support. Escape partially works on some browsers. Spec requires `LeaveMatchConfirmModal` for this behavior |

**Additional**: Design.md explicitly chose `LeaveMatchConfirmModal` over `window.confirm` (Architecture Decisions table, row 5). Tasks.md § 2.1-2.4 require importing and rendering `LeaveMatchConfirmModal`.

**Verdict**: ❌ Uses `window.confirm` instead of the specified `LeaveMatchConfirmModal` component. Missing backdrop dismissal, styled buttons, and spec-compliant button labels.

---

### Feature: Abandon State Reset

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Abandon confirmed mid-turn (player's turn) | PASS | `reset()` clears store + `engine.destroy()` |
| 2 | Abandon confirmed mid-turn (bot's turn) | PASS | `isAbandonedRef` guard prevents stale state updates (cpu/page.tsx:49) |
| 3 | Abandon confirmed during hand transition | PASS | `reset()` is idempotent — safe to call at any point |
| 4 | Re-enter `/cpu` after abandon → fresh match | PASS | `isAbandonedRef.current = false` in mount `useEffect` (cpu/page.tsx:28) |

**Verdict**: ✅ State reset is correct and handles edge cases properly.

---

### Edge Case Protection

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Abandon while bot is animating → no stale state | PASS | `isAbandonedRef.current` checked in bot callback before setState (cpu/page.tsx:49) |
| 2 | Double-click abandon → confirmation shown once | ⚠️ WARN | `window.confirm` is synchronous — second click queues after first resolves. `reset()` is idempotent so no crash, but second dialog appears after state cleared |
| 3 | Browser back button → Zustand state lost | ACCEPTABLE | Spec identifies this as acceptable (spec.md § Browser back button) |

---

### Tasks Coverage

| Task | Status | Notes |
|------|--------|-------|
| 1.1: Map players to isConnected: true | ✅ DONE | game-store.ts:162-168 |
| 1.2: Verify validateAction no longer rejects | ✅ DONE | Covered by unit test |
| 2.1: Import LeaveMatchConfirmModal | ❌ NOT DONE | Uses window.confirm instead |
| 2.2: Add useState for modal | ❌ NOT DONE | Not needed with window.confirm |
| 2.3: Add abandon button with conditional visibility | ✅ DONE | cpu/page.tsx:104, 127-135 |
| 2.4: Render LeaveMatchConfirmModal | ❌ NOT DONE | Not rendered |
| 2.5: onConfirm: set isAbandonedRef + reset + push | ✅ DONE | cpu/page.tsx:99-101 |
| 2.6: Import useRouter | ✅ DONE | cpu/page.tsx:4 |
| 3.1: isAbandonedRef guard in bot callback | ✅ DONE | cpu/page.tsx:49 |
| 3.2: Guard .then() block | ✅ DONE | cpu/page.tsx:82 |
| 4.1: Unit test: isConnected: true after initCpuMatch | ✅ DONE | game-store.test.ts:262-267 |
| 4.2: Unit test: isAbandonedRef mid-bot-processing | ❌ NOT DONE | Missing from test file |
| 4.3: Integration test: abandon flow | ❌ NOT DONE | Missing from test file |

---

## Summary

| Area | Status |
|------|--------|
| Bugfix (isConnected: true) | ✅ PASS |
| Abandon button visibility | ❌ FAIL — spec says always visible, only visible on human turn |
| Abandon confirmation dialog | ❌ FAIL — window.confirm instead of LeaveMatchConfirmModal per spec/design |
| Abandon state reset + edge cases | ✅ PASS |
| Tasks completion | ⚠️ 6/13 tasks NOT completed |

**Issues requiring fixes:**
1. Replace `window.confirm` with `LeaveMatchConfirmModal` (reuse existing component at `@/components/game/leave-match-confirm-modal`)
2. Change `canAbandon` condition to show button during all match phases (`currentTurn === 0` → remove turn restriction)
3. Add missing tests: `isAbandonedRef` mid-bot-processing guard, integration test for abandon flow

**Verification performed by**: sdd-verify agent
**Date**: 2026-07-23
