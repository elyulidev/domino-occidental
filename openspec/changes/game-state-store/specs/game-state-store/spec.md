# Game State Store Specification

## Purpose

In-memory `Map<string, MatchState>` singleton bridging pure game-logic functions (modules 1–7) and WebSocket message handling. Provides synchronous CRUD, existence checks, cleanup, and iteration — no async, no framework dependency.

## Requirements

### STORE-01: createGame(matchId, state)

The system MUST store a MatchState keyed by its matchId, overwriting any existing entry with the same key.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| New match stored | A valid MatchState with unique id "m1" | createGame("m1", state) | getGame("m1") returns that state |
| Duplicate overwrite | An existing entry for "m1" | createGame("m1", newState) | getGame("m1") returns newState |

### STORE-02: getGame(matchId)

The system MUST return the MatchState for a given matchId, or null if absent.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Existing match | "m1" is stored | getGame("m1") | MatchState returned |
| Missing match | No entry for "ghost" | getGame("ghost") | null returned |

### STORE-03: updateGame(matchId, state)

The system MUST replace the entire MatchState entry atomically. If the matchId does not exist, the operation MUST silently succeed without creating an entry (caller uses createGame for new entries).

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Update existing | "m1" stored with status "in_progress" | updateGame("m1", updatedState) | getGame("m1").status equals "finished" |
| Update missing | No entry for "ghost" | updateGame("ghost", state) | Map unchanged; no throw |

### STORE-04: removeGame(matchId)

The system MUST remove the entry and return true if it existed, false otherwise.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Remove existing | "m1" is stored | removeGame("m1") | returns true; getGame("m1") is null |
| Remove missing | No entry for "absent" | removeGame("absent") | returns false |

### STORE-05: hasGame(matchId)

The system MUST return true if the matchId exists in the store, false otherwise.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Match exists | "m1" is stored | hasGame("m1") | true |
| Match absent | No entry for "unknown" | hasGame("unknown") | false |

### STORE-06: getActiveCount()

The system MUST return the number of entries currently in the store.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Non-empty | 3 matches stored | getActiveCount() | 3 |
| Empty store | No matches stored | getActiveCount() | 0 |

### STORE-07: cleanup(maxAgeMs)

The system MUST remove matches where the most recent player action (across all four players) is older than maxAgeMs. Returns count of removed entries.

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Stale removed | Match with all players' lastActionAt > 120s ago | cleanup(120_000) | Match removed; returns 1 |
| Recent kept | Match with any player's lastActionAt < 120s ago | cleanup(120_000) | Match kept; returns 0 |
| Empty store | No matches | cleanup(any) | returns 0 |

### STORE-08: getAllActive()

The system MUST return a `[string, MatchState][]` snapshot of all entries for external iteration (timer workers, admin).

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Non-empty | 2 matches stored | getAllActive() | Array of 2 entries |
| Empty store | No matches | getAllActive() | Empty array [] |

## Type Signatures

```typescript
type MatchState = import("./types").MatchState;

export function createGame(matchId: string, state: MatchState): void;
export function getGame(matchId: string): MatchState | null;
export function updateGame(matchId: string, state: MatchState): void;
export function removeGame(matchId: string): boolean;
export function hasGame(matchId: string): boolean;
export function getActiveCount(): number;
export function cleanup(maxAgeMs: number): number;
export function getAllActive(): [string, MatchState][];
```

## Error Conditions

| Condition | Behavior |
|-----------|----------|
| updateGame on missing key | Silent no-op (caller uses createGame for new entries) |
| Empty matchId string | Accepted; keys are caller-managed |
| Concurrent iteration + mutation | Not applicable — Bun single-threaded, synchronous API |
