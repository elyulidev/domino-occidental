# Design: Migrate match_moves Writes to Drizzle ORM

## Technical Approach

Replace raw SQL inserts in `moves.ts` with Drizzle ORM's type-safe `db.insert()` calls. The existing lazy connection pattern, fire-and-forget semantics, and console fallback remain unchanged. A new `client.ts` module encapsulates Drizzle client initialization, while `schema/index.ts` provides a barrel export for schemas.

## Architecture Decisions

### Decision: Lazy Drizzle Client Initialization

**Choice**: Lazy singleton pattern in `client.ts` with `getDb(): Promise<DrizzleDB | null>`
**Alternatives considered**: Eager initialization, connection pooling, global singleton
**Rationale**: Matches existing pattern in `moves.ts`. Returns `null` when `SUPABASE_DB_URL` is unset (local dev). Deduplicates concurrent init calls. No overhead when DB unavailable.

### Decision: Fire-and-forget via `void db.insert().catch()`

**Choice**: Keep `void` prefix and `.catch()` for error handling
**Alternatives considered**: Await insert, emit events, retry logic
**Rationale**: Preserves existing contract: game loop never blocked. Errors logged but don't propagate. Simple, predictable, matches current behavior.

### Decision: Schema Barrel Export

**Choice**: Single `schema/index.ts` re-exporting all schemas
**Alternatives considered**: Direct imports from individual schema files
**Rationale**: Centralizes schema imports. Future schemas (`profiles`, etc.) added here. Simplifies `client.ts` schema registration.

## Data Flow

```
handler.ts ──→ moves.ts ──→ client.ts ──→ Drizzle ORM ──→ postgres driver ──→ Supabase PostgreSQL
    │               │              │
    │               │              └─ getDb() returns DrizzleDB | null
    │               │
    │               └─ recordMatchMove(move) → db.insert(matchMoves).values(mapped)
    │
    └─ void recordMatchMove(moveData)  // fire-and-forget
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/backend/src/db/client.ts` | Create | Lazy Drizzle client with `getDb()` export |
| `packages/backend/src/db/schema/index.ts` | Create | Barrel export for `matchMoves` schema |
| `packages/backend/src/db/moves.ts` | Modify | Replace raw SQL with Drizzle insert, remove local `getDb` |

## Interfaces / Contracts

```typescript
// packages/backend/src/db/client.ts
import { type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DrizzleDB = PostgresJsDatabase<typeof schema>;
export async function getDb(): Promise<DrizzleDB | null>;

// packages/backend/src/db/schema/index.ts
export { matchMoves } from "./match-moves";

// packages/backend/src/db/moves.ts (modified)
export interface MoveRecord { /* unchanged */ }
export async function recordMatchMove(move: MoveRecord): Promise<void>; /* unchanged signature */
```

## Field Mapping

| MoveRecord field | matchMoves column | Notes |
|------------------|-------------------|-------|
| `move.matchId` | `matchId` | Direct mapping |
| `move.roundNumber` | `roundNumber` | Direct mapping |
| `move.playerIndex` | `playerIndex` | Direct mapping |
| (auto-assigned) | `moveNumber` | From `nextMoveNumber()` |
| `move.isPass` | `isPass` | Boolean |
| `move.actionSource` | `actionSource` | Text enum |
| `move.tileId ?? null` | `tileId` | Optional → undefined for Drizzle |
| `move.tileTop ?? null` | `tileTop` | Optional → undefined for Drizzle |
| `move.tileBottom ?? null` | `tileBottom` | Optional → undefined for Drizzle |
| `move.side ?? null` | `side` | Optional → undefined for Drizzle |
| `move.boardLeftEnd` | `boardLeftEnd` | Number or null |
| `move.boardRightEnd` | `boardRightEnd` | Number or null |

**Note**: Drizzle's `.values()` uses camelCase column names from schema definition. `null` values in MoveRecord become `undefined` in Drizzle insert (Drizzle omits `undefined` fields, letting DB defaults apply).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `recordMatchMove` calls `db.insert(matchMoves).values()` with correct fields | Mock `getDb()` to return mock Drizzle client |
| Unit | Console fallback when `getDb()` returns `null` | Mock `getDb()` to return `null`, verify `console.log` called |
| Unit | Error handling: `.catch()` logs error | Mock `db.insert().values()` to reject, verify `console.error` |

## Migration / Rollout

**No migration required.** Schema file already matches DB. No DB changes needed.

**Rollout steps**:
1. Create `client.ts` and `schema/index.ts`
2. Modify `moves.ts` to use Drizzle client
3. Run `bun test` to verify unit tests pass
4. Run `bun run biome:check` for lint/format
5. E2E: play a tile in local dev, verify `match_moves` table receives row

## Open Questions

- [ ] Should `DrizzleDB` type be exported from `moves.ts` for other modules? (Currently only used internally)
- [ ] Future: should `profiles` schema be added to barrel now or later? (Proposal says later)