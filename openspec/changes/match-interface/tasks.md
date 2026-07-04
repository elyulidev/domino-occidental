# Tasks: Match Interface — Local Bot Game UI

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650 (6 files moved: ~400, 14 files new: ~250) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (move+backend) → PR 2 (store+engine) → PR 3 (components) → PR 4 (page) |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main|feature-branch-chain|size-exception|pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Move shared game functions from backend to shared | PR 1 | board.ts, player.ts, deck.ts, turn.ts, scoring.ts, match.ts |
| 2 | Update backend imports to shared | PR 1 | 6 files in backend/src/game/ import from @domino/shared/src/game |
| 3 | Add zustand and initialize store structure | PR 2 | Add dependency, create game + ui slices skeleton |
| 4 | Implement GameEngine interface | PR 2 | Define types.ts and create engine facade |
| 5 | Create LocalEngine with bot play logic | PR 2 | Load pure functions, implement play/pass actions |
| 6 | Implement bot logic helper | PR 2 | Choose first valid tile or pass |
| 7 | Create GameBoard component | PR 3 | Render domino tiles from store.board state |
| 8 | Create PlayerHand component | PR 3 | Display hand, handle tile selection and side choice |
| 9 | Create opponent indicator | PR 3 | Show hand size, connection status for bots |
| 10 | Create ScorePanel component | PR 3 | Show pair scores, round, target |
| 11 | Create TurnTimer component | PR 3 | 45s countdown for human player |
| 12 | Create GameStatusOverlay | PR 3 | Hand/match end UI with return to lobby |
| 13 | Create match page route | PR 4 | Initialize engine, wire store and components |

## Phase 1: Foundation (Move to Shared + Backend Updates)

- [x] 1.1 Move board.ts, player.ts, deck.ts, turn.ts, scoring.ts, match.ts to shared/src/game/
- [x] 1.2 Add re-export file packages/shared/src/game/index.ts
- [x] 1.3 Update backend/src/game/ imports to @domino/shared/src/game/ (6 files)

## Phase 2: Engine (Interface + Bot + Local Implementation)

- [x] 2.1 Create packages/frontend/src/lib/game/types.ts with GameEngine interface
- [x] 2.2 Create bot.ts: first valid tile or pass strategy
- [x] 2.3 Create local-engine.ts implementing GameEngine
- [x] 2.4 Add bot + engine unit tests (TDD: RED→GREEN→REFACTOR)

## Phase 3: Store (Zustand State Management)

- [x] 3.1 Add zustand to packages/frontend/package.json
- [x] 3.2 Create game-store.ts: game + ui slices, actions (playTile, pass, init)
- [x] 3.3 Add store action→event→state chain tests

## Phase 4: Components (UI Layer)

- [x] 4.1 Create game-board.tsx (board tiles with CSS orientation)
- [x] 4.2 Create player-hand.tsx (hand tiles + selection + side choice)
- [x] 4.3 Create opponent-indicator.tsx (card backs + handSize + status)
- [x] 4.4 Create score-panel.tsx (pair scores, round, target, last points)
- [x] 4.5 Create turn-timer.tsx (45s countdown, turn highlight)
- [x] 4.6 Create game-status-overlay.tsx (hand/match end, winner, return button)

## Phase 5: Page + Integration

- [x] 5.1 Create (game)/match/[id]/page.tsx as "use client"
- [x] 5.2 Wire engine init → store → components
- [x] 5.3 Handle errors (invalid matchId, abandoned state), cleanup on unmount

## Phase 6: Testing

- [ ] 6.1 Bot strategy unit tests (first valid, pass edge cases)
- [ ] 6.2 Store action→event→state integration tests
- [ ] 6.3 Run existing backend tests: bun test (no regression)
- [ ] 6.4 Manual: full game flow deal→play→hand end→match end
