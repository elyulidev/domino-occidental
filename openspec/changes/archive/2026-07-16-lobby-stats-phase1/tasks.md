# Tasks: Lobby Stats Phase 1 — ELO & Coins Columns

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~30–40 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | feature-branch-chain (force-chained, but budget is Low — single PR suffices) |
| Chain strategy | size-exception (budget well under 400) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Schema Changes

- [x] 1.1 Create `supabase/migrations/20260714_add_elo_coins_to_profiles.sql` — `ALTER TABLE profiles ADD COLUMN elo INTEGER NOT NULL DEFAULT 1200, ADD COLUMN coins INTEGER NOT NULL DEFAULT 250;` with rollback comment (`ALTER TABLE profiles DROP COLUMN elo, DROP COLUMN coins;`)
- [x] 1.2 Add `integer` import to `packages/backend/src/db/schema/profiles.ts` from `drizzle-orm/pg-core`
- [x] 1.3 Add `elo: integer("elo").notNull().default(1200)` and `coins: integer("coins").notNull().default(250)` to the `profiles` table definition

## Phase 2: Barrel Export

- [x] 2.1 Add `export { profiles } from "./profiles";` to `packages/backend/src/db/schema/index.ts` (currently only exports `matchMoves`)

## Phase 3: Verification

- [x] 3.1 Create `packages/backend/src/__tests__/schema-profiles.test.ts` — RED: import `profiles` from `@db/schema`, assert `elo` and `coins` columns exist with correct defaults
- [x] 3.2 Run `bun test schema-profiles` — GREEN: test passes confirming columns and defaults
- [x] 3.3 Run `bun run biome:check` to confirm lint/format pass on all changed files
