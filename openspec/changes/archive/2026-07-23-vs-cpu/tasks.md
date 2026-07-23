# Tasks: Play vs CPU (Practice Mode)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250–340 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | size-exception |

## Phase 1: Bot AI (Foundation)

- [x] 1.1 Port `findBotMove()` from `packages/backend/src/game/bot.ts` to `packages/frontend/src/lib/game/bot.ts`. Copy the pure function (prefer doubles, sort by pip count). Remove backend-only imports (`canPlay`, `passTurn`, `playTile`). Import `canPlay` from `@domino/shared/src/game`. (~40 lines)
- [x] 1.2 Create `packages/frontend/src/lib/game/__tests__/bot.test.ts` — unit tests for `findBotMove`: empty board returns first tile, doubles preferred, no valid moves returns null, valid moves on both sides. Use seeded Tile arrays. (~30 lines)

## Phase 2: Local Engine Bot Loop

- [x] 2.1 Modify `packages/frontend/src/lib/game/local-engine.ts` — implement `processBotTurns()`. Loop while `currentTurn !== 0 && status === "in_progress"`, call `findBotMove()`, execute via `sharedPlayTile`/`passTurn`, return after human turn or match end. Add `async` wrapper with `setTimeout` delays for visual feedback. Import `findBotMove` from `./bot`. (~35 lines)
- [x] 2.2 Create `packages/frontend/src/lib/game/__tests__/local-engine.test.ts` — test `processBotTurns` with fake timers: loops until human turn, handles match end, bot passes when no valid moves. (~40 lines)

## Phase 3: Store Integration

- [x] 3.1 Modify `packages/frontend/src/stores/game-store.ts` — add `initCpuMatch()` action. Import `createDeck`, `shuffle`, `deal`, `initializeMatch` from `@domino/shared/src/game`. Generate matchId with `crypto.randomUUID()`, deal 4 hands of 10 tiles, create MatchState, call `initEngine(match)`. (~30 lines)
- [x] 3.2 Create `packages/frontend/src/stores/__tests__/game-store.test.ts` — test `initCpuMatch` creates valid MatchState with 4 players, 10 tiles each, status "in_progress". (~25 lines)

## Phase 4: UI — Routes & Components

- [x] 4.1 Create `packages/frontend/src/app/(game)/cpu/page.tsx` — `"use client"` page. On mount: call `initCpuMatch()`, trigger `processBotTurns()`. Render `GameBoard`, `PlayerHand`, `ScorePanel`, `GameStatusOverlay`. Skip `useWebSocket`. Use `useGameStore` for state. (~55 lines)
- [x] 4.2 Create `packages/frontend/src/app/(dashboard)/lobby/_components/play-vs-cpu-button.tsx` — Button linking to `/cpu`. Match lobby card styling (gold gradient, rounded-xl). (~18 lines)
- [x] 4.3 Modify `packages/frontend/src/app/(dashboard)/lobby/page.tsx` — Add `PlayVsCpuCard` component after `QuickMatchCard`. Import `PlayVsCpuButton`. (~20 lines)

## Phase 5: Overlay Adaptation

- [x] 5.1 Modify `packages/frontend/src/components/game/game-status-overlay.tsx` — Add optional `isCpuMode` param to `buildMatchResultMessage()`. When true: pair 0 win → "¡Ganaste!", pair 1 win → "Perdiste". Read `isCpuMode` from store or prop. (~15 lines)

## Phase 6: Verification

- [x] 6.1 Run `bun test` — all unit tests pass (bot, local-engine, game-store, overlay).
- [x] 6.2 Run `bun run biome:check` — no lint/format errors in new/modified files.
- [x] 6.3 Run `bun run build` — successful production build.
- [ ] 6.4 Manual smoke test: lobby → click "Play vs CPU" → full match to 200 points → "You Won/Lost" overlay → back to lobby.
- [x] 6.5 Regression check: existing online multiplayer tests unchanged.
