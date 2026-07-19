# Proposal: Fix Leave Match — Instant Forfeit via WebSocket

## Intent

The current "Leave Match" button is broken. It sends a REST POST to a non-existent route (`/api/v1/matches/${id}/forfeit`), then immediately destroys the WS engine and navigates to the lobby. This triggers the slow disconnect path: the server detects a dropped connection, starts a 60-second abandonment timer, and other players wait a full minute before the match ends. The backend already has an instant forfeit path via the `leave` WS message — the frontend just isn't using it.

## Scope

### In Scope
- **Replace broken REST forfeit** with `{ type: "leave" }` WebSocket message
- **Add confirmation modal** before sending the leave message (matching existing `HandOverModal` pattern)
- **Don't destroy engine on confirm** — wait for `match_abandoned` event from server, then navigate to lobby
- **Improve abandonment notification** — show the forfeiting player's username (not a generic message) in the `GameStatusOverlay`

### Out of Scope
- Backend changes — `forfeitMatch()` in `connection.ts` and the `leave` route in `handler.ts` already work correctly
- ELO penalty logic (already implemented in `elo.ts`)
- Reconnection flow (unchanged)
- Disconnect-by-timeout flow (unchanged — still uses 60s timer)

## Capabilities

### New Capabilities
- `leave-match-modal`: Confirmation dialog for voluntary match abandonment via WebSocket

### Modified Capabilities
- `ws-connection`: Frontend sends `leave` message type instead of REST POST; client waits for `match_abandoned` event before cleanup
- `round-match-flow`: `GameStatusOverlay` renders forfeit-specific message with leaving player's username

## Approach

1. **New component: `LeaveConfirmModal`** in `packages/frontend/src/components/game/leave-confirm-modal.tsx`
   - Same pattern as `HandOverModal`: fixed overlay + backdrop blur + rounded card
   - Two buttons: "Cancel" (closes modal) and "Leave Match" (red, confirms)
   - Text: "Are you sure you want to leave the match? This will end the game for all players."

2. **Modify `handleLeaveMatch` in `match/[id]/page.tsx`**
   - Remove: REST POST to `/api/v1/matches/${id}/forfeit`
   - Remove: immediate `wsHook.engine.destroy()` and `reset()`
   - Add: open the `LeaveConfirmModal`
   - On confirm: send `{ type: "leave" }` via `wsHook.send()`
   - Do NOT navigate — wait for server to broadcast `match_abandoned`

3. **Modify `match/[id]/page.tsx` abandonment handling**
   - When `status` transitions to `"abandoned"` (via `match_abandoned` event), the existing `resolvePageView` already returns `"abandoned"`, showing `AbandonedScreen`
   - No engine destroy needed — WS connection closes on page unmount

4. **Enhance `GameStatusOverlay` / `AbandonedScreen`**
   - The `match_abandoned` event includes `disconnectedPlayerId`
   - Store this in the game store so the overlay can display: "{username} left the match"
   - Fallback to "A player left the match" if username not available

5. **Add `matchAbandonedBy` field to game store**
   - New field: `matchAbandonedBy: string | null` (playerId of who caused abandonment)
   - Set when `match_abandoned` event is received with `reason: "forfeit"`
   - Cleared on `reset()`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/components/game/leave-confirm-modal.tsx` | New | Confirmation modal component |
| `packages/frontend/src/app/(game)/match/[id]/page.tsx` | Modified | Replace REST forfeit with WS leave; wire modal; remove immediate cleanup |
| `packages/frontend/src/stores/game-store.ts` | Modified | Add `matchAbandonedBy` field; set on `match_abandoned` event |
| `packages/frontend/src/hooks/use-websocket.ts` | Modified | Capture `match_abandoned` event data and pass to store |
| `packages/frontend/src/components/game/game-status-overlay.tsx` | Modified | Show forfeit player username in abandonment message |
| `packages/frontend/src/app/(game)/match/[id]/page-helpers.ts` | Minor | Update `AbandonedScreen` to accept and display leaving player name |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| User confirms leave but WS is already closed | Low | Send leave message best-effort; if WS is closed, the disconnect handler already covers this |
| `match_abandoned` event never arrives (network issue after send) | Low | Add a timeout: if no `match_abandoned` within 5s, assume it was sent and navigate to lobby anyway |
| Race: user clicks Leave, then WS disconnects before message is sent | Low | Modal check: only show "Leave Match" button if WS status is "connected" |

## Rollback Plan

- Delete `leave-confirm-modal.tsx`
- Revert `handleLeaveMatch` in `page.tsx` to original REST-based flow
- Remove `matchAbandonedBy` from store
- Revert `game-status-overlay.tsx` changes
- No backend changes to revert (backend was already correct)

## Dependencies

- Backend `leave` handler (already exists, no changes needed)
- `HandOverModal` pattern (reference for consistent modal styling)
- Player name resolution from Supabase profiles (already done during matchmaking)

## Success Criteria

- [ ] Clicking "Leave Match" shows a confirmation modal
- [ ] Confirming sends `{ type: "leave" }` via WebSocket (visible in network tab)
- [ ] Other players see "{username} left the match" within 1 second (not 60s)
- [ ] The leaving player sees "Match Abandoned" screen after server confirms
- [ ] REST POST to `/api/v1/matches/${id}/forfeit` is no longer called
- [ ] No existing tests broken (0 regressions)
- [ ] `bun test` passes
- [ ] `bun run biome:check` passes
- [ ] `tsc --noEmit` passes
