# Board State Specification

## Purpose

Defines the domino board as an immutable linear chain of placed tiles with two open ends. Provides placement validation and immutable board mutations. Module 2 of the GameState decomposition.

## Requirements

### Requirement: BoardState Type

The system MUST define a `BoardState` type with `leftEnd`, `rightEnd`, and `tiles` fields representing the open ends and ordered list of placed tiles.

#### Scenario: Empty board

- GIVEN no tiles have been placed
- WHEN a `BoardState` is inspected
- THEN `leftEnd` SHALL be `null`, `rightEnd` SHALL be `null`, and `tiles` SHALL be an empty array

### Requirement: PlacedTile Type

The system MUST define a `PlacedTile` type containing a `Tile`, the `side` where it was placed (`'left'` or `'right'`), and the `playerId` who placed it.

#### Scenario: PlacedTile records placement metadata

- GIVEN a tile placed on the left by player "p1"
- WHEN inspecting the `PlacedTile`
- THEN `side` SHALL be `'left'` and `playerId` SHALL be `"p1"`

### Requirement: createBoard()

The system MUST provide a pure `createBoard()` function that returns an empty `BoardState`.

#### Scenario: Returns empty board

- GIVEN `createBoard()` is called
- THEN the result SHALL equal `{ leftEnd: null, rightEnd: null, tiles: [] }`

### Requirement: canPlay()

The system MUST provide a pure `canPlay(tile, side, board)` function returning `true` iff the tile can be placed on the specified side of the board.

#### Scenario: Empty board accepts any tile

- GIVEN an empty board
- WHEN `canPlay(tile, 'left', board)` is called for any tile
- THEN it SHALL return `true`

#### Scenario: Tile matches the target end

- GIVEN a board with `leftEnd: 5`
- WHEN `canPlay({ top: 3, bottom: 5 }, 'left', board)` is called
- THEN it SHALL return `true`

#### Scenario: Tile matches neither end

- GIVEN a board with `leftEnd: 5` and `rightEnd: 2`
- WHEN `canPlay({ top: 3, bottom: 7 }, 'left', board)` is called
- THEN it SHALL return `false`

#### Scenario: Tile matches both ends

- GIVEN a board with `leftEnd: 5` and `rightEnd: 5`
- WHEN `canPlay({ top: 5, bottom: 5 }, 'left', board)` is called
- THEN it SHALL return `true`

### Requirement: place()

The system MUST provide a pure `place(tile, side, playerId, board)` function that returns a NEW `BoardState` with the tile placed, without mutating the original board.

#### Scenario: First tile sets both ends

- GIVEN an empty board
- WHEN `place({ top: 4, bottom: 1 }, 'left', 'p1', board)` is called
- THEN the new board SHALL have `leftEnd: 1` and `rightEnd: 4`

#### Scenario: Tile extends left end

- GIVEN a board with `leftEnd: 3`
- WHEN `place({ top: 5, bottom: 3 }, 'left', 'p2', board)` is called
- THEN the new board SHALL have `leftEnd: 5` and `rightEnd` unchanged

#### Scenario: Tile extends right end

- GIVEN a board with `rightEnd: 6`
- WHEN `place({ top: 6, bottom: 8 }, 'right', 'p2', board)` is called
- THEN the new board SHALL have `rightEnd: 8` and `leftEnd` unchanged

#### Scenario: Original board is immutable

- GIVEN a board with one tile placed
- WHEN `place(...)` is called with a second tile
- THEN the original board SHALL remain unchanged

#### Scenario: Auto-flip matches the connecting end

- GIVEN a board with `leftEnd: 4`
- WHEN `place({ top: 4, bottom: 7 }, 'left', 'p1', board)` is called
- THEN the placed tile SHALL connect the matching value to the board, exposing `7` as the new `leftEnd`
