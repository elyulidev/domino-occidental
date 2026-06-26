import type { MatchState } from "@domino/shared";

const store = new Map<string, MatchState>();

/** Store a new match (overwrites existing). */
export function createGame(matchId: string, state: MatchState): void {
  store.set(matchId, state);
}

/** Retrieve a match by ID, or null if not found. */
export function getGame(matchId: string): MatchState | null {
  return store.get(matchId) ?? null;
}

/** Atomically replace state for an existing match. No-op if matchId doesn't exist. */
export function updateGame(matchId: string, state: MatchState): void {
  if (store.has(matchId)) {
    store.set(matchId, state);
  }
}

/** Remove a match. Returns true if it existed. */
export function removeGame(matchId: string): boolean {
  return store.delete(matchId);
}

/** Check if a match exists. */
export function hasGame(matchId: string): boolean {
  return store.has(matchId);
}

/** Number of active games. */
export function getActiveCount(): number {
  return store.size;
}

/**
 * Remove matches where ALL players' lastActionAt is older than maxAgeMs.
 * Returns count of removed entries.
 */
export function cleanup(maxAgeMs: number): number {
  const now = Date.now();
  let removed = 0;
  for (const [matchId, match] of store) {
    const mostRecent = Math.max(
      ...match.players.map((p) => p.lastActionAt.getTime()),
    );
    if (now - mostRecent > maxAgeMs) {
      store.delete(matchId);
      removed++;
    }
  }
  return removed;
}

/** Snapshot of all active matches for iteration. */
export function getAllActive(): [string, MatchState][] {
  return Array.from(store.entries());
}

/** TEST-ONLY: Clear the store between tests. */
export function resetStore(): void {
  store.clear();
}
