# Design: Matches Table Persistence

## Technical Approach

Persist terminal-state matches (finished/abandoned) to PostgreSQL. Switch match IDs from `match-${Date.now()}-${rand}` to `crypto.randomUUID()` so `match_moves.match_id` FK resolves against a real parent row. A new `db/matches.ts` module handles persistence following the same fire-and-forget pattern as `db/moves.ts`.

## Architecture Decisions

| Decision | Option | Tradeoff | Decision |
|----------|--------|----------|----------|
| Match ID format | `crypto.randomUUID()` vs `match-${ts}-${rand}` | UUID is required for FK to `match_moves(uuid)`; the string format silently fails inserts. Dev endpoint already uses UUID — unifying avoids two code paths | UUID |
| Persistence timing | Terminal-state only vs at creation | Persisting at creation adds a DB write + in-memory-to-DB sync burden for every state update. Terminal only = 1 write per match lifecycle, zero game-loop overhead | Terminal only |
| Write strategy | Fire-and-forget vs transactional | Same rationale as `moves.ts`: game loop never blocks for DB. Matches are purely historical — a failed persist loses replay data, not game integrity | Fire-and-forget |
| Orphan cleanup | Delete all `match_moves` rows vs keep | All existing rows have string-format `match_id` that never matched any UUID column — they are dead data. Deleting before FK addition avoids constraint violation | Delete all |

## Data Flow

    processMatchmaking()
         │  crypto.randomUUID()
         ▼
    matchId (UUID) ──→ in-memory store (Map)
                           │
                    game events flow (play_tile, pass, timeout...)
                           │
                    status becomes "finished" or "abandoned"
                           │
                    broadcastEvents() emits match_ended / match_abandoned
                           │
                    ┌──────┴──────┐
                    │ hook: check │ events for terminal type
                    └──────┬──────┘
                           │
                    persistMatch(match) ──→ fire-and-forget DB INSERT
                                            → matches table

### Hook Points (3 locations)

1. **`ws/connection.ts` message handler** — after `handleMessage` broadcasts `match_ended`
2. **`timer-manager.ts` turnCheckerInterval** — after `checkTimeout` broadcasts `match_ended`
3. **`timer-manager.ts` registerDisconnect** — after `checkAbandonment` broadcasts `match_abandoned`

Each hook scans `events[]` for `match_ended` or `match_abandoned`, then calls `persistMatch()`.

## Schema Design

### `matches` table (new)

```sql
create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  status          text not null check (status in ('finished','abandoned')),
  winner          smallint,         -- winning pair index (0 or 1), null if abandoned
  forfeit_by      uuid,             -- player who forfeited, null otherwise
  scores          smallint[2],      -- [pair0, pair1] final scores
  round_count     integer not null, -- total hands played
  target_score    integer not null default 200,
  player_ids      uuid[4] not null, -- [p1, p2, p3, p4] seat order
  started_at      timestamptz not null,
  ended_at        timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Index for player match history
create index idx_matches_player_ids on public.matches using gin (player_ids);
-- Index for recent matches / leaderboard queries
create index idx_matches_ended_at on public.matches (ended_at desc);

-- RLS
alter table public.matches enable row level security;
create policy "Authenticated users can view matches"
  on public.matches for select to authenticated using (true);
grant select on public.matches to authenticated;
```

### `match_moves` modification

```sql
-- 1. Delete orphaned rows (string IDs never matched UUID columns)
delete from public.match_moves;

-- 2. Add FK to matches
alter table public.match_moves
  add constraint match_moves_match_id_fkey
  foreign key (match_id) references public.matches(id)
  on delete cascade;
```

### Drizzle schema additions

```typescript
// packages/backend/src/db/schema/matches.ts (new)
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: text("status").notNull().$type<"finished" | "abandoned">(),
  winner: smallint("winner"),
  forfeitBy: uuid("forfeit_by"),
  scores: integer("scores").array().notNull(),
  roundCount: integer("round_count").notNull(),
  targetScore: integer("target_score").notNull().default(200),
  playerIds: uuid("player_ids").array().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

## Interfaces / Contracts

```typescript
// packages/backend/src/db/matches.ts (new)
export interface MatchRecord {
  matchId: string;
  status: "finished" | "abandoned";
  winner: number | null;         // pair index 0 or 1
  forfeitBy: string | null;      // player UUID
  scores: [number, number];
  roundCount: number;
  targetScore: number;
  playerIds: [string, string, string, string];
  startedAt: Date;
  endedAt: Date;
}

export function persistMatch(record: MatchRecord): Promise<void>;  // fire-and-forget
```

### Data Mapping from `MatchState` to `MatchRecord`

| MatchState field | MatchRecord field | Notes |
|------------------|-------------------|-------|
| `matchId` | `matchId` | UUID after change |
| `status` | `status` | Always terminal (`finished` / `abandoned`) |
| `scores.scores` | `scores` | `[pair0, pair1]` |
| `turn.roundNumber + 1` | `roundCount` | 0-indexed → 1-indexed |
| `targetScore` | `targetScore` | Default 200 |
| `players[].id` | `playerIds` | Seat order preserved |
| *(derived from events)* | `winner` | From `match_ended` event or null |
| *(derived from events)* | `forfeitBy` | From `match_abandoned.disconnectedPlayerId` |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260716_matches.sql` | Create | `matches` DDL + `match_moves` FK + orphan cleanup |
| `packages/backend/src/db/schema/matches.ts` | Create | Drizzle schema for `matches` table |
| `packages/backend/src/db/matches.ts` | Create | `persistMatch()` fire-and-forget module |
| `packages/backend/src/db/schema/match-moves.ts` | Modify | Add FK reference in Drizzle schema |
| `packages/backend/src/db/schema/index.ts` | Modify | Add barrel export for `matches` |
| `packages/backend/src/game/matchmaking.ts` | Modify | `processMatchmaking()`: `crypto.randomUUID()` |
| `packages/backend/src/server.ts` | Modify | Verify dev endpoint alignment |
| `packages/backend/src/ws/connection.ts` | Modify | Add terminal-event persistence hook |
| `packages/backend/src/ws/timer-manager.ts` | Modify | Add terminal-event persistence hook |
| `packages/backend/src/db/__tests__/matches.test.ts` | Create | Unit tests for `persistMatch()` |
| `packages/backend/src/ws/__tests__/connection.test.ts` | Modify | Hook integration tests |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `persistMatch()` with mocked DB, console fallback, error handling | Mock `getDb()` return null + mock `db.insert()` rejection |
| Integration | `match_ended` / `match_abandoned` events trigger `persistMatch()` | Hook points in `connection.ts` and `timer-manager.ts` via existing test infra |
| Edge case | Crash between match end and persist (lost in-memory state) | Documented as accepted risk — same lifecycle as `GameState` |

## Migration / Rollout

1. Migration runs: create `matches` table → delete orphaned `match_moves` → add FK
2. New `processMatchmaking()` generates UUIDs from the moment of deployment
3. In-flight matches with old-format IDs will have orphaned `match_moves` after migration — acceptable (no FK yet for those)
4. No rollback data concern — all persisted data is append-only historical

## Open Questions

- [ ] Should `player_ids` use `smallint[]` (indices 0–3) or `uuid[]` (real user IDs)? UUID is chosen for direct queryability but uses more storage.
