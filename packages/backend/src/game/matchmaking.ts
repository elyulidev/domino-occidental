/**
 * Matchmaking queue, matching algorithm, and match processing.
 *
 * Stateful queue (Map) for managing players waiting for a match.
 * Matching uses sliding ELO windows based on wait time.
 * processMatchmaking() bridges queue → game creation → player notification.
 *
 * @see AGENTS.md §6 for matchmaking rules
 */

import type { GameStore, UserChannelManager } from "@domino/shared";
import { createDeck, deal, shuffle } from "./deck";
import { initializeMatch, startHand } from "./match";
import { createGame } from "./store";

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

/** Result of a successful processMatchmaking call. */
export interface MatchCreated {
  matchId: string;
  playerIds: string[];
}

export interface ProcessMatchmakingDeps {
  queue: ReturnType<typeof createMatchmakingQueue>;
  store: GameStore;
  userChannelManager: UserChannelManager;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_CLEANUP_THRESHOLD_MS = 60_000;
const PLAYER_COUNT = 4;
const CLEANUP_INTERVAL_MS = 30_000;

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
// Match processing (bridge between queue, game engine, and WS notification)
// ---------------------------------------------------------------------------

/**
 * Processes the matchmaking queue: finds a match, creates the game,
 * and notifies players via their user channel.
 *
 * @returns The created match info, or null if no match was found.
 */
export function processMatchmaking(
  deps: ProcessMatchmakingDeps,
): MatchCreated | null {
  const group = deps.queue.findMatch();
  if (!group) return null;

  // Deal tiles for the match
  const deck = shuffle(createDeck());
  const { hands, pool } = deal(deck);

  // Create match ID
  const matchId = `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Initialize match state
  const { match } = initializeMatch(matchId, hands, pool);
  const { match: startedMatch } = startHand(match);

  // Override player IDs with actual UUIDs (keep positional order)
  const updatedPlayers = startedMatch.players.map((p, i) => ({
    ...p,
    id: group.playerIds[i],
  })) as typeof startedMatch.players;
  startedMatch.players = updatedPlayers;

  // Status starts as "waiting" until all 4 players WS-connect
  startedMatch.status = "waiting";

  // Store the match
  createGame(matchId, startedMatch);

  // Remove matched players from queue
  for (const playerId of group.playerIds) {
    deps.queue.dequeue(playerId);
  }

  // Push match_found event to each player's user channel
  const matchFoundPayload = {
    type: "match_found",
    matchId,
    playerIds: group.playerIds,
    timestamp: new Date().toISOString(),
  };
  for (const playerId of group.playerIds) {
    deps.userChannelManager.pushToUser(playerId, matchFoundPayload);
  }

  return { matchId, playerIds: group.playerIds };
}

// ---------------------------------------------------------------------------
// Auto-cleanup scheduler
// ---------------------------------------------------------------------------

/**
 * Starts a periodic queue cleanup interval.
 * Returns a function to cancel the interval (for cleanup on shutdown).
 */
export function startCleanupScheduler(
  queue: ReturnType<typeof createMatchmakingQueue>,
): () => void {
  const id = setInterval(() => {
    queue.cleanupStale();
  }, CLEANUP_INTERVAL_MS);
  return () => clearInterval(id);
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
