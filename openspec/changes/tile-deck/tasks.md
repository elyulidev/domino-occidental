# Tasks: Tile Deck Implementation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180 |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Create src/game directory and types.ts with Tile/DealResult | PR 1 | Base: openspec/tile-deck/specs/tile-deck/spec.md |
| 2 | Implement deck.ts with createDeck() and basic tests | PR 2 | Base: PR 1 branch; tests validate basic functionality |
| 3 | Add shuffle() and deal() with full test coverage | PR 3 | Base: PR 2 branch; complete deck operations |

## Phase 1: Infrastructure / Foundation

- [x] 1.1 Create `src/game` directory
- [x] 1.2 Create `src/game/types.ts` with `Tile` and `DealResult` interfaces
- [x] 1.3 Create `src/game/deck.ts` with function signatures and exports

## Phase 2: Core Implementation

- [ ] 2.1 Implement `createDeck()` creating 55 unique tiles (0-0 through 9-9) with crypto.randomUUID() IDs
- [ ] 2.2 Implement `shuffle()` with Fisher-Yates algorithm, immutable pattern
- [ ] 2.3 Implement `deal()` distributing 4×10 hands + 15 pool, throws on invalid input
- [ ] 2.4 Add TypeScript export declarations and module comments

## Phase 3: Testing / Verification

- [ ] 3.1 Write `src/game/__tests__/deck.test.ts` with 5 spec scenarios:
- [ ] 3.1.1 Create complete deck scenario
- [ ] 3.1.2 Shuffle unbiased permutation scenario
- [ ] 3.1.3 Deal distributes correctly scenario
- [ ] 3.1.4 Deal with insufficient tiles throws scenario
- [ ] 3.1.5 Tile IDs are unique across decks scenario
- [ ] 3.2 Run `bun test` to pass all tests
- [ ] 3.3 Verify TypeScript strict compilation with `tsc --noEmit`

## Phase 4: Cleanup / Documentation

- [ ] 4.1 Add `"test": "bun test"` to `package.json` scripts
- [ ] 4.2 Run `bun run biome:check` to validate code quality
- [ ] 4.3 Add documentation comments for exported functions

## Phase 5: Verification

- [ ] 5.1 Verify deck contains exactly 55 tiles
- [ ] 5.2 Verify all tile combinations (top ≤ bottom) exist exactly once
- [ ] 5.3 Verify shuffle immutability and produces valid permutation
- [ ] 5.4 Verify deal distribution (4×10 + 15) and no overlaps
- [ ] 5.5 Verify crypto.randomUUID() uniqueness across independent decks