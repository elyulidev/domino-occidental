# Proposal: Play vs CPU (Practice Mode)

## Intent

New users have no way to practice before playing online. The lobby only offers Quick Match (multiplayer), which requires opponents. A CPU practice mode lets users learn rules, test strategies, and build confidence — reducing churn from early frustration.

## Scope

### In Scope
- Frontend bot AI (`findBotMove()` ported from backend, ~40 lines)
- `LocalGameEngine.processBotTurns()` bot loop with visual delays
- New route `(game)/cpu/page.tsx` — local match, no WS, no DB
- Lobby entry point ("Play vs CPU" button/card)
- Zustand store `initCpuMatch()` action
- Result overlay: "You Won" / "You Lost" + back to lobby
- Turn timer disabled or shortened in local mode

### Out of Scope
- Backend changes (zero server-side work)
- Difficulty levels (AI level 1 only: random valid moves)
- ELO, coins, matchmaking, or persistence
- Anti-cheat (acceptable for practice)
- Replay, achievements, or stats tracking

## Capabilities

### New Capabilities
- `cpu-practice-mode`: Local CPU match — bot AI, game loop, entry point, result screen

### Modified Capabilities
None — all existing specs (round-match-flow, match-interface, game-state-store) are consumed unchanged via `LocalGameEngine`.

## Approach

Frontend-Only (Approach A from exploration). Port `findBotMove()` from `packages/backend/src/game/bot.ts` to `packages/frontend/src/lib/game/bot.ts`. Implement `processBotTurns()` on `LocalGameEngine` to loop bot turns with 1–2s `setTimeout` delays. Create `/cpu` route that calls `initCpuMatch()` (new store action) to initialize `LocalGameEngine` without WS. Modify game-status-overlay to detect CPU mode and show human-centric result text.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/lib/game/bot.ts` | Modified | Port `findBotMove()` from backend |
| `packages/frontend/src/lib/game/local-engine.ts` | Modified | Implement `processBotTurns()` loop |
| `packages/frontend/src/app/(game)/cpu/page.tsx` | New | CPU match page (no WS) |
| `packages/frontend/src/app/(dashboard)/lobby/_components/play-vs-cpu-button.tsx` | New | Entry point button |
| `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | Modified | Add CPU card |
| `packages/frontend/src/stores/game-store.ts` | Modified | Add `initCpuMatch()` |
| `packages/frontend/src/components/game/game-status-overlay.tsx` | Modified | Human-centric result text |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bot logic duplication (backend + frontend) | Medium | ~40 lines, shared `canPlay()` from `@domino/shared`; acceptable |
| Main thread blocking during bot turns | Low | Simple AI + `setTimeout` delays prevent jank |
| Match page WS dependency | Medium | Separate `/cpu` route avoids modifying WS path |

## Rollback Plan

Delete new files (`cpu/page.tsx`, `play-vs-cpu-button.tsx`), revert modified files to git HEAD. Zero backend changes means zero DB migration risk. Feature is fully isolated — no shared state with online mode.

## Dependencies

- None (all infrastructure already exists in shared package)

## Success Criteria

- [ ] User can start a CPU match from lobby in < 3 clicks
- [ ] 1 human + 3 bots play a full match to 200 points
- [ ] Bot plays valid moves with visible 1–2s delay
- [ ] Turn timer is disabled/shortened in CPU mode
- [ ] "You Won" / "You Lost" displayed correctly at match end
- [ ] User returns to lobby without errors
- [ ] No regressions in online multiplayer mode
