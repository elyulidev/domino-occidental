# Design: Match Moves Persistence

## Technical Approach

Record every `play_tile` and `pass` action to PostgreSQL via a fire-and-forget persistence module. The handler captures move metadata after the game loop updates state, then writes asynchronously — the game loop is never blocked. A console fallback handles local development without Supabase.

```
Client (WS)  ──play_tile/pass──→  handleMessage()
                                      │
                              ┌───────┴───────┐
                              │  game engine   │  (playTile / passTurn)
                              │  updates state │
                              └───────┬───────┘
                                      │
                         result.match !== match ?
                                      │
                              ┌───────┴───────┐
                              │ MoveRecord     │  capture tile, side,
                              │ constructed    │  board ends, player index
                              └───────┬───────┘
                                      │
                              recordMatchMove()
                                      │
                              ┌───────┴───────┐
                         DB available?   No DB? (local dev)
                              │               │
                         void db`INSERT...`   console.log()
                         .catch(console.error)
```

## Architecture Decisions

| Decision | Option | Tradeoff | Decision |
|----------|--------|----------|----------|
| Write strategy | Fire-and-forget vs await | Async never blocks game loop (~1ms overhead avoided); await adds latency to every turn. Data loss risk on crash is acceptable for audit-only data | Fire-and-forget |
| DB connection | Lazy (`getDb()`) vs eager | Lazy avoids crash when `SUPABASE_DB_URL` is absent; eager would fail at import time in local dev | Lazy |
| Move numbering | In-memory `Map` vs DB sequence | DB sequence requires extra round-trip per move; in-memory matches GameState lifecycle (both lost on restart) | In-memory Map |
| Error fallback | `console.warn` + console logging vs crash | Game loop must never die for audit logging failure; console fallback preserves dev experience | Console fallback |
| `?.` guard on lastTile | Optional chaining vs null assertion | `board.tiles` could be empty in edge cases (hand end clears board); `?.` prevents runtime crash | Optional chaining |
| leave recording | No record vs record | Leave/forfeit doesn't change board state — move history should reflect gameplay, not lifecycle | No record |

## Data Flow

```
play_tile message → handleMessage(play_tile)
  → playTile(match, playerId, tileId, side)
  → ActionResult { match: newRef, events: [...] }
  → result.match !== match (reference inequality = state changed)
  → extract lastTile from board.tiles[board.tiles.length - 1]
  → build MoveRecord { matchId, roundNumber, playerIndex, isPass: false, tileId, side, boardLeftEnd, boardRightEnd }
  → recordMatchMove(moveData) — void, never awaited
  → getDb() → lazy postgres connection or null
  → if db: void sql`INSERT INTO match_moves...`.catch(console.error)
  → if !db: console.log structured move data
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/backend/src/db/moves.ts` | Create | Persistence module: `recordMatchMove()`, `MoveRecord` type, lazy `getDb()`, in-memory `moveCounters`, console fallback |
| `packages/backend/src/game/handler.ts` | Modify | Import `recordMatchMove`, capture `MoveRecord` in `play_tile`/`pass` cases, call persistence after switch |
| `supabase/migrations/20260713_match_moves.sql` | Create | Table with CHECK constraints, indexes, RLS policies |
| `packages/backend/src/game/__tests__/handler.test.ts` | Modify | Handler tests cover play/pass/leave routing; move recording tested implicitly via handler integration |

## Interfaces / Contracts

```typescript
// packages/backend/src/db/moves.ts
interface MoveRecord {
  matchId: string;
  roundNumber: number;
  playerIndex: number;
  moveNumber: number;       // auto-assigned by nextMoveNumber()
  isPass: boolean;
  tileId?: string;
  tileTop?: number;
  tileBottom?: number;
  side?: "left" | "right";
  boardLeftEnd: number | null;
  boardRightEnd: number | null;
}

function recordMatchMove(move: MoveRecord): void;  // fire-and-forget
function resetMoveCounters(): void;                 // test-only
```

```sql
-- CHECK constraint: pass ↔ null tile fields, play ↔ non-null tile fields
-- CHECK constraint: side ∈ ('left', 'right') when not pass
-- Index: (match_id, move_number) for replay ordering
-- Index: (match_id, round_number, move_number) for round analysis
-- RLS: authenticated SELECT, service_role INSERT only
```

## Error Handling

| Failure | Behavior |
|---------|----------|
| `SUPABASE_DB_URL` absent | `getDb()` returns null → `console.log()` structured move data |
| `postgres` module not installed | `require()` throws → `console.warn()` → returns null → console fallback |
| DB write fails (network, constraint) | `.catch()` logs `console.error("[db/moves] failed to record match move:", err)` — game loop unaffected |
| `board.tiles` empty (edge case) | `lastTile?.tile?.id ?? ""` prevents undefined crash; defaults to empty strings |
| Server restart mid-match | In-memory `moveCounters` reset; same lifecycle as `GameState` in store — acceptable for Phase 1 |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `recordMatchMove` fires without blocking, console fallback activates | Mock `getDb()` to return null; verify `console.log` called with structured data |
| Integration | Handler captures correct `MoveRecord` on play/pass, skips on leave/error | Existing handler tests verify routing; move recording is implicit (fire-and-forget, no return value) |
| E2E | Full game round writes moves to DB | Deferred to Phase 2 replay UI |

## Migration / Rollout

No data migration required — this is a new append-only table. Rollback is clean: remove `recordMatchMove` call from handler, drop `moves.ts`, `DROP TABLE match_moves`.

## Open Questions

- [ ] Should `moveCounters` be cleaned when matches are removed from the GameStore? Currently they accumulate until server restart.
- [ ] Should timeout-forced passes be recorded as moves? Currently only player-initiated `pass` messages are captured; the timer system uses a different code path.
