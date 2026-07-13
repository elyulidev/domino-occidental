# Spec: Lobby Stats Phase 1 — ELO & Coins Columns

## Purpose

Add `elo` and `coins` integer columns to the `profiles` table, establishing the persistent data foundation for leaderboard ranking, matchmaking, and virtual currency features in subsequent phases.

## Requirements

### Requirement: Profiles ELO Column

The system SHALL persist a player's ELO rating as an integer column on the `profiles` table with a default of 1200 and NOT NULL constraint.

#### Scenario: New user gets default ELO

- GIVEN a new user registers
- WHEN the `profiles` row is created without an explicit `elo` value
- THEN `elo` defaults to 1200

#### Scenario: Existing rows receive default on migration

- GIVEN the `profiles` table has existing rows before migration
- WHEN the `ALTER TABLE` migration runs adding the `elo` column
- THEN all existing rows receive `elo = 1200`

#### Scenario: Drizzle schema exposes elo column

- GIVEN the Drizzle schema is compiled
- WHEN `profiles` table definition is imported from `packages/backend/src/db/schema/profiles.ts`
- THEN it includes a `elo` property of type `integer`, not null, default 1200

### Requirement: Profiles Coins Column

The system SHALL persist a player's virtual coin balance as an integer column on the `profiles` table with a default of 250 and NOT NULL constraint.

#### Scenario: New user gets default coins

- GIVEN a new user registers
- WHEN the `profiles` row is created without an explicit `coins` value
- THEN `coins` defaults to 250

#### Scenario: Existing rows receive default on migration

- GIVEN the `profiles` table has existing rows before migration
- WHEN the `ALTER TABLE` migration runs adding the `coins` column
- THEN all existing rows receive `coins = 250`

#### Scenario: Drizzle schema exposes coins column

- GIVEN the Drizzle schema is compiled
- WHEN `profiles` table definition is imported from `packages/backend/src/db/schema/profiles.ts`
- THEN it includes a `coins` property of type `integer`, not null, default 250

### Requirement: Schema Barrel Export

The system SHALL export `profiles` from the barrel file `packages/backend/src/db/schema/index.ts`.

#### Scenario: Profiles importable from barrel

- GIVEN another module imports from `packages/backend/src/db/schema`
- WHEN it destructures `profiles`
- THEN it receives the Drizzle table definition

### Requirement: Migration File

The system SHALL include a Supabase migration SQL file following the `YYYYMMDD_description.sql` naming convention in `supabase/migrations/`.

#### Scenario: Migration applies cleanly

- GIVEN the Supabase dev database is linked
- WHEN `supabase db push --linked` is executed
- THEN the migration applies without errors
- AND `profiles` table has `elo INTEGER NOT NULL DEFAULT 1200`
- AND `profiles` table has `coins INTEGER NOT NULL DEFAULT 250`

## Constraints

| Constraint | Value |
|------------|-------|
| ELO type | `INTEGER` |
| ELO default | `1200` |
| ELO nullable | No (`NOT NULL`) |
| Coins type | `INTEGER` |
| Coins default | `250` |
| Coins nullable | No (`NOT NULL`) |
| Migration naming | `YYYYMMDD_description.sql` |
| Column naming | snake_case (`elo`, `coins`) |
| Drizzle mapping | `integer('elo')`, `integer('coins')` |

## Out of Scope

- `elo_history` table for audit trail
- REST endpoints for profile stats or leaderboard
- Lobby UI changes
- Matchmaking queue wiring
- Backfill logic beyond SQL defaults
- ELO calculation engine
- Coin transaction logic
