# Scoring Specification

## Purpose

Pure functions for hand scoring, blocked-hand resolution, match-end detection, and null-round tracking in double-9 domino. All functions are immutable and side-effect-free.

## Requirements

### Requirement: PairIndex Mapping

`getPairIndex(playerIndex: number): PairIndex` MUST map players 0/2 → pair 0 and players 1/3 → pair 1.

#### Scenario: Player 0 → pair 0
- GIVEN player index 0
- WHEN `getPairIndex(0)` is called
- THEN it MUST return `0`

#### Scenario: Player 2 → pair 0
- GIVEN player index 2
- WHEN `getPairIndex(2)` is called
- THEN it MUST return `0`

#### Scenario: Player 1 → pair 1
- GIVEN player index 1
- WHEN `getPairIndex(1)` is called
- THEN it MUST return `1`

#### Scenario: Player 3 → pair 1
- GIVEN player index 3
- WHEN `getPairIndex(3)` is called
- THEN it MUST return `1`

### Requirement: calculateTotal

`calculateTotal(hand: Tile[]): number` MUST return the sum of `top + bottom` for every tile in the hand.

#### Scenario: Standard hand
- GIVEN a hand `[6-4, 3-2, 9-1]`
- WHEN `calculateTotal()` is called
- THEN it MUST return `25`

#### Scenario: Empty hand
- GIVEN an empty array
- WHEN `calculateTotal([])` is called
- THEN it MUST return `0`

### Requirement: scoreHand — Normal Win

When `isBlocked: false`, `scoreHand()` MUST award points equal to the sum of ALL three losing players' tile totals.

#### Scenario: P1 empties hand
- GIVEN hands `[ [], [3-2,1-1], [4-3], [6-2,0-0] ]` and `isBlocked: false`
- WHEN `scoreHand()` is called
- THEN `winnerPair` MUST be `0` and `points` MUST be sum(P2+P3+P4)

#### Scenario: P2 empties hand
- GIVEN hands `[ [5-2], [], [1-1], [3-0] ]` and `isBlocked: false`
- WHEN `scoreHand()` is called
- THEN `winnerPair` MUST be `1` and `points` MUST be sum(P1+P3+P4)

### Requirement: scoreHand — Blocked Hand

When `isBlocked: true`, the pair with the lower individual sum wins. A tie annuls the hand.

#### Scenario: Lower pair wins
- GIVEN player totals `[10, 20, 5, 25]` and `isBlocked: true`
- WHEN `scoreHand()` is called
- THEN `winnerPair` MUST be `0` with `points: 45`

#### Scenario: Tie → null round
- GIVEN player totals `[10, 15, 20, 5]` and `isBlocked: true`
- WHEN `scoreHand()` is called
- THEN `nullRound` MUST be `true` and `points: 0`

### Requirement: Annulled Round Cascade

When `consecutiveAnnulled >= 4`, `scoreHand()` SHALL override to lowest global individual sum and treat the round as non-null.

#### Scenario: Third annulled is normal
- GIVEN `consecutiveAnnulled: 2` with a tie
- WHEN `scoreHand()` is called
- THEN it MUST return `nullRound: true`

#### Scenario: Fourth annulled forces winner
- GIVEN `consecutiveAnnulled: 3` with a tie
- WHEN `scoreHand()` is called
- THEN it MUST return `nullRound: false`
- AND the winner MUST be the player with the lowest individual sum

### Requirement: ScoreState

`createScoreState()` MUST return `{ scores: [0, 0], isTiebreaker: false }`. `applyHandResult(state, result)` MUST return a new ScoreState with points added to the winner pair.

#### Scenario: Factory defaults
- GIVEN no input
- WHEN `createScoreState()` is called
- THEN it MUST return `{ scores: [0, 0], isTiebreaker: false }`

#### Scenario: Points accumulation
- GIVEN state `{ scores: [100, 80], isTiebreaker: false }` and result `{ winnerPair: 0, points: 25 }`
- WHEN `applyHandResult()` is called
- THEN the returned state MUST have `scores: [125, 80]`

#### Scenario: Immutability
- GIVEN an existing ScoreState and HandResult
- WHEN `applyHandResult()` is called
- THEN the original state MUST NOT be mutated

### Requirement: Match End Detection

`checkMatchEnd(state)` MUST return `MatchResult` indicating whether a pair has reached the 200-point target.

#### Scenario: Both under 200
- GIVEN `scores: [120, 90]`
- WHEN `checkMatchEnd()` is called
- THEN `isOver` MUST be `false`

#### Scenario: One pair reaches 200
- GIVEN `scores: [200, 140]`
- WHEN `checkMatchEnd()` is called
- THEN `isOver` MUST be `true`, `winner: 0`, `reason: "reached_target"`

#### Scenario: Both over 200, higher wins
- GIVEN `scores: [220, 205]`
- WHEN `checkMatchEnd()` is called
- THEN `isOver` MUST be `true`, `winner: 0`, `reason: "both_over_200"`

#### Scenario: Exact tie at 200+ → tiebreaker
- GIVEN `scores: [215, 215]`
- WHEN `checkMatchEnd()` is called
- THEN `isOver` MUST be `false`, `winner: null`, `reason: "tiebreaker"`
