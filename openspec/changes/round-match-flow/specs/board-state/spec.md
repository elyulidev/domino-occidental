# Delta for Board State

## ADDED Requirements

### Requirement: isBlocked()

The system MUST provide a pure `isBlocked(board: BoardState, players: [PlayerState, PlayerState, PlayerState, PlayerState]): boolean` function that returns `true` iff no player with a non-empty hand can play any tile on either board end.

#### Scenario: All hands blocked

- GIVEN `leftEnd = 3`, `rightEnd = 7`
- AND all 4 players hold tiles matching neither 3 nor 7
- WHEN `isBlocked(board, players)` is called
- THEN it MUST return `true`

#### Scenario: At least one player can play

- GIVEN `leftEnd = 4`
- AND at least one player has a tile matching 4 (e.g. [4, 7])
- WHEN `isBlocked(board, players)` is called
- THEN it MUST return `false`

#### Scenario: Empty-handed player ignored

- GIVEN P1 has an empty hand (already won the hand)
- AND P2, P3, P4 hold no playable tiles
- WHEN `isBlocked(board, players)` is called
- THEN it MUST return `true` (only non-empty hands are checked)

#### Scenario: Original state immutable

- GIVEN a valid board and players
- WHEN `isBlocked` is called
- THEN neither the board nor any player state is modified
