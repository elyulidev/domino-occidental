# Match Moves — Specification

## Purpose

Persist every `play_tile` and `pass` action to PostgreSQL via a fire-and-forget module for game replay, audit trail, and anti-collusion analysis.

## Requirements

### Requirement: Match Moves Table Schema

The system SHALL create a `public.match_moves` table with columns: `id` (uuid PK), `match_id` (uuid), `round_number` (integer), `player_index` (smallint 0–3), `move_number` (integer), `is_pass` (boolean), `tile_id` (text, nullable), `tile_top` (smallint, nullable), `tile_bottom` (smallint, nullable), `side` (text, nullable), `board_left_end` (smallint), `board_right_end` (smallint), `created_at` (timestamptz).

#### Scenario: Pass row has no tile data

- GIVEN a row where `is_pass = true`
- WHEN inserted into `match_moves`
- THEN `tile_id`, `tile_top`, `tile_bottom`, and `side` MUST all be `NULL`
- AND the `match_moves_data_check` constraint MUST pass

#### Scenario: Play row has all tile data

- GIVEN a row where `is_pass = false`
- WHEN inserted into `match_moves`
- THEN `tile_id`, `tile_top`, `tile_bottom`, and `side` MUST all be non-NULL
- AND `side` MUST be `'left'` or `'right'`
- AND both `match_moves_data_check` and `match_moves_side_check` MUST pass

#### Scenario: Invalid side value rejected

- GIVEN a row where `is_pass = false` and `side = 'up'`
- WHEN inserted into `match_moves`
- THEN the database MUST reject the insert with a constraint violation

### Requirement: Move Recording Module

The system SHALL export `recordMatchMove(move: MoveRecord): void` from `packages/backend/src/db/moves.ts`. The function MUST persist the move to the database asynchronously (fire-and-forget). It MUST NOT return a Promise or await the database write.

#### Scenario: Successful DB write

- GIVEN `SUPABASE_DB_URL` is set and postgres module is available
- WHEN `recordMatchMove` is called with a valid `MoveRecord`
- THEN the move is inserted into `public.match_moves`
- AND the function returns synchronously without awaiting
- AND DB errors are caught and logged via `console.error`

#### Scenario: Console fallback without DB

- GIVEN `SUPABASE_DB_URL` is not set in the environment
- WHEN `recordMatchMove` is called
- THEN the move is logged to console in a structured format
- AND no database connection is attempted
- AND no error is thrown

#### Scenario: Postgres module unavailable

- GIVEN `SUPABASE_DB_URL` is set but the `postgres` npm package cannot be imported
- WHEN `recordMatchMove` is called
- THEN a warning is logged via `console.warn`
- AND subsequent calls fall back to console logging

### Requirement: Move Numbering

The system SHALL assign sequential `move_number` values per match using an in-memory `Map<string, number>` counter. Counters MUST reset on server restart.

#### Scenario: Sequential numbering within a match

- GIVEN match `m1` has had 3 moves recorded
- WHEN the 4th move for `m1` is recorded
- THEN `move_number` MUST be `4`

#### Scenario: Independent numbering across matches

- GIVEN match `m1` has 5 moves and match `m2` has 2 moves
- WHEN a new move is recorded for `m2`
- THEN its `move_number` MUST be `3` (not 6)

### Requirement: RLS Policies

The `match_moves` table MUST have RLS enabled. Authenticated users MUST be able to SELECT rows. INSERT operations MUST be restricted to the server via `service_role`.

#### Scenario: Authenticated user reads moves

- GIVEN a user is authenticated
- WHEN querying `match_moves`
- THEN the query MUST return rows

#### Scenario: Client cannot insert directly

- GIVEN a user is authenticated
- WHEN attempting to INSERT into `match_moves` via anon key
- THEN the insert MUST be denied by RLS

### Requirement: Indexes

The system SHALL create two indexes: `idx_match_moves_match` on `(match_id, move_number)` for replay ordering, and `idx_match_moves_round` on `(match_id, round_number, move_number)` for round-level analysis.

## Data Contracts

### MoveRecord Interface

```typescript
interface MoveRecord {
  matchId: string
  roundNumber: number
  playerIndex: number
  moveNumber: number       // auto-assigned by recordMatchMove
  isPass: boolean
  tileId?: string          // required when isPass = false
  tileTop?: number         // required when isPass = false
  tileBottom?: number      // required when isPass = false
  side?: 'left' | 'right' // required when isPass = false
  boardLeftEnd: number | null
  boardRightEnd: number | null
}
```
