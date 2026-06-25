# Tasks: Turn Manager Implementation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~220 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add TurnState, TimeoutResult types and constants in `src/game/types.ts` | PR 1 | Also adds TURN_TIMEOUT_MS, PLAYER_COUNT |
| 2 | Implement 5 core turn functions: `createTurnState`, `advanceTurn`, `setCurrentTurn`, `getNextPlayer`, `calculateDeadline` | PR 2 | Base = PR 1 branch; test-impaired safe unit |
| 3 | Implement 4 timeout/norm-round functions: `checkTurnTimeout`, `incrementNullRounds`, `resetNullRounds`, `isNewRound` | PR 3 | Base = PR 2 branch; critical null-deadline guard |
| 4 | Implement `getFirstPlayer` with two signatures and full edge-case handling | PR 4 | Base = PR 3 branch; includes tests for doubles, sums, tie-breaking |

## Phase 1: Infrastructure / Foundation

- [x] 1.1 Add `TurnState` and `TimeoutResult` interfaces to `src/game/types.ts`
- [x] 1.2 Export `TURN_TIMEOUT_MS = 45_000` and `PLAYER_COUNT = 4` from `src/game/turn.ts`
- [x] 1.3 Create `src/game/turn.ts` with pure function signatures
- [x] 1.4 Create `src/game/__tests__/turn.test.ts` with scaffolding

## Phase 2: Core Turn Functions

- [x] 2.1 Implement `createTurnState()`: Returns initial state with `currentTurn: 0`, `turnDeadline: null`, etc.
- [x] 2.2 Implement `advanceTurn(state)`: Cycles 0→1→2→3→0, returning new state
- [x] 2.3 Implement `setCurrentTurn(state, playerIndex)`: Validates and sets turn, throws on invalid index
- [x] 2.4 Implement `getNextPlayer(state)`: Returns next player index, no mutation
- [x] 2.5 Implement `calculateDeadline(state, now?)`: Sets `turnDeadline = now + 45_000`, overwrites existing

## Phase 3: Timeout & Round Management

- [x] 3.1 Implement `checkTurnTimeout(state, now)` with NULL guard: When `turnDeadline === null` → `timedOut: false`
- [x] 3.2 Write comprehensive tests for timeout timing (before, after, edge cases)
- [x] 3.3 Implement `incrementNullRounds(state)`: Increments `consecutiveNullRounds`
- [x] 3.4 Implement `resetNullRounds(state)`: Sets to 0
- [x] 3.5 Implement `isNewRound(state)`: Returns `true` only when fresh (`roundNumber === 0` && `turnDeadline === null`)

## Phase 4: First-Player Selection

- [x] 4.1 Implement `getFirstPlayer(hands)`: Scans for highest double; fallback to highest sum; tie → lowest index
- [x] 4.2 Implement `getFirstPlayer(hands, lastHandWinner?)`: If provided, returns winner (ignores hands)
- [x] 4.3 Add Tile type checking: Ensure hands are `Tile[][]` (can use existing `Tile` interface)
- [x] 4.4 Handle edge cases: Empty hands, no doubles, all zero tiles, duplicate sums

## Phase 5: Testing

- [x] 5.1 Write tests covering all spec scenarios:
- [x] 5.1.1 `createTurnState` defaults
- [x] 5.1.2 `advanceTurn` cycling through 0→1→2→3→0
- [x] 5.1.3 `setCurrentTurn` validation and error handling
- [x] 5.1.4 `getNextPlayer` preview and immutability
- [x] 5.1.5 `calculateDeadline` deadline setting
- [x] 5.2 Implement `checkTurnTimeout` null guard scenario
- [x] 5.3 Implement `checkTurnTimeout` timing scenarios (before, after)
- [x] 5.4 Implement `getFirstPlayer` selection logic (double, sum, winner)
- [x] 5.5 Implement `incrementNullRounds` and `resetNullRounds` scenarios
- [x] 5.6 Implement `isNewRound` detection logic
- [x] 5.7 Write integration scenarios: Turn manager contracts with game-engine flow
- [x] 5.8 Verify immutability: Ensure all functions return new state
- [x] 5.9 Run `bun test` to pass all turn tests
- [x] 5.10 Verify TypeScript compilation

## Phase 6: Cleanup / Documentation

- [x] 6.1 Add proper JSDoc comments for all exported functions
- [x] 6.2 Add module-level comments explaining purpose and contracts
- [x] 6.3 Ensure test coverage > 80% – run `bun test --coverage`
- [x] 6.4 Run `bun run biome:check` for code quality
- [x] 6.5 Verify no existing tests broken (deck, board, player modules)

## Implementation Order

**Priority Order** (based on dependency analysis):
1. Phase 1: Types + scaffolding – all functions depend on these
2. Phase 2: Core turn functions – most tests depend on these
3. Phase 3: Timeout and null-round logic – critical for timeout guard
4. Phase 4: First-player selection – complex logic with edge cases
5. Phase 5: Testing – runs tests for all phases, validates everything
6. Phase 6: Cleanup – final polish, documentation, quality checks

**Rationale**: This order ensures that foundational types are in place before implementations, critical timeout logic is validated early, and comprehensive testing covers all phases before final verification.

## Next Step

Ready for verify (sdd-verify).
