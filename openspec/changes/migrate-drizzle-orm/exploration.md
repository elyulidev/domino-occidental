# Exploration: Migrate to Drizzle ORM

## Current State

### Database Interaction Pattern
The project has a single database interaction point: `packages/backend/src/db/moves.ts`. This module:

1. **Lazy connection**: Uses `postgres` npm package with a lazy initialization pattern
2. **Fire-and-forget**: Inserts match moves without awaiting (game loop never blocks)
3. **Graceful fallback**: Logs to console when `SUPABASE_DB_URL` is not set (local dev)
4. **Single connection**: Uses `{ max: 1, idle_timeout: 10 }` for minimal resource usage

### Existing Drizzle Schema Files
Two Drizzle schema files already exist but are NOT used:
- `packages/backend/src/db/schema/match-moves.ts` — matches the `match_moves` table
- `packages/backend/src/db/schema/profiles.ts` — minimal profiles table reference

These schemas were created for "consistency and future typed reads" but the actual writes still use raw SQL.

### Package Dependencies
```json
// packages/backend/package.json
{
  "dependencies": {
    "drizzle-orm": "^0.45.2",  // Already installed
    "postgres": "^3.4.9"        // Raw SQL driver (compatible with Drizzle)
  }
}
```

**Missing**: `drizzle-kit` (dev dependency for migrations)

### Database Schema (match_moves table)
```sql
CREATE TABLE match_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  round_number INTEGER NOT NULL,
  player_index SMALLINT NOT NULL,
  move_number INTEGER NOT NULL,
  is_pass BOOLEAN NOT NULL,
  action_source TEXT NOT NULL DEFAULT 'player',
  tile_id TEXT,
  tile_top SMALLINT,
  tile_bottom SMALLINT,
  side TEXT,
  board_left_end SMALLINT,
  board_right_end SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Affected Areas

- `packages/backend/src/db/moves.ts` — Current raw SQL implementation (TO BE REPLACED)
- `packages/backend/src/db/schema/match-moves.ts` — Existing schema (TO BE USED)
- `packages/backend/src/db/schema/index.ts` — NEW: barrel export for schemas
- `packages/backend/src/db/client.ts` — NEW: Drizzle client with lazy connection
- `packages/backend/package.json` — Add `drizzle-kit` dev dependency
- `packages/backend/drizzle.config.ts` — NEW: Drizzle Kit configuration

## Approaches

### Approach 1: Minimal Migration (Recommended)
**Replace raw SQL with Drizzle ORM while preserving the lazy connection pattern**

#### Files to Create:
1. **`packages/backend/src/db/client.ts`** — Drizzle client with lazy connection
   ```typescript
   import { drizzle } from 'drizzle-orm/postgres-js';
   import postgres from 'postgres';
   import * as schema from './schema';
   
   let db: ReturnType<typeof drizzle> | null = null;
   let dbInitPromise: Promise<ReturnType<typeof drizzle> | null> | null = null;
   
   export async function getDb() {
     if (db) return db;
     if (dbInitPromise) return dbInitPromise;
     
     const url = process.env.SUPABASE_DB_URL ?? (Bun.env as Record<string, string | undefined>).SUPABASE_DB_URL;
     if (!url) return null;
     
     dbInitPromise = (async () => {
       try {
         const client = postgres(url, { max: 1, idle_timeout: 10 });
         db = drizzle(client, { schema });
         return db;
       } catch (err) {
         console.warn("[db/client] Failed to initialize Drizzle:", (err as Error)?.message);
         return null;
       }
     })();
     
     return dbInitPromise;
   }
   ```

2. **`packages/backend/src/db/schema/index.ts`** — Barrel export
   ```typescript
   export * from './match-moves';
   export * from './profiles';
   ```

3. **`packages/backend/drizzle.config.ts`** — Drizzle Kit config
   ```typescript
   import { defineConfig } from 'drizzle-kit';
   
   export default defineConfig({
     schema: './src/db/schema/*',
     out: './drizzle',
     dialect: 'postgresql',
     dbCredentials: {
       url: process.env.DATABASE_URL!,
     },
   });
   ```

4. **`package.json` changes** — Add drizzle-kit
   ```json
   {
     "devDependencies": {
       "drizzle-kit": "^0.31.0"
     }
   }
   ```

#### Files to Modify:
1. **`packages/backend/src/db/moves.ts`** — Replace raw SQL with Drizzle
   ```typescript
   import { getDb } from './client';
   import { matchMoves } from './schema';
   
   export async function recordMatchMove(move: MoveRecord): Promise<void> {
     const db = await getDb();
     const moveNumber = nextMoveNumber(move.matchId);
     
     if (db) {
       // Fire-and-forget: don't await
       void db.insert(matchMoves).values({
         matchId: move.matchId,
         roundNumber: move.roundNumber,
         playerIndex: move.playerIndex,
         moveNumber,
         isPass: move.isPass,
         actionSource: move.actionSource,
         tileId: move.tileId ?? null,
         tileTop: move.tileTop ?? null,
         tileBottom: move.tileBottom ?? null,
         side: move.side ?? null,
         boardLeftEnd: move.boardLeftEnd,
         boardRightEnd: move.boardRightEnd,
       }).catch((err) => {
         console.error("[db/moves] failed to record match move:", err);
       });
     } else {
       // Dev fallback
       console.log(`[db/moves] ${move.isPass ? "PASS" : "PLAY"} ...`);
     }
   }
   ```

#### Pros:
- ✅ Minimal changes to existing code
- ✅ Preserves lazy connection pattern exactly
- ✅ Type-safe inserts (compile-time validation)
- ✅ Uses existing schema files
- ✅ No breaking changes to game loop
- ✅ Easy rollback (revert to raw SQL)

#### Cons:
- ⚠️ Adds Drizzle ORM runtime overhead (minimal ~35KB)
- ⚠️ Still need to manage connection manually

#### Effort: Low (1-2 hours)

---

### Approach 2: Full Drizzle Setup with Migrations
**Complete Drizzle setup with drizzle-kit for schema management**

#### Additional Files:
1. **`packages/backend/drizzle/`** — Migration files directory
2. **`packages/backend/package.json`** — Add scripts:
   ```json
   {
     "scripts": {
       "db:generate": "drizzle-kit generate",
       "db:migrate": "drizzle-kit migrate",
       "db:push": "drizzle-kit push",
       "db:introspect": "drizzle-kit introspect"
     }
   }
   ```

#### Pros:
- ✅ Full migration management
- ✅ Schema versioning in Git
- ✅ Can introspect existing database
- ✅ Drizzle Studio for debugging

#### Cons:
- ⚠️ More setup complexity
- ⚠️ Need to generate initial migration
- ⚠️ Supabase manages its own migrations

#### Effort: Medium (2-3 hours)

---

### Approach 3: Connection Pool with Health Check
**Production-ready setup with connection pooling and health checks**

#### Additional Features:
- Connection pooling (increase `max` from 1 to 5)
- Health check endpoint
- Connection retry logic
- Metrics for connection usage

#### Pros:
- ✅ Production-ready
- ✅ Better performance under load
- ✅ Observability

#### Cons:
- ⚠️ Over-engineering for current use case
- ⚠️ More complex to test
- ⚠️ Game loop is fire-and-forget, pooling adds little value

#### Effort: High (4-6 hours)

## Recommendation

**Use Approach 1 (Minimal Migration)** for these reasons:

1. **Preserves existing patterns**: The lazy connection and fire-and-forget patterns are battle-tested
2. **Minimal risk**: Small surface area, easy to test and rollback
3. **Immediate value**: Type safety without over-engineering
4. **Future-proof**: Can upgrade to Approach 2 later when needed

### Why NOT Approach 2 or 3:
- **Approach 2**: Supabase manages migrations externally; Drizzle Kit migrations add complexity without clear benefit for a single table
- **Approach 3**: The game loop is fire-and-forget with minimal DB writes; pooling is premature optimization

## Risks

### 1. Drizzle + postgres-js Compatibility
**Risk**: Low — `drizzle-orm/postgres-js` is the official adapter for the `postgres` npm package
**Mitigation**: Use `drizzle({ client: queryClient })` pattern from docs

### 2. Lazy Connection Pattern
**Risk**: Low — Drizzle supports lazy initialization via `drizzle(client)` 
**Mitigation**: Keep the same `getDb()` pattern, just wrap the Drizzle instance

### 3. Fire-and-Forget Pattern
**Risk**: Low — `db.insert().values().catch()` is equivalent to raw SQL fire-and-forget
**Mitigation**: The `.catch()` handler ensures errors don't propagate

### 4. Type Safety vs Schema Drift
**Risk**: Medium — Drizzle schema must stay in sync with actual database
**Mitigation**: Use `drizzle-kit introspect` periodically to verify; add CI check

### 5. Supabase RLS Interactions
**Risk**: Low — Drizzle uses `service_role` like raw SQL
**Mitigation**: No change in RLS behavior; server still uses service_role

## Ready for Proposal

**Yes** — The exploration is complete. The orchestrator should:

1. Confirm Approach 1 (Minimal Migration) is acceptable
2. Proceed to `sdd-propose` with:
   - Scope: Replace raw SQL in `moves.ts` with Drizzle ORM
   - Files: 4 new files, 1 modified file
   - Testing: Unit tests for `recordMatchMove()` with mocked Drizzle client
   - Rollback: Revert to raw SQL (git revert)

---

**Artifacts Created**:
- `openspec/changes/migrate-drizzle-orm/exploration.md` (this file)
- Engram: `sdd/migrate-drizzle-orm/explore` (pending)

**Next Phase**: `sdd-propose`
**Skill Resolution**: paths-injected — drizzle, sdd-phase-common
