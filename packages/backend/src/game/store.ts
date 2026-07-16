import type { MatchState } from "@domino/shared";

const store = new Map<string, MatchState>();

/** Player profile with display name and avatar URL. */
export interface PlayerProfile {
  name: string;
  avatarUrl: string;
}

/** Map of matchId → (playerId → PlayerProfile) for online matches. */
const playerProfilesStore = new Map<string, Map<string, PlayerProfile>>();

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
  playerProfilesStore.delete(matchId);
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
      playerProfilesStore.delete(matchId);
      removed++;
    }
  }
  return removed;
}

/** Snapshot of all active matches for iteration. */
export function getAllActive(): [string, MatchState][] {
  return Array.from(store.entries());
}

// ---------------------------------------------------------------------------
// Player profiles
// ---------------------------------------------------------------------------

/** Store player profiles (name + avatar) for a match. */
export function setPlayerProfiles(
  matchId: string,
  profiles: Map<string, PlayerProfile>,
): void {
  playerProfilesStore.set(matchId, profiles);
}

/** Get all player profiles for a match. */
export function getPlayerProfiles(
  matchId: string,
): Map<string, PlayerProfile> | undefined {
  return playerProfilesStore.get(matchId);
}

/** Backward-compatible alias: store player display names (legacy). */
export function setPlayerNames(matchId: string, names: Map<string, string>): void {
  const profiles = new Map<string, PlayerProfile>();
  for (const [id, name] of names) {
    profiles.set(id, { name, avatarUrl: "" });
  }
  playerProfilesStore.set(matchId, profiles);
}

/** Get the display name for a player in a match, or undefined. */
export function getPlayerName(matchId: string, playerId: string): string | undefined {
  return playerProfilesStore.get(matchId)?.get(playerId)?.name;
}

/** Get all player names for a match (backward-compatible). */
export function getPlayerNames(matchId: string): Map<string, string> | undefined {
  const profiles = playerProfilesStore.get(matchId);
  if (!profiles) return undefined;
  const names = new Map<string, string>();
  for (const [id, profile] of profiles) {
    names.set(id, profile.name);
  }
  return names;
}

/** TEST-ONLY: Clear the store between tests. */
export function resetStore(): void {
  store.clear();
  playerProfilesStore.clear();
}
