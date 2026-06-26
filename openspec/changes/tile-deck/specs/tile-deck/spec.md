# Tile Deck Specification

## Purpose

Define the Tile data structure and Deck operations (creation, shuffle, deal) for the double-9 domino set (55 tiles). These primitives are the foundation for all game logic — they MUST be correct, immutable by default, and independently testable.

## Requirements

### Requirement: Tile Interface

The system MUST define a `Tile` interface with `top` (`number`, 0–9), `bottom` (`number`, 0–9), and `id` (`string`) fields matching the canonical type in `src/game/types.ts`.

#### Scenario: Tile has correct shape

- GIVEN a valid tile object
- WHEN the tile is constructed
- THEN `top` and `bottom` MUST be integers in [0, 9]
- AND `id` MUST be a non-empty string

### Requirement: Complete Deck Creation

`createDeck()` MUST return exactly 55 unique tiles covering all double-9 combinations (i-0 through 9-9, where 0 ≤ top ≤ bottom ≤ 9) exactly once, each with a distinct `id`.

#### Scenario: Full set generated

- GIVEN no input
- WHEN `createDeck()` is called
- THEN it MUST return an array of exactly 55 `Tile` objects
- AND every combination (top, bottom) where 0 ≤ top ≤ bottom ≤ 9 MUST appear exactly once
- AND all 55 `id` values MUST be distinct

### Requirement: Immutable Shuffle

`shuffle(deck: Tile[]): Tile[]` MUST return a new array with tiles permuted using the standard Fisher-Yates algorithm, MUST NOT mutate the input array, and MUST handle edge cases gracefully.

#### Scenario: Shuffle produces permutation

- GIVEN a deck of 55 tiles
- WHEN `shuffle()` is called
- THEN the returned array MUST be the same length (55)
- AND it MUST contain the same tiles (same `id` values, different order)
- AND each position SHOULD contain each tile with approximately uniform probability

#### Scenario: Input array not mutated

- GIVEN a deck reference
- WHEN `shuffle(deck)` is called
- THEN the original array and its tile objects MUST be unchanged

#### Scenario: Empty deck

- GIVEN an empty array
- WHEN `shuffle([])` is called
- THEN it MUST return an empty array (no throw)

### Requirement: Correct Deal

`deal(deck: Tile[]): { hands: Tile[][]; pool: Tile[] }` MUST distribute 55 tiles into 4 hands of 10 tiles each and a pool of 15. It MUST throw a descriptive error for invalid input.

#### Scenario: Standard deal

- GIVEN a shuffled deck of exactly 55 tiles
- WHEN `deal()` is called
- THEN `hands` MUST have exactly 4 sub-arrays
- AND each sub-array MUST contain exactly 10 tiles
- AND `pool` MUST contain exactly 15 tiles
- AND all 55 tiles MUST be accounted for across hands and pool without overlap

#### Scenario: Insufficient tiles throws

- GIVEN a deck with fewer than 55 tiles
- WHEN `deal()` is called
- THEN it MUST throw a descriptive error indicating the shortfall
- AND the deck MUST NOT be mutated

### Requirement: Cryptographically Sound IDs

The system MUST generate tile IDs using `crypto.randomUUID()` or an equivalent cryptographically secure mechanism to guarantee global uniqueness.

#### Scenario: No ID collisions across decks

- GIVEN two independent calls to `createDeck()`
- WHEN comparing all 110 `id` values
- THEN they MUST all be distinct
