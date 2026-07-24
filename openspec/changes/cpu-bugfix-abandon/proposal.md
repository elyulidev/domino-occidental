# Proposal: CPU Game Bugfix & Abandon Feature

## Intent

Two critical issues block CPU practice mode:
1. **Bug**: `initCpuMatch()` never sets `isConnected: true`, causing `PLAYER_DISCONNECTED` errors on every action, making the game unplayable.
2. **Missing feature**: No way to exit a CPU match before it finishes (200 points), forcing users to close the browser tab.

Both must be fixed to make CPU practice usable.

## Scope

### In Scope
- Fix `isConnected` flag in `initCpuMatch()` so players can play/pass.
- Add "Abandon" button to CPU match UI with confirmation dialog.
- Reset game state and return to lobby on abandon.
- Update `GameStatusOverlay` to handle abandoned state.

### Out of Scope
- Turn deadline handling in CPU mode (dead code, no functional impact).
- `isBlocked()` not considering `blockedTileIds` (latent bug, no CPU impact).
- Backend changes, persistence, ELO, or coin implications.

## Capabilities

### New Capabilities
- `cpu-game-abandon`: Add abandon button with confirmation dialog to exit CPU practice match early.

### Modified Capabilities
None — the bugfix enforces existing spec (`PLAYER_DISCONNECTED` error when `isConnected === false`).

## Approach

1. **Bugfix**: In `packages/frontend/src/stores/game-store.ts` → `initCpuMatch()`, after `initializeMatch()`, map all players to `isConnected: true`.
2. **Abandon button**: Add button in `packages/frontend/src/app/(game)/cpu/page.tsx` (or `player-hand.tsx`) that triggers a confirmation dialog.
3. **Reset logic**: On confirm, call `resetGame()` (existing store action) to clear state and navigate to `/lobby`.
4. **Overlay**: Update `GameStatusOverlay` to show "Match abandoned" message when `status === 'abandoned'`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/stores/game-store.ts` | Modified | Fix `initCpuMatch()` to set `isConnected: true` |
| `packages/frontend/src/app/(game)/cpu/page.tsx` | Modified | Add abandon button and confirmation dialog |
| `packages/frontend/src/components/game/player-hand.tsx` | Modified | Possibly relocate abandon button |
| `packages/frontend/src/components/game/game-status-overlay.tsx` | Modified | Handle abandoned state display |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Accidental abandonment during gameplay | Low | Confirmation dialog with clear warning |
| State desync after abandon | Low | Use existing `resetGame()` which clears store cleanly |
| Missing UI feedback | Low | Test overlay shows correct message |

## Rollback Plan

1. Revert the commit(s) containing these changes.
2. CPU practice mode returns to previous state (unplayable bug remains, but no new regressions).
3. No database migrations or backend changes to undo.

## Dependencies

- None — all changes are frontend-only, using existing Zustand store and React components.

## Success Criteria

- [ ] CPU match loads without `PLAYER_DISCONNECTED` errors.
- [ ] Player can play/pass tiles in CPU mode.
- [ ] Abandon button visible and clickable during CPU match.
- [ ] Confirmation dialog appears with "Yes, abandon" and "Cancel" options.
- [ ] On confirm, game resets and user returns to lobby.
- [ ] On cancel, game continues uninterrupted.
- [ ] No regressions in online match functionality.