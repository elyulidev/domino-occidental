/**
 * Pure matching algorithm — ported from packages/backend/src/game/matchmaking.ts
 *
 * FIFO + sliding ELO window. No DB dependencies — pure functions only.
 * Used by MatchmakingDO.alarm() to find groups of 4 players.
 *
 * @see AGENTS.md §6 for matchmaking rules
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchQueueEntry {
  userId: string;
  elo: number;
  joinedAt: number;
}

export interface MatchGroup {
  playerIds: [string, string, string, string];
  avgElo: number;
  eloRange: { min: number; max: number };
  waitTimeMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAYER_COUNT = 4;

interface EloWindow {
  minWait: number;
  maxWait: number;
  range: number;
}

const ELO_WINDOWS: EloWindow[] = [
  { minWait: 0, maxWait: 10_000, range: 200 },
  { minWait: 10_000, maxWait: 30_000, range: 400 },
  { minWait: 30_000, maxWait: 60_000, range: 600 },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the ELO matching range based on how long a player has been waiting.
 * Sliding window: ±200 (0-10s), ±400 (10-30s), ±600 (30-60s).
 */
export function getEloRange(waitTimeMs: number): number {
  for (const window of ELO_WINDOWS) {
    if (waitTimeMs >= window.minWait && waitTimeMs < window.maxWait) {
      return window.range;
    }
  }
  // Beyond 60s: accept anyone
  return 600;
}

/**
 * Finds a match of 4 players using FIFO + sliding ELO window.
 *
 * Sorts by joinedAt (oldest first), then for each candidate, finds the 3
 * closest players whose ELO falls within the candidate's window.
 *
 * @returns MatchGroup if 4 players can be matched, null otherwise.
 */
export function findMatch(queue: MatchQueueEntry[]): MatchGroup | null {
  if (queue.length < PLAYER_COUNT) return null;

  // Sort by joinedAt (FIFO — oldest first)
  const entries = [...queue].sort((a, b) => a.joinedAt - b.joinedAt);

  const now = Date.now();

  for (const candidate of entries) {
    const waitTime = now - candidate.joinedAt;
    const range = getEloRange(waitTime);

    // Find players within ELO range (excluding candidate)
    const candidates = entries.filter(
      (e) =>
        e.userId !== candidate.userId &&
        Math.abs(e.elo - candidate.elo) <= range,
    );

    if (candidates.length < PLAYER_COUNT - 1) continue;

    // Pick the 3 closest to candidate's ELO (minimize spread)
    const sorted = candidates
      .sort(
        (a, b) =>
          Math.abs(a.elo - candidate.elo) - Math.abs(b.elo - candidate.elo),
      )
      .slice(0, PLAYER_COUNT - 1);

    const matched = [candidate, ...sorted];
    const elos = matched.map((e) => e.elo);
    const min = Math.min(...elos);
    const max = Math.max(...elos);

    return {
      playerIds: matched.map((e) => e.userId) as [
        string,
        string,
        string,
        string,
      ],
      avgElo: Math.round(elos.reduce((a, b) => a + b, 0) / PLAYER_COUNT),
      eloRange: { min, max },
      waitTimeMs: waitTime,
    };
  }

  return null;
}
