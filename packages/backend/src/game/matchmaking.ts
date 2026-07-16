/**
 * Matchmaking queue, matching algorithm, and match processing.
 *
 * Stateful queue (Map) for managing players waiting for a match.
 * Matching uses sliding ELO windows based on wait time.
 * processMatchmaking() bridges queue → game creation → player notification.
 *
 * Supports pair-priority matching: if two registered partners are both in
 * the queue, they are matched together before the ELO scan runs.
 *
 * @see AGENTS.md §6 for matchmaking rules
 */

import type { GameStore, UserChannelManager } from "@domino/shared";
import { createDeck, deal, initializeMatch, shuffle, startHand } from "@domino/shared/src/game";
import { inArray } from "drizzle-orm";
import { getDb, getRawSql } from "../db/client";
import { createGame } from "./store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueueEntry {
  userId: string;
  elo: number;
  joinedAt: number; // Date.now()
  /** Resolved partner pair ID (null if solo or unresolved). */
  pairId?: string;
  /** Partner's userId if they are also in the queue. */
  partnerId?: string;
  /** Which ELO to use for matching: individual or pair average. */
  eloType: "individual" | "pair";
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

/**
 * Maximum time (ms) to wait for all 4 players to connect after a match is found.
 * If fewer than 4 connect within this window, the match is cancelled and
 * players are re-enqueued.
 */
export const MATCH_FOUND_TIMEOUT_MS = 30_000;

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

    // --- Pair-priority pre-pass ---
    // Scan for pairs where both partners are queued. If we find 2+ complete
    // pairs within ELO range, match them immediately (skip solo ELO scan).
    const pairMatch = findPairMatch(entries);
    if (pairMatch) return pairMatch;

    // --- Solo ELO scan (existing algorithm) ---
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

  /**
   * Pair-priority pre-pass: find two complete pairs (both partners queued)
   * within ELO range and match them immediately.
   */
  function findPairMatch(entries: QueueEntry[]): MatchGroup | null {
    // Build a lookup of pairId → queued entries for that pair
    const pairMap = new Map<string, QueueEntry[]>();
    for (const entry of entries) {
      if (!entry.pairId) continue;
      const existing = pairMap.get(entry.pairId) ?? [];
      existing.push(entry);
      pairMap.set(entry.pairId, existing);
    }

    // Collect complete pairs (exactly 2 members)
    const completePairs: Array<{ pairId: string; entries: [QueueEntry, QueueEntry] }> = [];
    for (const [pairId, members] of pairMap) {
      if (members.length === 2) {
        completePairs.push({ pairId, entries: [members[0], members[1]] });
      }
    }

    if (completePairs.length < 2) return null;

    // Sort pairs by average ELO (oldest pair first for FIFO fairness)
    completePairs.sort((a, b) => {
      const avgA = (a.entries[0].elo + a.entries[1].elo) / 2;
      const avgB = (b.entries[0].elo + b.entries[1].elo) / 2;
      return avgA - avgB;
    });

    const now = Date.now();

    // Try each pair as the "anchor" and find a second pair within range
    for (const anchor of completePairs) {
      const anchorAvg = (anchor.entries[0].elo + anchor.entries[1].elo) / 2;
      const anchorWait = now - Math.min(anchor.entries[0].joinedAt, anchor.entries[1].joinedAt);
      const range = getEloRange(anchorWait);

      for (const other of completePairs) {
        if (other.pairId === anchor.pairId) continue;
        const otherAvg = (other.entries[0].elo + other.entries[1].elo) / 2;
        if (Math.abs(anchorAvg - otherAvg) <= range) {
          const matched = [...anchor.entries, ...other.entries];
          const elos = matched.map((e) => e.elo);
          return {
            playerIds: matched.map((e) => e.userId) as [
              string,
              string,
              string,
              string,
            ],
            avgElo: Math.round(elos.reduce((a, b) => a + b, 0) / PLAYER_COUNT),
            eloRange: { min: Math.min(...elos), max: Math.max(...elos) },
            waitTimeMs: anchorWait,
          };
        }
      }
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
// Partner resolution
// ---------------------------------------------------------------------------

/**
 * Queries the `pairs` table for a registered partner of the given user.
 * Returns the partner's userId and pairId if found, or null if no active
 * partner exists or the DB query fails.
 *
 * Partners are checked by priority order (1 → 2 → 3) as defined in the
 * pairs table.
 *
 * Uses raw SQL via postgres.js because there's no Drizzle schema for `pairs`.
 */
export async function resolvePartner(
  userId: string,
): Promise<{ partnerId: string; pairId: string } | null> {
  try {
    const sql = await getRawSql();
    if (!sql) return null;

    const result = await sql<{ id: string; user_a: string; user_b: string }[]>`
      SELECT id, user_a, user_b
      FROM pairs
      WHERE status = 'active'
        AND (user_a = ${userId} OR user_b = ${userId})
      ORDER BY priority ASC
      LIMIT 1
    `;

    if (result.length === 0) return null;

    const pair = result[0];
    const partnerId = pair.user_a === userId ? pair.user_b : pair.user_a;
    return { partnerId, pairId: pair.id };
  } catch (err) {
    console.warn(
      "[matchmaking] resolvePartner failed:",
      (err as Error)?.message,
    );
    return null;
  }
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

  // Create match ID — use UUID for FK compatibility with match_moves and matches tables
  const matchId = crypto.randomUUID();

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

// ---------------------------------------------------------------------------
// Player profile resolution
// ---------------------------------------------------------------------------

/** Player profile with display name and avatar URL. */
export interface PlayerProfile {
  name: string;
  avatarUrl: string;
}

/**
 * Fetches display names and avatar URLs for a list of user IDs from the profiles table.
 * Returns a Map<userId, PlayerProfile>. Falls back to a generic name on failure.
 *
 * Uses Drizzle query builder with the profiles schema.
 */
export async function fetchPlayerProfiles(
  userIds: string[],
): Promise<Map<string, PlayerProfile>> {
  const profiles = new Map<string, PlayerProfile>();
  try {
    const db = await getDb();
    if (!db) {
      for (const id of userIds) {
        profiles.set(id, { name: `Player ${id.slice(0, 4)}`, avatarUrl: "" });
      }
      return profiles;
    }

    const { profiles: profilesTable } = await import("../db/schema");
    const result = await db
      .select({
        id: profilesTable.id,
        username: profilesTable.username,
        avatarUrl: profilesTable.avatar_url,
      })
      .from(profilesTable)
      .where(inArray(profilesTable.id, userIds));

    for (const row of result) {
      profiles.set(row.id, {
        name: row.username,
        avatarUrl: row.avatarUrl ?? "",
      });
    }

    // Fill in any missing profiles with fallback
    for (const id of userIds) {
      if (!profiles.has(id)) {
        profiles.set(id, { name: `Player ${id.slice(0, 4)}`, avatarUrl: "" });
      }
    }
  } catch (err) {
    console.warn(
      "[matchmaking] fetchPlayerProfiles failed:",
      (err as Error)?.message,
    );
    for (const id of userIds) {
      if (!profiles.has(id)) {
        profiles.set(id, { name: `Player ${id.slice(0, 4)}`, avatarUrl: "" });
      }
    }
  }
  return profiles;
}

/**
 * Backward-compatible wrapper: fetches display names only.
 * @deprecated Use fetchPlayerProfiles instead.
 */
export async function fetchPlayerNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const profiles = await fetchPlayerProfiles(userIds);
  const names = new Map<string, string>();
  for (const [id, profile] of profiles) {
    names.set(id, profile.name);
  }
  return names;
}
