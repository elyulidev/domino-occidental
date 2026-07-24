# CPU Game Abandon Specification

## Purpose

Allow users to exit a CPU practice match early via an "Abandon" button with confirmation dialog, resetting game state and returning to lobby. Also documents the `isConnected` initialization fix that makes CPU matches playable.

## Requirements

### Requirement: CPU Match Player Connectivity

The system MUST set `isConnected: true` for all 4 players after `initializeMatch()` in `initCpuMatch()`. Without this, `validateAction()` rejects every move with `PLAYER_DISCONNECTED`.

| # | Scenario | Result |
|---|----------|--------|
| 1 | CPU match initialized, player plays a tile | Action succeeds, no `PLAYER_DISCONNECTED` error |
| 2 | CPU match initialized, player passes | Action succeeds, turn advances |
| 3 | CPU match initialized, bot takes turn | Bot actions execute without connectivity errors |

### Requirement: Abandon Button Visibility

The system MUST render an "Abandon" button on the CPU match page (`/cpu`) that is visible at all times during an active CPU match, regardless of whose turn it is.

| # | Scenario | Result |
|---|----------|--------|
| 1 | CPU match in_progress, player's turn | Abandon button visible |
| 2 | CPU match in_progress, bot's turn | Abandon button visible |
| 3 | CPU match finished | Abandon button hidden |
| 4 | Online match (non-CPU) | Abandon button MUST NOT appear |

### Requirement: Abandon Confirmation Dialog

The system MUST display a confirmation dialog when the abandon button is clicked. The dialog MUST present two options: "Yes, abandon" (confirms) and "Cancel" (dismisses).

| # | Scenario | Result |
|---|----------|--------|
| 1 | User clicks abandon, then clicks "Cancel" | Dialog closes, match continues unchanged |
| 2 | User clicks abandon, then clicks "Yes, abandon" | Match state resets, user navigated to `/lobby` |
| 3 | User clicks abandon, then closes dialog via backdrop/escape | Equivalent to Cancel, match continues |

### Requirement: Abandon State Reset

On confirmed abandon, the system MUST call `resetGame()` to clear the Zustand store (match state, players, board, turn, scores) and navigate the user to `/lobby`. The abandoned match MUST NOT persist to the database (CPU matches are ephemeral).

| # | Scenario | Result |
|---|----------|--------|
| 1 | Abandon confirmed mid-turn (player's turn) | Store cleared, navigated to lobby, no DB record |
| 2 | Abandon confirmed mid-turn (bot's turn) | Same as above — bot turn cancelled |
| 3 | Abandon confirmed during hand transition | Store cleared cleanly, no orphan state |
| 4 | User navigates back to `/cpu` after abandon | Fresh match, no stale state from previous game |

### Requirement: Abandon Button Placement

The abandon button MUST be placed within the game UI such that it is accessible but not accidentally tappable during gameplay. The button MUST use a distinct visual style (e.g., secondary/destructive variant) to differentiate from game actions.

| # | Scenario | Result |
|---|----------|--------|
| 1 | User playing on mobile | Button accessible without interfering with tile placement |
| 2 | User playing on desktop | Button visible and clickable in the game layout |

## Edge Cases

| Case | Behavior |
|------|----------|
| Abandon while bot is animating | Bot animation cancelled, state reset immediately |
| Abandon during timeout countdown | Timeout timer discarded, state reset |
| Double-click abandon button | Confirmation dialog shown once (idempotent) |
| Browser back button during match | Browser-level navigation, Zustand state lost (no persistence) |
| Network disconnection + abandon | No impact — CPU match has no network dependency |

## Acceptance Criteria

- [ ] `initCpuMatch()` sets `isConnected: true` on all players — verified by playing a tile without `PLAYER_DISCONNECTED`
- [ ] Abandon button renders on `/cpu` page during active match
- [ ] Clicking abandon shows confirmation dialog with two options
- [ ] Cancel/close dialog keeps match running
- [ ] Confirming abandon clears store and navigates to `/lobby`
- [ ] No stale state when re-entering `/cpu`
- [ ] Online matches (`/match/:id`) do NOT show the abandon button
- [ ] No regressions in existing online match play/pass/timeout flows
