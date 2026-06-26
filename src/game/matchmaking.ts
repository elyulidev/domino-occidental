/**
 * Matchmaking queue and matching algorithm.
 *
 * Stateful queue (Map) for managing players waiting for a match.
 * Matching uses sliding ELO windows based on wait time.
 *
 * @see AGENTS.md §6 for matchmaking rules
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueueEntry {
  userId: string;
  elo: number;
  joinedAt: number; // Date.now()
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

const QUEUE_CLEANUP_THRESHOLD_MS = 60_000;
const PLAYER_COUNT = 4;

/** Sliding window definitions for ELO matching. */
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
// Queue implementation
// ---------------------------------------------------------------------------

export function createMatchmakingQueue() {
  const queue = new Map<string, QueueEntry>();

  function enqueue(entry: QueueEntry): void {
    queue.set(entry.userId, entry);
  }

  function dequeue(userId: string): boolean {
    return queue.delete(userId);
  }

  function findMatch(): MatchGroup | null {
    const entries = Array.from(queue.values());
    if (entries.length < PLAYER_COUNT) return null;

    // Sort by joinedAt (oldest first — FIFO)
    entries.sort((a, b) => a.joinedAt - b.joinedAt);

    const now = Date.now();

    for (const candidate of entries) {
      const waitTime = now - candidate.joinedAt;
      const range = getEloRange(waitTime);

      // Find other 3 players whose ELOs fall within candidate's range
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

  function getWaitTime(userId: string): number | null {
    const entry = queue.get(userId);
    if (!entry) return null;
    return Date.now() - entry.joinedAt;
  }

  function getQueueSize(): number {
    return queue.size;
  }

  function getQueue(): QueueEntry[] {
    return Array.from(queue.values());
  }

  function cleanupStale(): string[] {
    const now = Date.now();
    const removed: string[] = [];

    for (const [userId, entry] of queue) {
      if (now - entry.joinedAt > QUEUE_CLEANUP_THRESHOLD_MS) {
        queue.delete(userId);
        removed.push(userId);
      }
    }

    return removed;
  }

  return {
    enqueue,
    dequeue,
    findMatch,
    getWaitTime,
    getQueueSize,
    getQueue,
    cleanupStale,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEloRange(waitTimeMs: number): number {
  for (const window of ELO_WINDOWS) {
    if (waitTimeMs >= window.minWait && waitTimeMs < window.maxWait) {
      return window.range;
    }
  }
  // Beyond 60s: accept anyone (range 600)
  return 600;
}
