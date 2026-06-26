# Design: Game State Store (Module 8)

## Technical Approach

Module-level `Map<string, MatchState>` singleton via closure in `src/game/store.ts`. Eight synchronous named exports wrap the Map — no class, no framework dep. The store is the only impure module in the game engine layer; everything else is pure functions. The WS layer owns the store and uses it to bridge between ephemeral WS connections and the pure engine.

## Architecture Decisions

### Decision: Singleton closure over class

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Module-level Map + free functions | Dead simple, matches project convention (no classes anywhere) | **Chosen** |
| Class with static methods | Adds ceremony, breaks from pure-function pattern in deck/board/turn | Rejected |
| Global variable | Same as module-level but mutable reference, risk of reassignment | Rejected — use `const` Map |

### Decision: `resetStore()` test helper

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Export `resetStore()` | Lets tests clear state between cases without node --import hacks | **Chosen** — exported but documented as test-only |
| `vi.resetModules()` + re-import | Works but requires await, adds boilerplate to every test file | Rejected |

### Decision: File name — `store.ts` over `game-store.ts`

All existing modules use single-word names (`deck.ts`, `board.ts`, `turn.ts`, `match.ts`), `store.ts` matches conventions.

### Decision: `updateGame` silent no-op on missing key

Minority pattern: soft-fail instead of throw. Rationale: the WS layer races against match lifecycle. A missing key on update means "match already ended" — the caller needs a no-op, not an exception to catch.

## Data Flow

```
WS handler (playTile msg)
  → calls pure engine (match.ts) → gets ActionResult
  → calls store.getGame(matchId)  → gets MatchState | null
  → calls engine function with MatchState
  → calls store.updateGame(matchId, newState)

Timer worker (every 2s)
  → calls store.getAllActive() → iterates [matchId, MatchState][]
  → calls engine.checkTimeout()
  → calls store.updateGame(matchId, newState)

Cleanup worker (periodic)
  → calls store.cleanup(maxAgeMs) → removes stale, returns count
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/store.ts` | Create | Singleton Map + 8 exported functions |
| `src/game/__tests__/store.test.ts` | Create | Isolated unit tests for all 8 functions |

## Interfaces

```typescript
import type { MatchState } from "./types";

const store: Map<string, MatchState>;

export function createGame(matchId: string, state: MatchState): void;
export function getGame(matchId: string): MatchState | null;
export function updateGame(matchId: string, state: MatchState): void;
export function removeGame(matchId: string): boolean;
export function hasGame(matchId: string): boolean;
export function getActiveCount(): number;
export function cleanup(maxAgeMs: number): number;
export function getAllActive(): [string, MatchState][];

/** @internal Clears store — use only in tests or explicit teardown */
export function resetStore(): void;
```

### cleanup implementation detail

```typescript
export function cleanup(maxAgeMs: number): number {
  const cutoff = Date.now();
  let removed = 0;
  for (const [id, match] of store) {
    const mostRecent = Math.max(
      ...match.players.map(p => p.lastActionAt.getTime())
    );
    if (cutoff - mostRecent > maxAgeMs) {
      store.delete(id);
      removed++;
    }
  }
  return removed;
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | All 8 functions | Create MatchState objects, call function, assert result. Each `describe` block calls `resetStore()` in `beforeEach`. |
| Edge (cleanup) | Stale vs recent | Build players with `lastActionAt` dates varying by >120s, verify cleanup removes only stales |
| Edge (empty) | All queries on empty store | `getActiveCount()` → 0, `getAllActive()` → [], `cleanup(any)` → 0, `removeGame` → false |
| Edge (update missing) | `updateGame` on absent key | Silent no-op, map unchanged |
