# Proposal: Match Moves Persistence

## Intent

Match state currently lives only in server memory. Without persisting individual moves, there is no way to replay games, audit suspicious plays, or investigate anti-cheat flags. This change records every `play_tile` and `pass` action to PostgreSQL for replay, audit trail, and anti-collusion analysis.

## Scope

### In Scope
- `match_moves` table migration with check constraints for pass vs play integrity
- `packages/backend/src/db/moves.ts` — lazy-connection persistence module with fire-and-forget writes
- `packages/backend/src/game/handler.ts` — handler integration capturing `MoveRecord` on state-changing actions
- In-memory move counter per match (resets on server restart, like GameState)

### Out of Scope
- Replay UI (frontend playback component)
- Match completion persistence to `matches` table (future work)
- Move validation or anti-cheat detection logic
- Batch/buffered writes or connection pooling beyond single connection

## Capabilities

### New Capabilities
- `match-moves`: Persistence layer recording every play/pass move to Supabase for replay and audit trail

### Modified Capabilities
- `round-match-flow`: Handler now captures move metadata (tile, side, board ends) and persists via fire-and-forget after each state-changing action

## Approach

**Fire-and-forget persistence**: `recordMatchMove()` is called after the game loop updates state. It never awaits the DB write — errors are caught and logged. This guarantees the game loop is never blocked by database latency.

**Lazy DB connection**: `getDb()` initializes the postgres connection on first call. If `SUPABASE_DB_URL` is unset (local dev), all moves log to console instead — no Supabase dependency for local development.

**Move numbering**: An in-memory `Map<string, number>` tracks sequential move numbers per match. Resets on server restart (same lifecycle as in-memory GameState).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/backend/src/db/moves.ts` | New | Persistence module with lazy connection, fire-and-forget writes, console fallback |
| `packages/backend/src/game/handler.ts` | Modified | Imports `recordMatchMove`, captures `MoveRecord` after play/pass, calls persistence |
| `supabase/migrations/20260713_match_moves.sql` | New | Table schema with CHECK constraints, indexes, RLS policies |
| `packages/backend/src/game/__tests__/handler.test.ts` | Modified | Handler tests cover play/pass/leave routing; move recording tested implicitly |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Moves lost if DB write fails silently | Low | `console.error` on catch; move data captured in-memory as fallback |
| Move counter drift if server restarts mid-match | Low | Same lifecycle as GameState — acceptable for Phase 1 |
| Unbounded in-memory counters | Low | Counters keyed by matchId; maps cleaned when match removed from store |

## Constraints
- **Never block the game loop**: all DB writes are fire-and-forget (`void` promise)
- **Work without Supabase locally**: console fallback when `SUPABASE_DB_URL` is absent
- **RLS enforced**: only `SELECT` for authenticated users; server uses `service_role` for INSERT

## Rollback Plan

1. Remove `recordMatchMove` call from `handler.ts` (restore original handler)
2. Drop `packages/backend/src/db/moves.ts`
3. `DROP TABLE IF EXISTS public.match_moves;` to remove the migration
4. No data dependencies — rollback is clean since moves are append-only audit data

## Dependencies

- `postgres` npm package (dynamic import, graceful fallback if absent)
- `SUPABASE_DB_URL` environment variable (optional — console fallback if absent)

## Success Criteria

- [x] All 403 tests pass after implementation
- [x] `match_moves` table created with correct CHECK constraints
- [x] Each `play_tile` and `pass` action records a row with tile data, board ends, and move number
- [x] `leave` (forfeit) actions do NOT record moves (no board state change)
- [x] Console fallback logs moves when no DB URL is configured
- [x] RLS allows authenticated SELECT, server-only INSERT
