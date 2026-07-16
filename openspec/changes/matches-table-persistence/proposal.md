# Proposal: Matches Table Persistence

## Intent

Matches live only in an in-memory `Map` and vanish on server restart. The `match_moves` table exists but all inserts fail silently because match IDs are formatted as `match-${Date.now()}-xxx` (strings) while `match_moves.match_id` is `uuid NOT NULL`. This change: (1) creates the missing `matches` table, (2) switches match ID generation to `crypto.randomUUID()`, (3) adds FK from `match_moves` to `matches`, and (4) persists completed/abandoned matches to the database.

## Scope

### In Scope
- New `matches` table (SQL migration + Drizzle schema)
- `match_moves.match_id` FK addition to `matches(id)`
- Match ID format change: `match-${ts}-${rand}` → `crypto.randomUUID()`
- Terminal-state persistence hook (finished/abandoned) in timer-manager and WS connection
- `db/matches.ts` persistence module (fire-and-forget, same pattern as `db/moves.ts`)

### Out of Scope
- Persisting `waiting` or `in_progress` matches (only terminal state)
- Match replay UI
- Tournament bracket integration (future `tournament_id` column)
- Player stats aggregation (separate `player_stats` materialized view)

## Capabilities

### New Capabilities
- `match-persistence`: Persist completed and abandoned matches to PostgreSQL at terminal state

### Modified Capabilities
- `match-moves`: Add FK from `match_moves.match_id` to `matches(id)`; match ID format changes to UUID
- `round-match-flow`: Terminal events (`match_ended`, `match_abandoned`) trigger DB persistence

## Approach

**UUID match IDs**: Replace `match-${Date.now()}-${random}` with `crypto.randomUUID()` in `processMatchmaking()`. The dev endpoint already uses UUID — this unifies the format.

**Terminal-state persistence**: Persist matches only when status becomes `finished` or `abandoned`. Hook into 3 broadcast points:
1. `ws/connection.ts` message handler — after `handleMessage` broadcasts `match_ended`
2. `timer-manager.ts` turnCheckerInterval — after `checkTimeout` broadcasts `match_ended`
3. `timer-manager.ts` registerDisconnect callback — after `checkAbandonment` broadcasts `match_abandoned`

Each hook checks the events array for terminal event types before calling `persistMatch()`.

**FK + orphan cleanup**: Migration deletes all existing `match_moves` rows (all are broken — string IDs never matched UUID columns), then adds `match_moves_match_id_fkey` FK to `matches(id)`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/20260716_matches.sql` | New | `matches` table + `match_moves` FK + orphan cleanup |
| `packages/backend/src/db/schema/matches.ts` | New | Drizzle schema for `matches` table |
| `packages/backend/src/db/schema/match-moves.ts` | Modified | Add FK reference to matches schema |
| `packages/backend/src/db/schema/index.ts` | Modified | Add barrel export for `matches` |
| `packages/backend/src/db/matches.ts` | New | `persistMatch()` fire-and-forget module |
| `packages/backend/src/game/matchmaking.ts` | Modified | `processMatchmaking()`: `crypto.randomUUID()` |
| `packages/backend/src/server.ts` | Modified | Dev endpoint already uses UUID (verify alignment) |
| `packages/backend/src/ws/connection.ts` | Modified | Add terminal-event persistence hook |
| `packages/backend/src/ws/timer-manager.ts` | Modified | Add terminal-event persistence hook |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Orphaned `match_moves` rows after FK addition | Low | Migration deletes all existing rows first (all are broken anyway) |
| `persistMatch()` fails silently (DB down) | Low | Same fire-and-forget + `console.error` pattern as `moves.ts`; game loop never blocked |
| UUID collision (extremely unlikely) | Negligible | `crypto.randomUUID()` uses v4 UUID — 122 bits of randomness |
| Existing tests break from matchId format change | Medium | All test fixtures use UUID via dev endpoint or mock — verify with `bun test` |

## Rollback Plan

1. Revert matchId generation in `matchmaking.ts` (restore `match-${Date.now()}-xxx` format)
2. Remove `persistMatch()` calls from `connection.ts` and `timer-manager.ts`
3. Drop `packages/backend/src/db/matches.ts`
4. `DROP TABLE IF EXISTS public.matches;` — removes the migration
5. Remove FK from `match_moves` (or leave it — harmless with empty parent table)

## Dependencies

- `crypto.randomUUID()` — available natively in Bun/Node (no polyfill needed)

## Success Criteria

- [ ] `matches` table created with correct columns and constraints
- [ ] `match_moves` inserts succeed (UUID IDs match `matches` parent)
- [ ] Completed matches are persisted with final scores, player IDs, and round count
- [ ] Abandoned matches are persisted with `forfeit_by` when applicable
- [ ] `persistMatch()` is fire-and-forget — never blocks the game loop
- [ ] All existing tests pass after implementation
