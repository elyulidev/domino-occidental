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

The system SHALL export `recordMatchMove(move: MoveRecord): void` from `packages/backend/src/db/moves.ts`. The function MUST persist the move to the database via Drizzle ORM's `db.insert(matchMoves).values({...})`. The function MUST be fire-and-forget (caller receives a void promise, never awaited). DB errors MUST be caught by `.catch()` and logged via `console.error`.

(Previously: function persisted moves via raw `postgres` SQL tagged template strings)

#### Scenario: Record a play move (happy path)

- GIVEN `SUPABASE_DB_URL` is set and the Drizzle client connects via `getDb()`
- WHEN `recordMatchMove` is called with a valid `MoveRecord` where `isPass = false`
- THEN `db.insert(matchMoves).values()` is called with fields mapped: `matchId → match_id`, `roundNumber → round_number`, `playerIndex → player_index`, `moveNumber → move_number`, `isPass → is_pass`, `actionSource → action_source`, `tileId → tile_id`, `tileTop → tile_top`, `tileBottom → tile_bottom`, `side → side`, `boardLeftEnd → board_left_end`, `boardRightEnd → board_right_end`
- AND the insert is fire-and-forget (void, not awaited)
- AND the game loop is never blocked

#### Scenario: Record a pass move (happy path)

- GIVEN `SUPABASE_DB_URL` is set and the Drizzle client connects via `getDb()`
- WHEN `recordMatchMove` is called with a valid `MoveRecord` where `isPass = true`
- THEN `db.insert(matchMoves).values()` is called with `is_pass = true`
- AND `tile_id`, `tile_top`, `tile_bottom`, `side` are all `NULL`
- AND the insert is fire-and-forget

#### Scenario: Console fallback when DB is unavailable

- GIVEN `SUPABASE_DB_URL` is NOT set (local dev)
- WHEN `recordMatchMove` is called
- THEN `getDb()` returns `null`
- AND move data is logged to console in a structured format
- AND no database connection is attempted
- AND no error propagates to the caller

#### Scenario: Error handling on DB failure

- GIVEN the Drizzle client is connected but `db.insert().values()` fails (e.g., constraint violation)
- WHEN `recordMatchMove` is called
- THEN the error is caught by the `.catch()` handler
- AND the error is logged to console.error with `[db/moves]` prefix
- AND no error propagates to the game loop

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

### Requirement: Drizzle Client Initialization

The system SHALL create `packages/backend/src/db/client.ts` exporting `getDb(): Promise<DrizzleDB | null>`. The client MUST use `drizzle(postgresClient, { schema })` from `drizzle-orm/postgres-js`. The connection MUST use the same lazy-init pattern as the current `moves.ts` (check `SUPABASE_DB_URL`, deduplicate concurrent init, return null when unset).

#### Scenario: DB client initializes on first call

- GIVEN `SUPABASE_DB_URL` is set
- WHEN `getDb()` is called for the first time
- THEN a `postgres` connection is created with `{ max: 1, idle_timeout: 10 }`
- AND a Drizzle client wraps it with the `matchMoves` schema
- AND subsequent calls return the cached instance

#### Scenario: DB client returns null when env var missing

- GIVEN `SUPABASE_DB_URL` is not set
- WHEN `getDb()` is called
- THEN `null` is returned without attempting any connection

### Requirement: Schema Barrel Export

The system SHALL create `packages/backend/src/db/schema/index.ts` re-exporting `matchMoves` from `./match-moves`. This barrel MUST be the single import point for all Drizzle schemas.

#### Scenario: Barrel export resolves correctly

- GIVEN `packages/backend/src/db/schema/index.ts` exists
- WHEN importing `{ matchMoves }` from the barrel
- THEN the import resolves to the same `matchMoves` table defined in `./match-moves.ts`

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
