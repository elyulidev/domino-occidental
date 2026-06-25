# Turn Manager Specification

## Purpose

Define `TurnState`, `TimeoutResult`, and pure functions for turn ordering, timeout enforcement, first-player selection, and null-round tracking. Module 4 of the GameState decomposition.

## Requirements

### Requirement: TurnState Type

The system MUST define a `TurnState` interface with `currentTurn: 0 | 1 | 2 | 3`, `turnDeadline: number | null` (Unix ms timestamp), `consecutiveNullRounds: number`, `roundNumber: number`, and `lastHandWinner: 0 | 1 | 2 | 3 | null`.

The system MUST define a `TimeoutResult` interface with `timedOut: boolean` and `playerIndex: number`.

#### Scenario: createTurnState returns default values

- GIVEN no prior turn state
- WHEN `createTurnState()` is called
- THEN `currentTurn` is `0`
- AND `turnDeadline` is `null`
- AND `consecutiveNullRounds` is `0`
- AND `roundNumber` is `0`
- AND `lastHandWinner` is `null`

### Requirement: Turn Advancement

The system MUST provide `advanceTurn(state)` that cycles `currentTurn` in order 0→1→2→3→0.

The system MUST provide `setCurrentTurn(state, playerIndex)` that returns a new state with the specified index.

The system MUST provide `getNextPlayer(state)` that returns the next player index without mutating state.

#### Scenario: advanceTurn cycles through all players

- GIVEN `currentTurn` is `0`
- WHEN `advanceTurn(state)` is called four times
- THEN the sequence of `currentTurn` values is `1`, `2`, `3`, `0`

#### Scenario: setCurrentTurn sets a valid index

- GIVEN any turn state
- WHEN `setCurrentTurn(state, 2)` is called
- THEN the returned state has `currentTurn === 2`

#### Scenario: setCurrentTurn throws on invalid index

- GIVEN any turn state
- WHEN `setCurrentTurn(state, 4)` is called
- THEN the function throws an error

#### Scenario: getNextPlayer returns correct next index

- GIVEN `currentTurn` is `1`
- WHEN `getNextPlayer(state)` is called
- THEN it returns `2`

### Requirement: Timeout Management

The system MUST provide `calculateDeadline(state, now?)` that sets `turnDeadline` to `now + 45000ms`.

The system MUST provide `checkTurnTimeout(state, now)` that returns `{ timedOut: true, playerIndex }` if `now >= deadline`, else `{ timedOut: false, playerIndex }`.

#### Scenario: calculateDeadline sets future deadline

- GIVEN a fixed `now`
- WHEN `calculateDeadline(state, now)` is called
- THEN `turnDeadline` equals `now + 45000`

#### Scenario: checkTurnTimeout returns false before deadline

- GIVEN `turnDeadline` is 30 seconds from now
- WHEN `checkTurnTimeout(state, now)` is called
- THEN `timedOut` is `false`

#### Scenario: checkTurnTimeout returns true after deadline

- GIVEN `turnDeadline` is 1 second ago
- WHEN `checkTurnTimeout(state, now)` is called
- THEN `timedOut` is `true` and `playerIndex` matches `currentTurn`

### Requirement: First Player Selection

The system MUST provide `getFirstPlayer(hands)` that selects the player with the highest double tile (by pip sum). If no player has doubles, selects the player with the highest sum of all tiles.

The system MUST provide `getFirstPlayer(hands, lastHandWinner)` that returns `lastHandWinner` for subsequent hands.

#### Scenario: getFirstPlayer selects highest double

- GIVEN player 2 has double-9 (sum 18), others have lower doubles or none
- WHEN `getFirstPlayer(hands)` is called
- THEN it returns `2`

#### Scenario: getFirstPlayer selects highest sum when no doubles

- GIVEN no player has a double tile
- WHEN `getFirstPlayer(hands)` is called
- THEN it returns the index of the player with the highest tile sum

#### Scenario: getFirstPlayer returns lastHandWinner for subsequent hand

- GIVEN `lastHandWinner` is `1`
- WHEN `getFirstPlayer(hands, 1)` is called
- THEN it returns `1` (ignoring hand contents)

### Requirement: Null Round Tracking

The system MUST provide `incrementNullRounds(state)` that increments `consecutiveNullRounds` by 1.

The system MUST provide `resetNullRounds(state)` that sets `consecutiveNullRounds` to 0.

#### Scenario: incrementNullRounds increments counter

- GIVEN `consecutiveNullRounds` is `0`
- WHEN `incrementNullRounds(state)` is called
- THEN `consecutiveNullRounds` is `1`

#### Scenario: resetNullRounds resets to zero

- GIVEN `consecutiveNullRounds` is `3`
- WHEN `resetNullRounds(state)` is called
- THEN `consecutiveNullRounds` is `0`

### Requirement: Round State Detection

The system MUST provide `isNewRound(state)` that returns `true` when `roundNumber` is 0, `turnDeadline` is null, and `currentTurn` is 0.

#### Scenario: isNewRound returns true for initial state

- GIVEN a freshly created turn state
- WHEN `isNewRound(state)` is called
- THEN it returns `true`

#### Scenario: isNewRound returns false after turn advancement

- GIVEN a turn state after at least one turn has been taken
- WHEN `isNewRound(state)` is called
- THEN it returns `false`

### Requirement: Constants

The system MUST export `TURN_TIMEOUT_MS = 45000` and `PLAYER_COUNT = 4` as const values.

#### Scenario: constants have expected values

- GIVEN the turn module
- WHEN reading exported constants
- THEN `TURN_TIMEOUT_MS` is `45000` and `PLAYER_COUNT` is `4`
