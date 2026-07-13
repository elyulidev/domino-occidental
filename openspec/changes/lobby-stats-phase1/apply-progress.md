# Apply Progress — lobby-stats-phase1

## Completed Tasks

- [x] 1.1 Create migration `supabase/migrations/20260716_add_elo_coins_to_profiles.sql`
  - SQL: `ALTER TABLE profiles ADD COLUMN elo INTEGER NOT NULL DEFAULT 1200; ALTER TABLE profiles ADD COLUMN coins INTEGER NOT NULL DEFAULT 250;`
  - Rollback comment included
- [x] 1.2 Add `integer` import to `packages/backend/src/db/schema/profiles.ts`
- [x] 1.3 Add `elo` and `coins` columns to profiles table definition
  - `elo: integer("elo").notNull().default(1200)`
  - `coins: integer("coins").notNull().default(250)`
- [x] 2.1 Add barrel export for `profiles` and `authUsers` to `packages/backend/src/db/schema/index.ts`
- [x] 3.1 Write RED test at `packages/backend/src/db/__tests__/profiles.test.ts`
- [x] 3.2 GREEN: all 6 tests pass confirming columns and defaults
- [x] 3.3 biome:check clean on all changed files

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260716_add_elo_coins_to_profiles.sql` | Created | ALTER TABLE to add elo (default 1200) and coins (default 250) |
| `packages/backend/src/db/schema/profiles.ts` | Modified | Added `integer` import, `elo` and `coins` columns |
| `packages/backend/src/db/schema/index.ts` | Modified | Added barrel export for profiles and authUsers |
| `packages/backend/src/db/__tests__/profiles.test.ts` | Created | 6 TDD tests: barrel export, column existence, defaults, preserved columns, SQL name mapping |

## Test Results

- **Total tests in profiles.test.ts**: 6 pass, 0 fail
- **Full suite**: 416 pass, 0 fail
- **biome:check**: clean (0 errors, 0 warnings)

## Deviations from Design

None — implementation matches design.

## Remaining Tasks

None — all tasks complete.

## Status

All 7/7 tasks complete. Ready for verify.
