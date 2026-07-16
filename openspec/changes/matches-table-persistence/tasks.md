# Tasks: Matches Table Persistence

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 280–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full change | PR 1 | Migration + schema + persistence + hooks + tests. Under 400-line budget. |

## Phase 1: Database Migration

- [x] 1.1 Create `supabase/migrations/20260716_matches.sql`: `matches` table DDL per design (id, status, winner, forfeit_by, scores, round_count, target_score, player_ids, started_at, ended_at, created_at) + RLS + indexes (`idx_matches_player_ids` GIN on player_ids, `idx_matches_ended_at` on ended_at desc)
- [x] 1.2 In same migration: `DELETE FROM public.match_moves;` then `ALTER TABLE public.match_moves ADD CONSTRAINT match_moves_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;`
- [x] 1.3 Verify migration applies cleanly: `supabase db push --linked` (or `supabase db reset` locally)

## Phase 2: Drizzle Schema

- [x] 2.1 Create `packages/backend/src/db/schema/matches.ts`: `matches` pgTable with all columns from design SQL, using `uuid().primaryKey().defaultRandom()`, `text().notNull()`, `smallint()`, `integer().array()`, `uuid().array()`, `timestamp({ withTimezone: true })`, type narrowed `$type<"finished" | "abandoned">()` for status
- [x] 2.2 Modify `packages/backend/src/db/schema/match-moves.ts`: add `foreignKey(() => ({ columns: [matchMoves.matchId], foreignColumns: [matches.id] }))` import + reference. Import `matches` from `./matches`
- [x] 2.3 Update `packages/backend/src/db/schema/index.ts`: add `export { matches } from "./matches";` barrel line

## Phase 3: Backend Persistence Module

- [x] 3.1 Create `packages/backend/src/db/matches.ts`: export `MatchRecord` interface and `persistMatch(record: MatchRecord): Promise<void>` function. Follow `moves.ts` fire-and-forget pattern: `getDb()` → if null, log structured `[db/matches]` → if db, `void db.insert(matches).values({...}).catch(...)`. Field mapping: matchId→id, scores→scores array, roundCount→round_count (0-indexed→1-indexed), playerIds→player_ids array, winner→winner, forfeitBy→forfeit_by, status→status, targetScore→target_score, startedAt→started_at, endedAt→ended_at
- [x] 3.2 Add helper `extractTerminalData(state: MatchState, events: GameEvent[]): MatchRecord | null` in same file — scans events for `match_ended` (extracts winner pair, reason) or `match_abandoned` (extracts disconnectedPlayerId as forfeit_by). Returns null if no terminal event found

## Phase 4: Match ID Change

- [x] 4.1 Modify `packages/backend/src/game/matchmaking.ts` line 323: replace `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` with `crypto.randomUUID()`
- [x] 4.2 Verify `packages/backend/src/server.ts` line 184 already uses `crypto.randomUUID()` — no change needed (alignment confirmed)

## Phase 5: Hook Integration

- [x] 5.1 Modify `packages/backend/src/ws/connection.ts` message handler: after `broadcastEvents()` block (line ~420), import `persistMatch` and `extractTerminalData`, call `const match = deps.store.getGame(matchId); if (match) { const record = extractTerminalData(match, result.events); if (record) persistMatch(record); }`
- [x] 5.2 Modify `packages/backend/src/ws/timer-manager.ts` turnCheckerInterval: after `broadcastEvents()` (line ~161), import and call `persistMatch`/`extractTerminalData` — same pattern: get match from store, extract terminal data, persist if found
- [x] 5.3 Modify `packages/backend/src/ws/timer-manager.ts` registerDisconnect timeout callback: after `broadcastEvents()` (line ~201), add same persistence hook for `match_abandoned` events

## Phase 6: Testing

- [x] 6.1 Create `packages/backend/src/db/__tests__/matches.test.ts`: mock `getDb()` returning null → verify console.log with `[db/matches]` prefix; mock `db.insert().values()` success → verify correct field mapping; mock `db.insert()` rejection → verify `.catch()` logs `[db/matches]` error; test `extractTerminalData` with `match_ended` event → winner/reason extracted; test with `match_abandoned` event → forfeit_by extracted; test with no terminal event → returns null
- [x] 6.2 Verify existing matchmaking tests pass with new UUID format: run `bun test packages/backend/src/game/__tests__/matchmaking.test.ts`
- [x] 6.3 Verify existing connection and timer-manager tests pass after hook additions: run `bun test packages/backend/src/ws/__tests__/`

## Phase 7: Cleanup

- [x] 7.1 Update comment in `supabase/migrations/20260713_match_moves.sql` line 7: remove "match_id es UUID sin FK porque la tabla matches se creará" — FK now exists via new migration
- [x] 7.2 Run `bun run biome:check` and `bun test` to confirm all lint, format, and tests pass
