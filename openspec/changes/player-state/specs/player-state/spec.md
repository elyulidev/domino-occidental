# Player State Specification

## Purpose

Define the `PlayerState` type and pure functions for individual player management — hand tiles, connection status, and pass tracking. Follows the immutable, stateless pattern established by the Deck module. Hand operations (`removeTile`, `addTile`, `hasTile`) accept `Tile[]` directly rather than `PlayerState` to remain reusable outside player context.

## Requirements

### Requirement: PlayerState Type

The system MUST define a `PlayerState` interface in `src/game/types.ts` with fields `id` (`string`), `hand` (`Tile[]`), `consecutivePasses` (`number`), `isConnected` (`boolean`), and `lastActionAt` (`Date`).

#### Scenario: PlayerState has correct shape

- GIVEN a valid `PlayerState` object
- WHEN inspected
- THEN `id` MUST be a non-empty string
- AND `hand` MUST be a `Tile[]` array
- AND `consecutivePasses` MUST be a `number`
- AND `isConnected` MUST be a `boolean`
- AND `lastActionAt` MUST be a `Date`

### Requirement: createPlayer Factory

`createPlayer(playerId: string): PlayerState` MUST return a `PlayerState` with the given `id`, an empty `hand`, `isConnected: true`, `consecutivePasses: 0`, and `lastActionAt` set to `new Date()`.

#### Scenario: Creates player with default values

- GIVEN the player ID `"p1"`
- WHEN `createPlayer("p1")` is called
- THEN the result MUST have `id: "p1"`, empty `hand`, `isConnected: true`, `consecutivePasses: 0`
- AND `lastActionAt` MUST be a valid `Date` instance

### Requirement: Immutable Hand Manipulation

`removeTile(hand: Tile[], tileId: string): Tile[]` MUST return a new array excluding the tile with the matching `id`, and MUST throw a descriptive `Error` if no matching tile exists. `addTile(hand: Tile[], tile: Tile): Tile[]` MUST return a new array with the tile appended. Neither function MUST mutate the input array.

#### Scenario: removeTile removes correct tile

- GIVEN a hand with three tiles whose `id` values are `"a"`, `"b"`, `"c"`
- WHEN `removeTile(hand, "b")` is called
- THEN the result MUST contain exactly `"a"` and `"c"`
- AND the original hand array MUST remain unchanged

#### Scenario: removeTile throws on missing tile

- GIVEN a hand with no tile having `id: "missing"`
- WHEN `removeTile(hand, "missing")` is called
- THEN it MUST throw an `Error` whose message includes the missing tile ID

#### Scenario: addTile appends tile

- GIVEN a hand with two tiles
- WHEN `addTile(hand, newTile)` is called
- THEN the result MUST have a length of 3
- AND the last element MUST equal `newTile`
- AND the original hand array MUST remain unchanged

### Requirement: Tile Query

`hasTile(hand: Tile[], tileId: string): boolean` MUST return `true` if a tile with the given `id` exists in `hand`, `false` otherwise.

#### Scenario: hasTile returns true for existing tile

- GIVEN a hand containing a tile with `id: "a"`
- WHEN `hasTile(hand, "a")` is called
- THEN it MUST return `true`

#### Scenario: hasTile returns false for missing tile

- GIVEN a hand with no tile having `id: "missing"`
- WHEN `hasTile(hand, "missing")` is called
- THEN it MUST return `false`

#### Scenario: hasTile returns false for empty hand

- GIVEN an empty hand (`[]`)
- WHEN `hasTile([], "any")` is called
- THEN it MUST return `false`

### Requirement: Connection and Pass State

`setConnected(player: PlayerState, connected: boolean): PlayerState` MUST return a new `PlayerState` with the updated `isConnected` flag. `updateLastAction(player: PlayerState): PlayerState` MUST return a new `PlayerState` with `lastActionAt` set to `new Date()`. `incrementPasses(player: PlayerState): PlayerState` MUST return a new `PlayerState` with `consecutivePasses` increased by 1. `resetPasses(player: PlayerState): PlayerState` MUST return a new `PlayerState` with `consecutivePasses` set to 0. None of these functions MUST mutate the input.

#### Scenario: setConnected toggles flag

- GIVEN a connected player with `isConnected: true`
- WHEN `setConnected(player, false)` is called
- THEN the result MUST have `isConnected: false`
- AND the original player MUST be unchanged

#### Scenario: updateLastAction stamps current time

- GIVEN a player with a past `lastActionAt`
- WHEN `updateLastAction(player)` is called
- THEN the result MUST have `lastActionAt` set to a recent `Date` value
- AND the original player MUST be unchanged

#### Scenario: incrementPasses and resetPasses

- GIVEN a player with `consecutivePasses: 2`
- WHEN `incrementPasses(player)` is called
- THEN the result MUST have `consecutivePasses: 3`
- AND when `resetPasses(result)` is called
- THEN the second result MUST have `consecutivePasses: 0`

### Requirement: Hand Scoring

`sumHand(hand: Tile[]): number` MUST return the sum of all `top + bottom` values across tiles in the hand, or `0` for an empty hand.

#### Scenario: sumHand calculates correctly

- GIVEN a hand with tiles `[ { top: 3, bottom: 1 }, { top: 6, bottom: 6 } ]`
- WHEN `sumHand(hand)` is called
- THEN it MUST return `16` (3+1 + 6+6)

#### Scenario: sumHand returns zero for empty hand

- GIVEN an empty hand (`[]`)
- WHEN `sumHand([])` is called
- THEN it MUST return `0`
