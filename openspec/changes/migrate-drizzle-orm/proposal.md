# Proposal: Migrate match_moves Writes to Drizzle ORM

## Intent

`moves.ts` persists match moves via raw `postgres` SQL tagged templates. This works but provides zero compile-time type safety — column typos, missing fields, and type mismatches surface only at runtime. Drizzle ORM (`^0.45.2`) is already installed and a matching schema exists at `packages/backend/src/db/schema/match-moves.ts` but is unused. This change wires the existing schema through a Drizzle client and replaces the raw SQL in `moves.ts` with type-safe `db.insert()` calls.

## Scope

### In Scope
- CREATE `packages/backend/src/db/client.ts` — lazy Drizzle client (same `SUPABASE_DB_URL` pattern)
- CREATE `packages/backend/src/db/schema/index.ts` — barrel export for `matchMoves` (+ `profiles` when ready)
- MODIFY `packages/backend/src/db/moves.ts` — replace raw SQL template with `db.insert(matchMoves)`
- Add unit tests for `recordMatchMove` with mocked Drizzle client

### Out of Scope
- `drizzle-kit` setup, `drizzle.config.ts`, or migration generation
- Connection pooling or health checks
- Profiles schema integration (schema file exists; no writes go through it yet)
- Schema changes to `match_moves` table

## Capabilities

### New Capabilities
None — this is an implementation refactor of an existing capability.

### Modified Capabilities
- `match-moves`: Requirement "Move Recording Module" changes internal implementation (raw SQL → Drizzle insert). External contract (`recordMatchMove` signature, fire-and-forget, console fallback) is unchanged.

## Approach

Preserve the existing lazy connection, fire-and-forget, and console-fallback patterns exactly:

1. **`client.ts`**: Lazy-init `drizzle(postgresClient)` wrapping the `postgres` npm driver. Exports a `getDb()` that returns `DrizzleDB | null` (null when `SUPABASE_DB_URL` is unset).
2. **`schema/index.ts`**: Re-export `matchMoves` from `./match-moves` (and `profiles` from `./profiles` for future use).
3. **`moves.ts`**: Replace raw SQL template with `db.insert(matchMoves).values({...}).catch(console.error)`. Same `void` fire-and-forget. Same `console.log` fallback when `getDb()` returns null.
4. **Tests**: Mock the Drizzle client, verify `insert().values()` is called with correct mapped fields. Test console fallback when DB is null.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/backend/src/db/client.ts` | New | Drizzle client with lazy initialization |
| `packages/backend/src/db/schema/index.ts` | New | Barrel export for all Drizzle schemas |
| `packages/backend/src/db/moves.ts` | Modified | Raw SQL → Drizzle insert |
| `packages/backend/src/game/__tests__/` | New | Unit tests for Drizzle-backed `recordMatchMove` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Drizzle + postgres-js compatibility | Low | Official adapter (`drizzle-orm/postgres-js`); well-documented |
| Schema drift (Drizzle vs actual DB) | Medium | Schema file already mirrors DB; periodic `drizzle-kit introspect` as future check |
| Fire-and-forget `void` + `.catch()` behavior differs from raw SQL | Low | Both are Promise-based; `.catch()` pattern identical |
| Breaking game loop | Low | Insert API is drop-in; same async void pattern |

## Rollback Plan

`git revert` to previous commit. The raw SQL template in `moves.ts` is fully restored. No schema or DB changes are made, so no migration rollback needed.

## Dependencies

- `drizzle-orm@^0.45.2` (already in `package.json`)
- `postgres@^3.4.9` (already in `package.json`; used as the underlying driver via `drizzle-orm/postgres-js`)

## Success Criteria

- [ ] `recordMatchMove` passes type-check with Drizzle's inferred insert type
- [ ] All existing tests pass unchanged
- [ ] New unit tests verify Drizzle insert is called with correct field mapping
- [ ] Console fallback still works when `SUPABASE_DB_URL` is unset
- [ ] `bun run biome:check` passes
- [ ] No changes to `MoveRecord` public interface or game loop behavior
