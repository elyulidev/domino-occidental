# Tasks: Migrate match_moves Writes to Drizzle ORM

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 80–120 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | force-chained |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full migration: barrel, client, moves refactor, tests | PR 1 | Single PR; all tasks atomic |

---

## Phase 1: Foundation

- [x] 1.1 Create `packages/backend/src/db/schema/index.ts` — re-export `matchMoves` from `./match-moves`
- [x] 1.2 Create `packages/backend/src/db/client.ts` — export `getDb()` with lazy singleton, `DrizzleDB` type, uses `drizzle(postgres, { schema })` from `drizzle-orm/postgres-js`, returns `null` when `SUPABASE_DB_URL` unset

## Phase 2: Core Implementation

- [x] 2.1 Modify `packages/backend/src/db/moves.ts` — remove local `getDb()`, `postgres` import, and lazy init block (lines 10–40). Import `getDb` from `./client`, `matchMoves` from `./schema`
- [x] 2.2 Replace raw SQL template `void db\`insert...\`` with `void db.insert(matchMoves).values({...}).catch(...)`. Map fields: `matchId`, `roundNumber`, `playerIndex`, `moveNumber`, `isPass`, `actionSource`, `tileId`, `tileTop`, `tileBottom`, `side`, `boardLeftEnd`, `boardRightEnd`. Use `undefined` for optional fields, `null` for nullable fields
- [x] 2.3 Keep `MoveRecord` interface, `nextMoveNumber`, `resetMoveCounters`, and console fallback unchanged

## Phase 3: Testing

- [x] 3.1 Create `packages/backend/src/db/__tests__/moves.test.ts` — mock `getDb` from `../client` (vi.mock). Test: `recordMatchMove` calls `db.insert(matchMoves).values()` with correct field mapping for a play move
- [x] 3.2 Test: `recordMatchMove` passes `isPass: true` and nullifies `tileId`, `tileTop`, `tileBottom`, `side` for a pass move
- [x] 3.3 Test: console fallback when `getDb()` returns `null` — verify `console.log` called with structured format
- [x] 3.4 Test: `.catch()` handler logs error via `console.error` when insert rejects

## Phase 4: Verification

- [x] 4.1 Verify `handler.ts` import `recordMatchMove` from `../db/moves` still resolves (no code change needed)
- [x] 4.2 Run `bun test` — all tests pass
- [x] 4.3 Run `bun run biome:check` — lint and format clean
