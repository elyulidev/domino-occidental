# Game State Store Tasks (Module 8)

**What**: Break down Module 8: Game State Store implementation into concrete TDD tasks per specification

**Why**: Orchestrator requested task breakdown for game-state-store module following strict TDD approach (tests first). Need to implement 8 exported functions in src/game/store.ts with comprehensive test coverage

**Review Workload Forecast**

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180 lines (12 test cases + 8 function implementations) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

## Phase 1: Test Scaffolding

- [ ] 1.1 Create `src/game/__tests__/store.test.ts`
- [ ] 1.2 Write `beforeEach` block calling `resetStore()`
- [ ] 1.3 Add `resetStore()` to `src/game/store.ts` (test-only export)

## Phase 2: createGame & getGame

- [ ] 2.1 Implement `createGame(matchId: string, state: MatchState): void`
- [ ] 2.2 Test new match storage: createGame then getGame returns state
- [ ] 2.3 Test duplicate overwrite: createGame with same matchId replaces state
- [ ] 2.4 Implement `getGame(matchId: string): MatchState | null`
- [ ] 2.5 Test existing match retrieval
- [ ] 2.6 Test missing match returns null

## Phase 3: updateGame & removeGame

- [ ] 3.1 Implement `updateGame(matchId: string, state: MatchState): void`
- [ ] 3.2 Test update existing match returns new state
- [ ] 3.3 Test update missing match (silent no-op)
- [ ] 3.4 Implement `removeGame(matchId: string): boolean`
- [ ] 3.5 Test remove existing returns true
- [ ] 3.6 Test remove missing returns false

## Phase 4: hasGame & getActiveCount

- [ ] 4.1 Implement `hasGame(matchId: string): boolean`
- [ ] 4.2 Test hasGame returns true for existing match
- [ ] 4.3 Test hasGame returns false for missing match
- [ ] 4.4 Implement `getActiveCount(): number`
- [ ] 4.5 Test getActiveCount returns 0 for empty store
- [ ] 4.6 Test getActiveCount returns correct count after adds/removes

## Phase 5: cleanup

- [ ] 5.1 Implement `cleanup(maxAgeMs: number): number`
- [ ] 5.2 Test cleanup removes stale matches (mostRecent > maxAgeMs)
- [ ] 5.3 Test cleanup keeps recent matches (any player activity < maxAgeMs)
- [ ] 5.4 Test cleanup returns count of removed entries
- [ ] 5.5 Test cleanup on empty store returns 0

## Phase 6: getAllActive

- [ ] 6.1 Implement `getAllActive(): [string, MatchState][]`
- [ ] 6.2 Test getAllActive returns snapshot for non-empty store
- [ ] 6.3 Test getAllActive returns empty array for empty store
- [ ] 6.4 Verify snapshot immutability (optional)

## Phase 7: Verification

- [ ] 7.1 Run `bun test --coverage` to validate all functionality
- [ ] 7.2 Verify coverage meets >80% requirement
- [ ] 7.3 Confirm no test regressions in existing codebase
