# Proposal: Lobby Stats Phase 1 — ELO & Coins Columns

## Intent

The lobby and matchmaking features (Phase 2–3) require player ELO and coin balance to be queryable from the database. Currently `profiles` has no `elo` or `coins` columns, so there's no persistent source of truth for these values. This phase adds the DB foundation that downstream phases build on.

## Scope

### In Scope
- Add `elo` column (INTEGER, NOT NULL, DEFAULT 1200) to `profiles`
- Add `coins` column (INTEGER, NOT NULL, DEFAULT 250) to `profiles`
- Supabase migration with `ALTER TABLE` for both columns
- Update Drizzle schema (`packages/backend/src/db/schema/profiles.ts`)
- Update barrel export (`packages/backend/src/db/schema/index.ts`)

### Out of Scope
- `elo_history` table (deferred)
- REST endpoints for profile/leaderboard (Phase 2)
- Lobby UI refactor (Phase 2)
- Matchmaking queue wiring (Phase 3)
- Backfill logic for existing users beyond SQL defaults

## Capabilities

### New Capabilities
- `player-stats`: Player ELO and coin balance columns on profiles — foundation for leaderboard, matchmaking, and shop

### Modified Capabilities
- None — no existing spec behavior changes at the requirement level

## Approach

1. Generate Supabase migration: `ALTER TABLE profiles ADD COLUMN elo INTEGER NOT NULL DEFAULT 1200;` and same for `coins` with DEFAULT 250
2. Existing rows automatically get defaults on ALTER — no separate backfill needed
3. Update Drizzle `profiles` table definition to include `elo` (integer, default 1200) and `coins` (integer, default 250)
4. Add `profiles` to barrel export in `schema/index.ts`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | New migration adding `elo` and `coins` to profiles |
| `packages/backend/src/db/schema/profiles.ts` | Modified | Add `elo` and `coins` columns to Drizzle schema |
| `packages/backend/src/db/schema/index.ts` | Modified | Add `profiles` export |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing rows get default values that don't reflect true skill | Medium | Acceptable — Phase 2 endpoints will initialize from gameplay data; defaults are a starting point |
| Drizzle schema drift if migration and schema update aren't atomic | Low | Single PR with both changes; verify with `bun test` and `drizzle-kit generate` |

## Rollback Plan

- Revert the Drizzle schema changes
- Drop the new columns: `ALTER TABLE profiles DROP COLUMN elo, DROP COLUMN coins;`
- Both changes are additive (no data loss from rollback)

## Dependencies

- Supabase CLI linked to dev project (`supabase db push --linked`)

## Success Criteria

- [ ] Migration applies cleanly to Supabase dev
- [ ] `profiles` table has `elo` (default 1200) and `coins` (default 250) columns
- [ ] Drizzle schema compiles and matches SQL
- [ ] Barrel export includes `profiles`
- [ ] `bun test` passes

## Proposal Question Round

No blocking product questions for this phase — it's a pure schema addition. The following assumptions are embedded:

- **Default ELO 1200**: Standard starting rating, matches AGENTS.md ELO system
- **Default coins 250**: Gives new players enough to enter a few tournaments (entry_fee is in coins)
- **No backfill strategy**: Existing users get defaults; true values emerge from Phase 2+ gameplay
