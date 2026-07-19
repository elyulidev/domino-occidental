# Tasks: Fix Leave Match — Instant Forfeit via WebSocket

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~125 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full leave-match abandonment fix | PR 1 | Single PR — all files, ~125 lines |

## Phase 1: Store Foundation

- [ ] 1.1 Add `matchAbandonedBy: string | null` to `GameState` interface in `packages/frontend/src/stores/game-store.ts` — add field after `disconnectedSince` (~1 line)
- [ ] 1.2 Set `matchAbandonedBy: null` in `defaultGameState` object in `game-store.ts` (~1 line)
- [ ] 1.3 Add `matchAbandonedBy` to `syncGameState` return — spread existing value so WS updates don't clear it (~1 line)
- [ ] 1.4 Clear `matchAbandonedBy: null` in `reset()` action in `game-store.ts` (~1 line)

## Phase 2: WebSocket Event Capture

- [ ] 2.1 In `packages/frontend/src/hooks/use-websocket.ts` `ws.onmessage` handler: extract `match_abandoned` events from `msg.events` array — check for `e.type === "match_abandoned"` and read `disconnectedPlayerId` and `reason` (~5 lines)
- [ ] 2.2 When `match_abandoned` with `reason === "forfeit"` is found, call `useGameStore.getState()` to set `matchAbandonedBy` to `disconnectedPlayerId` (~3 lines)

## Phase 3: Confirmation Modal

- [ ] 3.1 Create `packages/frontend/src/components/game/leave-confirm-modal.tsx` with `LeaveConfirmModalProps` interface: `{ isOpen: boolean; onClose: () => void; onConfirm: () => void }` (~5 lines)
- [ ] 3.2 Implement modal UI: fixed overlay (`bg-black/60 backdrop-blur-sm`), centered card (`rounded-2xl border border-domino-700/50 bg-domino-900/60`), matching `HandOverModal` pattern (~20 lines)
- [ ] 3.3 Add title "Leave Match?" and body text "Are you sure you want to leave the match? This will end the game for all players." (~5 lines)
- [ ] 3.4 Add "Cancel" button (default/neutral style, calls `onClose`) and "Leave Match" button (red destructive: `bg-red-500 hover:bg-red-600`, calls `onConfirm`) (~10 lines)
- [ ] 3.5 Add `useEffect` for Escape key handler: `onKeyDown` listener calls `onClose` when `Escape` pressed, cleanup on unmount (~8 lines)
- [ ] 3.6 Add ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on title element (~3 lines)

## Phase 4: Page Integration

- [ ] 4.1 In `packages/frontend/src/app/(game)/match/[id]/page.tsx`: add `useState<boolean>` for `showLeaveModal`, default `false` (~1 line)
- [ ] 4.2 Replace `handleLeaveMatch` body: remove REST `fetch` call and immediate `wsHook.engine.destroy()` + `reset()` + `router.push()` — replace with `setShowLeaveModal(true)` (~net -10 lines)
- [ ] 4.3 Add `handleConfirmLeave` callback: call `wsHook.send({ type: "leave" })`, close modal, start 5s timeout fallback (`setTimeout` → if `status !== "abandoned"` then `reset()` + `router.push("/lobby")`) (~10 lines)
- [ ] 4.4 Add cleanup for timeout in `useEffect` return: clear timeout on unmount, and clear when `status` becomes `"abandoned"` (~5 lines)
- [ ] 4.5 Render `<LeaveMatchConfirmModal>` in the game board return block, wired to `showLeaveModal`, `handleConfirmLeave`, and modal close handler (~3 lines)
- [ ] 4.6 Update `AbandonedScreen` to accept optional `abandonedByPlayerName?: string` prop — display "{name} left the match" if provided, else "A player left the match" (~5 lines)

## Phase 5: Overlay Username Resolution

- [ ] 5.1 In `packages/frontend/src/components/game/game-status-overlay.tsx`: read `matchAbandonedBy` from `useGameStore` (~1 line)
- [ ] 5.2 Read `players` array from `useGameStore` to resolve `matchAbandonedBy` playerId to a username via `players.find(p => p.id === matchAbandonedBy)?.name` (~3 lines)
- [ ] 5.3 Pass resolved username to `buildMatchResultMessage` or handle inline: if `status === "abandoned"` and `matchAbandonedBy` is set, use "{username} left the match" as subtitle; fallback to existing generic message (~5 lines)

## Phase 6: Testing

- [ ] 6.1 Write unit test for `LeaveConfirmModal`: renders with title/body, Escape closes without calling onConfirm, Cancel calls onClose, confirm button calls onConfirm (~10 lines in `packages/frontend/src/components/game/__tests__/leave-confirm-modal.test.tsx`)
- [ ] 6.2 Add test for `buildMatchResultMessage` with `matchAbandonedBy`: verify subtitle includes username when provided, falls back to generic when null (~5 lines in existing `game-status-overlay.test.ts`)
- [ ] 6.3 Add test for `game-store` `matchAbandonedBy`: verify field defaults to null, set via store update, cleared on reset (~5 lines in existing `game-store.test.ts`)

## Phase 7: Verification

- [ ] 7.1 Run `bun test` — all tests pass
- [ ] 7.2 Run `bun run biome:check` — no lint/format errors
- [ ] 7.3 Run `bunx tsc --noEmit` — no type errors
- [ ] 7.4 Verify no REST call to `/api/v1/matches/${id}/forfeit` remains in codebase
