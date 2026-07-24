# Design: CPU Game Bugfix & Abandon Feature

## Technical Approach

Two frontend-only changes — a one-line bugfix and a UI feature reusing existing patterns:

1. **Bugfix**: `createPlayer()` sets `isConnected: false` by design (players start disconnected until the server marks them connected). `initCpuMatch()` never overrides this. Fix: after `startHand()`, map all 4 players to `isConnected: true` before constructing the `LocalGameEngine`.

2. **Abandon button**: Mirror the online match leave pattern already in `match/[id]/page.tsx` — absolute-positioned destructive button + `LeaveMatchConfirmModal`. On confirm, call `reset()` + `router.push("/lobby")`. No WS message, no DB writes (CPU matches are ephemeral).

## Architecture Decisions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Fix `isConnected` in `createPlayer()` | Breaks server-side convention where players genuinely start disconnected | No — fix only in `initCpuMatch()` |
| Fix in `initializeMatch()` (shared pkg) | Pollutes shared code with frontend-only concern | No — fix in the store consumer |
| New abandon button in `player-hand.tsx` | Mixes game logic component with page-level navigation | No — keep in `cpu/page.tsx` |
| Reuse `LeaveMatchConfirmModal` | Already styled and accessible; CPU confirm just calls `reset()` instead of WS leave | **Yes** |
| Custom confirmation (window.confirm) | Inconsistent with online match UX; no animation/backdrop | No |
| Set status to `'abandoned'` before reset | Triggers `GameStatusOverlay` briefly before unmount — confusing UX | No — reset directly |

## Data Flow

```
User clicks "Abandonar Partida" (cpu/page.tsx)
  │
  ▼
LeaveMatchConfirmModal opens (reused component)
  │
  ├─ Cancel/Escape → close modal, game continues
  │
  └─ Confirm → cpu/page.tsx handleConfirmAbandon()
        │
        ├─ isAbandonedRef.current = true  (cancels pending bot callbacks)
        ├─ reset()                         (clears Zustand store + engine.destroy())
        └─ router.push("/lobby")           (navigates away)
```

```
Bugfix flow (initCpuMatch):

  createDeck() → deal() → initializeMatch()
    └─ createPlayer("p0..p3") → isConnected: false  ← BUG
  startHand()
  new LocalGameEngine(match, 0)
    └─ match.players[i].isConnected still false
    └─ validateAction() → PLAYER_DISCONNECTED        ← ALL MOVES FAIL

  FIX: After startHand(), map players to { ...p, isConnected: true }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/frontend/src/stores/game-store.ts` | Modify | After `startHand()` in `initCpuMatch()`, map all 4 players to `isConnected: true` before constructing engine |
| `packages/frontend/src/app/(game)/cpu/page.tsx` | Modify | Add abandon button (absolute-positioned in hand area), `LeaveMatchConfirmModal`, `isAbandoned` ref to guard async callbacks |

## Interfaces / Contracts

No new interfaces. Reuses existing:

```typescript
// LeaveMatchConfirmModal props (already exists)
interface LeaveMatchConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  playerName?: string;
}

// Existing store reset action (no changes needed)
reset: () => void  // clears store + calls engine.destroy()
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `initCpuMatch()` produces players with `isConnected: true` | Assert on store state after `initCpuMatch()` |
| Unit | Bot callback is guarded after abandon | Simulate abandon during bot processing, verify no state update |
| Integration | Full CPU match flow: play tiles, pass, abandon | Mount `CpuMatchPage`, interact via store |
| Visual | Abandon button visible, modal opens/closes | Existing test patterns for modal components |

## Migration / Rollout

No migration required. Frontend-only, no DB or backend changes. Deploy via normal Vercel pipeline.

## Open Questions

None — all decisions are clear from the codebase patterns.
