# Design: Leave Match Abandonment Fix

## Technical Approach

Replace the broken REST-based forfeit flow with the WebSocket `leave` message that the backend already supports. Add a confirmation modal, capture the `match_abandoned` event's `disconnectedPlayerId` from the WS events stream, store it for the overlay, and add a 5-second timeout fallback for network edge cases.

No backend changes required — `{ type: "leave" }` is already in `WsClientMessage` (handler.ts:18) and `match_abandoned` events already carry `disconnectedPlayerId` + `reason` (types.ts:289-293).

## Architecture Decisions

| Choice | Alternatives | Rationale |
|--------|-------------|-----------|
| Modal: **local `useState`** in MatchContent | Zustand store field | Modal open/close is ephemeral UI — no cross-component sharing needed. Keeps store lean. |
| Store field: **`matchAbandonedBy: string \| null`** in GameState | Keep in component state, resolve from events inline | Overlay reads from store. Centralizing avoids prop-drilling through overlay → abandoned screen. |
| Timeout: **5s `setTimeout` in MatchContent** after sending leave | No timeout; rely on WS only | Covers edge case where leave msg sent but event lost. Server timeout (60s) is too slow for UX. |
| `match_abandoned` capture: **extract in `use-websocket.ts`** event loop | Handle in page component | Hook is the natural WS message parser. Keeps page clean. Store is the single source of truth. |

## Data Flow

```
User clicks "Leave Match"
    │
    ▼
LeaveMatchConfirmModal opens (local useState)
    │
    ├── Cancel → close modal, no action
    │
    └── Confirm → wsHook.send({ type: "leave" })
                     │
                     ▼
              Server processes forfeitMatch()
              Broadcasts game_events with:
                - match_abandoned event { disconnectedPlayerId, reason: "forfeit" }
                - state { status: "abandoned", ... }
                     │
                     ▼
              use-websocket.ts onmessage:
                1. Extract match_abandoned → store matchAbandonedBy in game store
                2. applyWsUpdate(state) → sets status: "abandoned"
                     │
                     ▼
              resolvePageView("abandoned") → "abandoned"
                     │
                     ▼
              AbandonedScreen renders with:
                "{username} left the match" (or fallback)
                     │
                     ▼
              User clicks "Back to Lobby" → reset() + router.push("/lobby")
```

**Timeout fallback** (5s after sending leave):
```
setTimeout → if status still !== "abandoned" → reset() + router.push("/lobby")
Clear timeout on: status change to "abandoned", unmount, or modal close (cancel)
```

## File Changes

| File | Action | Lines Changed | Description |
|------|--------|:------------:|-------------|
| `packages/frontend/src/components/game/leave-confirm-modal.tsx` | **Create** | ~65 | New modal component following HandOverModal pattern |
| `packages/frontend/src/app/(game)/match/[id]/page.tsx` | Modify | ~30 net | Replace handleLeaveMatch, add modal state + timeout, remove REST code |
| `packages/frontend/src/stores/game-store.ts` | Modify | ~6 | Add `matchAbandonedBy` to GameState + default + reset |
| `packages/frontend/src/hooks/use-websocket.ts` | Modify | ~10 | Extract `match_abandoned` event, set store field |
| `packages/frontend/src/components/game/game-status-overlay.tsx` | Modify | ~15 | Use matchAbandonedBy for username resolution in abandoned message |

**Estimated total: ~125 lines changed (25 new component + ~100 modified)**

## Interfaces / Contracts

```typescript
// New component props
interface LeaveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

// New store field (added to GameState)
matchAbandonedBy: string | null;  // playerId who caused abandonment, null otherwise

// Existing WS message (no change needed)
// { type: "leave" } — already in WsClientMessage union

// Existing event (no change needed)
// { type: "match_abandoned"; disconnectedPlayerId: string; reason: "abandonment" | "forfeit" }
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `LeaveConfirmModal` renders, handles Escape, calls onConfirm/onClose | React Testing Library + Vitest |
| Unit | `buildMatchResultMessage` with matchAbandonedBy resolves username | Pure function test |
| Unit | Store `matchAbandonedBy` set/cleared on reset | Zustand store test |
| Integration | Full leave flow: modal → send → event → abandoned screen | WS mock + store assertions |
| Visual | Modal matches HandOverModal styling | Manual / Playwright screenshot |

## Migration / Rollout

No migration required. This is a frontend-only change with no schema or API changes. The backend `leave` handler and `match_abandoned` event are already deployed.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WS message sent but event never arrives | Low | Player stuck | 5s timeout fallback navigates to lobby |
| `name` field undefined on player | Medium | Generic fallback message | "A player left the match" fallback in overlay |
| Modal opens while WS already disconnected | Low | Leave message can't send | Check `wsHook.status === "connected"` before showing modal (already guarded by `send` returning silently) |

## Open Questions

None. All technical decisions are resolved from codebase analysis.
