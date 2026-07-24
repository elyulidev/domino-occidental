# Archive Report — cpu-bugfix-abandon

**Change**: cpu-bugfix-abandon
**Archived**: 2026-07-23
**Mode**: hybrid
**Verdict**: PASS

## Summary

Fixed critical bug where CPU game was completely stuck because `initCpuMatch()` didn't set `isConnected: true` for players. Added abandon button with confirmation modal for CPU practice mode.

## Root Cause

`createPlayer()` in `packages/shared/src/game/player.ts` sets `isConnected: false` by default (server convention). `initCpuMatch()` in `packages/frontend/src/stores/game-store.ts` called `initializeMatch()` which used `createPlayer()`, but never overrode `isConnected`. When any player tried to play/pass, `validateAction()` rejected with `PLAYER_DISCONNECTED`.

Tests passed because `createTestEngine()` manually set `isConnected: true`, masking the bug.

## Changes

| File | Change |
|------|--------|
| `packages/frontend/src/stores/game-store.ts` | Map all players to `isConnected: true` after `initializeMatch()` |
| `packages/frontend/src/app/(game)/cpu/page.tsx` | Add abandon button + `LeaveMatchConfirmModal` + `isAbandonedRef` guard |
| `packages/frontend/src/stores/__tests__/game-store.test.ts` | Add test for `isConnected` bugfix |

## Verification

- 68 tests pass (0 regressions)
- Biome: pre-existing errors only
- Verify agent: PASS after fixes

## Key Decisions

1. Used `LeaveMatchConfirmModal` instead of `window.confirm` for consistent UX with online matches
2. Button visible during all `in_progress` turns (not just human turns) per spec
3. `isAbandonedRef` guard prevents stale state updates during async bot processing
