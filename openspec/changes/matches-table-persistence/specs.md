# Specs: Matches Table Persistence

---

## Domain: match-persistence (NEW)

### Requirement: Matches Table Schema

The system SHALL create a `public.matches` table with the following columns:

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `uuid` | PRIMARY KEY | `gen_random_uuid()` |
| `player0_id` | `uuid` | NOT NULL | — |
| `player1_id` | `uuid` | NOT NULL | — |
| `player2_id` | `uuid` | NOT NULL | — |
| `player3_id` | `uuid` | NOT NULL | — |
| `pair1_score` | `integer` | NOT NULL | `0` |
| `pair2_score` | `integer` | NOT NULL | `0` |
| `round_count` | `integer` | NOT NULL | `1` |
| `status` | `text` | NOT NULL, CHECK IN (`waiting`,`in_progress`,`finished`,`abandoned`) | `'waiting'` |
| `winner_pair` | `smallint` | NULLABLE, CHECK IN (0,1) | `NULL` |
| `win_reason` | `text` | NULLABLE | `NULL` |
| `forfeit_by` | `uuid` | NULLABLE | `NULL` |
| `tournament_id` | `uuid` | NULLABLE (placeholder) | `NULL` |
| `tournament_round` | `text` | NULLABLE (placeholder) | `NULL` |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `started_at` | `timestamptz` | NULLABLE | `NULL` |
| `ended_at` | `timestamptz` | NULLABLE | `NULL` |

Indexes: `idx_matches_status` on `(status)`, `idx_matches_players` on `(player0_id, player1_id, player2_id, player3_id)`.

RLS enabled. Authenticated users SELECT. Server inserts via `service_role`.

#### Scenario: Insert a finished match

- GIVEN a match with 4 player UUIDs, final scores, and winner pair
- WHEN `persistMatch()` inserts into `matches`
- THEN `status` MUST be `'finished'`, `winner_pair` MUST be non-NULL, `ended_at` MUST be non-NULL

#### Scenario: Insert an abandoned match

- GIVEN a match where one player disconnected and was abandoned
- WHEN `persistMatch()` inserts into `matches`
- THEN `status` MUST be `'abandoned'`, `forfeit_by` MUST be the disconnected player's UUID, `winner_pair` MUST be NULL

#### Scenario: tournament_id and tournament_round are NULL for quick matches

- GIVEN a quick match (not in a tournament)
- WHEN the match is persisted
- THEN `tournament_id` and `tournament_round` MUST both be `NULL`

### Requirement: Match ID Generation

The system SHALL generate match IDs using `crypto.randomUUID()` in `processMatchmaking()`.

(Previously: `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)

#### Scenario: Dev endpoint already uses UUID

- GIVEN the dev endpoint at `POST /api/v1/dev/create-match`
- WHEN a match is created
- THEN `matchId` MUST be a valid UUID (same as `crypto.randomUUID()`)

#### Scenario: Matchmaking generates UUID

- GIVEN `processMatchmaking()` finds a match group
- WHEN creating the match
- THEN `matchId` MUST be a valid UUID, NOT the old `match-${ts}-${rand}` format

#### Scenario: All consumers accept UUID format

- GIVEN a match created with `crypto.randomUUID()`
- WHEN `store.getGame(matchId)`, `broadcastEvents(events, matchId, ...)`, and `recordMatchMove({ matchId, ... })` are called
- THEN all functions MUST work with UUID-formatted IDs

### Requirement: persistMatch Module

The system SHALL export `persistMatch(state: MatchState, events: GameEvent[]): void` from `packages/backend/src/db/matches.ts`. The function MUST be fire-and-forget. DB errors MUST be caught and logged via `console.error` with `[db/matches]` prefix. The game loop MUST NEVER be blocked.

Field mapping from `MatchState` to `matches` columns:

| MatchState field | Column |
|------------------|--------|
| `state.matchId` | `id` |
| `state.players[0].id` | `player0_id` |
| `state.players[1].id` | `player1_id` |
| `state.players[2].id` | `player2_id` |
| `state.players[3].id` | `player3_id` |
| `state.scores.scores[0]` | `pair1_score` |
| `state.scores.scores[1]` | `pair2_score` |
| `state.turn.roundNumber + 1` | `round_count` |
| `state.status` | `status` |

Winner extraction from events: find the `match_ended` event in the events array. Extract `event.winner` → `winner_pair`, `event.reason` → `win_reason`.

Forfeited match: if events contain `match_abandoned` with `reason: 'abandonment'`, extract `event.disconnectedPlayerId` → `forfeit_by`.

#### Scenario: Persist a finished match

- GIVEN `MatchState` with `status: 'finished'` and events containing `{ type: 'match_ended', winner: 0, finalScores: [210, 180], reason: 'reached_target' }`
- WHEN `persistMatch(state, events)` is called
- THEN `db.insert(matches).values()` is called with `id=state.matchId`, `winner_pair=0`, `win_reason='reached_target'`, `pair1_score=210`, `pair2_score=180`, `status='finished'`, `ended_at=now()`

#### Scenario: Persist an abandoned match

- GIVEN `MatchState` with `status: 'abandoned'` and events containing `{ type: 'match_abandoned', disconnectedPlayerId: 'u-abc', reason: 'abandonment' }`
- WHEN `persistMatch(state, events)` is called
- THEN `forfeit_by='u-abc'`, `winner_pair=NULL`, `win_reason=NULL`

#### Scenario: Console fallback when DB unavailable

- GIVEN `SUPABASE_DB_URL` is NOT set (local dev)
- WHEN `persistMatch()` is called
- THEN `getDb()` returns null
- AND match data is logged to console in structured format
- AND no database connection is attempted

#### Scenario: DB failure is caught

- GIVEN the Drizzle client is connected but `db.insert().values()` fails
- WHEN `persistMatch()` is called
- THEN the error is caught by `.catch()`
- AND logged to `console.error` with `[db/matches]` prefix
- AND no error propagates to the game loop

### Requirement: Persistence Hook — message handler

The system SHALL call `persistMatch(state, events)` in `packages/backend/src/ws/connection.ts` inside the `message` hook, AFTER broadcasting events, ONLY when events contain a `match_ended` or `match_abandoned` type.

#### Scenario: match_ended triggers persistence

- GIVEN a `play_tile` or `pass` message that results in `match_ended` event
- WHEN `broadcastEvents()` completes
- THEN `persistMatch(state, events)` MUST be called

#### Scenario: Normal play does NOT trigger persistence

- GIVEN a `play_tile` message that does NOT end the match
- WHEN `broadcastEvents()` completes
- THEN `persistMatch()` MUST NOT be called

#### Scenario: Data available at hook point

- GIVEN the `message` handler's broadcast block
- WHEN checking what data is available
- THEN `match` (from `store.getGame(matchId)`) and `result.events` are both accessible after broadcast

### Requirement: Persistence Hook — timer-manager (turn timeout)

The system SHALL call `persistMatch(state, events)` in `packages/backend/src/ws/timer-manager.ts` inside the `turnCheckerInterval`, AFTER broadcasting events, ONLY when events contain a `match_ended` or `match_abandoned` type.

#### Scenario: Timeout triggers match_ended and persistence

- GIVEN `checkTimeout()` returns events including `match_ended`
- WHEN `broadcastEvents()` completes in the turnCheckerInterval
- THEN `persistMatch(state, events)` MUST be called

#### Scenario: Timeout without match end does NOT trigger persistence

- GIVEN `checkTimeout()` returns events without `match_ended`
- WHEN events are broadcast in the turnCheckerInterval
- THEN `persistMatch()` MUST NOT be called

### Requirement: Persistence Hook — timer-manager (abandonment)

The system SHALL call `persistMatch(state, events)` in `packages/backend/src/ws/timer-manager.ts` inside the `registerDisconnect` timeout callback, AFTER broadcasting events, ONLY when events contain a `match_abandoned` type.

#### Scenario: Abandonment triggers persistence

- GIVEN `checkAbandonment()` returns events including `match_abandoned`
- WHEN `broadcastEvents()` completes in the disconnect timeout callback
- THEN `persistMatch(state, events)` MUST be called

#### Scenario: Abandonment data includes forfeit_by

- GIVEN the `match_abandoned` event has `disconnectedPlayerId`
- WHEN `persistMatch()` processes the events
- THEN `forfeit_by` column MUST be set to `event.disconnectedPlayerId`

### Requirement: Schema Barrel Export

The system SHALL add `matches` to `packages/backend/src/db/schema/index.ts` barrel export.

#### Scenario: Barrel export resolves correctly

- GIVEN `packages/backend/src/db/schema/index.ts` exists
- WHEN importing `{ matches }` from the barrel
- THEN the import resolves to the same `matches` table defined in `./matches.ts`

---

## Domain: match-moves (MODIFIED)

### Requirement: Match Moves Table Schema

The system SHALL add a foreign key from `match_moves.match_id` to `matches(id)` via a migration. Before adding the FK, the migration MUST delete all existing `match_moves` rows (all are broken — string IDs from old format never matched UUID columns). The column type stays `uuid NOT NULL`.

(Previously: `match_moves.match_id` had no FK constraint and all inserts failed silently due to string-vs-UUID format mismatch)

#### Scenario: FK constraint enforced after migration

- GIVEN the migration has run
- WHEN inserting a `match_moves` row with `match_id` referencing a non-existent `matches.id`
- THEN the database MUST reject the insert with a FK violation

#### Scenario: Orphaned rows cleaned before FK

- GIVEN existing `match_moves` rows with string-format `match_id` values
- WHEN the migration runs
- THEN all existing rows MUST be deleted before the FK is added
- AND the migration MUST complete without FK violation

#### Scenario: New inserts succeed with UUID match IDs

- GIVEN a match created with `crypto.randomUUID()`
- WHEN `recordMatchMove()` inserts a row with `match_id` referencing that match
- THEN the insert MUST succeed (FK satisfied)

---

## Domain: round-match-flow (MODIFIED)

### Requirement: Persistence Trigger on Terminal Events

The system SHALL persist match data to the `matches` table when terminal events (`match_ended` or `match_abandoned`) are broadcast. Persistence MUST be fire-and-forget and MUST NOT block the game loop or event broadcasting.

(Previously: no match persistence existed — matches lived only in ephemeral memory)

#### Scenario: match_ended broadcast triggers persistence

- GIVEN a match that ends normally (target score reached)
- WHEN `match_ended` event is broadcast to all players
- THEN `persistMatch(state, events)` MUST be called AFTER the broadcast completes

#### Scenario: match_abandoned broadcast triggers persistence

- GIVEN a match abandoned due to player disconnection (>60s)
- WHEN `match_abandoned` event is broadcast to all players
- THEN `persistMatch(state, events)` MUST be called AFTER the broadcast completes

#### Scenario: Server crash during in_progress match

- GIVEN a match in `in_progress` status
- WHEN the server crashes before `match_ended` is emitted
- THEN the match is NOT persisted (orphaned `match_moves` rows are acceptable)
- AND `match_moves` rows for this match MAY exist without a parent `matches` row (FK allows this if no FK, or rows are orphaned if FK exists)

#### Scenario: Multiple terminal events in same broadcast

- GIVEN a broadcast that contains both `match_ended` and another terminal event
- WHEN `persistMatch()` is called
- THEN only one `matches` row MUST be inserted (idempotent insert via `ON CONFLICT DO NOTHING`)

#### Scenario: persistMatch() failure does not affect game loop

- GIVEN the database is unreachable
- WHEN `persistMatch()` fails
- THEN the error is logged to `console.error`
- AND the match state in memory is unaffected
- AND client broadcast has already completed

---

## Acceptance Criteria

| # | Criterion | Domain |
|---|-----------|--------|
| 1 | `matches` table created with all columns, types, constraints, and defaults | match-persistence |
| 2 | `match_moves.match_id` has FK to `matches(id)` after migration | match-moves |
| 3 | All existing broken `match_moves` rows deleted before FK added | match-moves |
| 4 | `matchId` format is `crypto.randomUUID()` in `processMatchmaking()` | match-persistence |
| 5 | Dev endpoint `POST /api/v1/dev/create-match` uses same UUID format | match-persistence |
| 6 | `persistMatch()` exports from `packages/backend/src/db/matches.ts` | match-persistence |
| 7 | `persistMatch()` is fire-and-forget (void, never awaited) | match-persistence |
| 8 | `persistMatch()` called in `connection.ts` message hook after broadcast | match-persistence |
| 9 | `persistMatch()` called in `timer-manager.ts` turnCheckerInterval after broadcast | match-persistence |
| 10 | `persistMatch()` called in `timer-manager.ts` registerDisconnect callback after broadcast | match-persistence |
| 11 | Persistence only triggers on `match_ended` or `match_abandoned` events | round-match-flow |
| 12 | `matches` schema exported from barrel `schema/index.ts` | match-persistence |
| 13 | DB failure in `persistMatch()` logged, never blocks game loop | match-persistence |
| 14 | All existing tests pass after implementation | all |
