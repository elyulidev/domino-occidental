# Delta for Match Moves

## MODIFIED Requirements

### Requirement: Move Recording Module

The system SHALL export `recordMatchMove(move: MoveRecord): Promise<void>` from `packages/backend/src/db/moves.ts`. The function MUST persist the move to the database via Drizzle ORM's `db.insert(matchMoves).values({...})`. The function MUST be fire-and-forget (caller receives a void promise, never awaited). DB errors MUST be caught by `.catch()` and logged via `console.error`.

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

## ADDED Requirements

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

## REMOVED Requirements

None. All existing requirements (Table Schema, Move Numbering, RLS Policies, Indexes) remain unchanged.

## RENAMED Requirements

None.
