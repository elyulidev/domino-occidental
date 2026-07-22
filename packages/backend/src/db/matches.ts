/**
 * Match persistence — records terminal-state matches (finished/abandoned)
 * to Supabase for historical data, replay, and leaderboard.
 *
 * This module uses a lazy postgres connection. If SUPABASE_DB_URL is not set
 * (e.g. local dev without Supabase), matches are logged to console instead.
 *
 * The game loop is NEVER blocked by DB writes — persistMatch is fire-and-forget.
 */

import type { GameEvent, MatchState } from "@domino/shared";
import { getDb } from "./client";
import { flushMatchMoves } from "./moves";
import { flushMatchRounds } from "./rounds";
import { matches } from "./schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchRecord {
  matchId: string;
  status: "finished" | "abandoned";
  winner: number | null;
  forfeitBy: string | null;
  scores: [number, number];
  roundCount: number;
  targetScore: number;
  playerIds: [string, string, string, string];
  startedAt: Date;
  endedAt: Date;
}

// ---------------------------------------------------------------------------
// Terminal data extraction
// ---------------------------------------------------------------------------

/**
 * Scans events for a terminal type (match_ended or match_abandoned)
 * and extracts the relevant fields into a MatchRecord.
 *
 * Returns null if no terminal event is found.
 */
export function extractTerminalData(
  state: MatchState,
  events: GameEvent[],
): MatchRecord | null {
  const matchEnded = events.find((e) => e.type === "match_ended");
  const matchAbandoned = events.find((e) => e.type === "match_abandoned");

  if (!matchEnded && !matchAbandoned) return null;

  let winner: number | null = null;
  let forfeitBy: string | null = null;

  if (matchEnded && matchEnded.type === "match_ended") {
    winner = matchEnded.winner;
  }
  if (matchAbandoned && matchAbandoned.type === "match_abandoned") {
    forfeitBy = matchAbandoned.disconnectedPlayerId;
  }

  return {
    matchId: state.matchId,
    status: state.status as "finished" | "abandoned",
    winner,
    forfeitBy,
    scores: [...state.scores.scores] as [number, number],
    roundCount: state.turn.roundNumber + 1,
    targetScore: state.targetScore,
    playerIds: [
      state.players[0].id,
      state.players[1].id,
      state.players[2].id,
      state.players[3].id,
    ],
    startedAt: state.players[0].lastActionAt,
    endedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Match persistence
// ---------------------------------------------------------------------------

/**
 * Persist a terminal-state match to Supabase (fire-and-forget).
 *
 * If the DB connection is unavailable (no SUPABASE_DB_URL), logs to console
 * so local development is not disrupted.
 *
 * The game loop is NEVER blocked — DB errors are caught and logged.
 */
export async function persistMatch(
  state: MatchState,
  events: GameEvent[],
): Promise<void> {
  const record = extractTerminalData(state, events);
  if (!record) return;

  const db = await getDb();

  if (db) {
    console.log(
      `[db/matches] persisting ${record.status} match=${record.matchId.slice(0, 8)} ` +
      `scores=[${record.scores.join(",")}] rounds=${record.roundCount}` +
      (record.forfeitBy ? ` forfeit_by=${record.forfeitBy.slice(0, 8)}` : ""),
    );
    // Fire-and-forget: don't await — game loop is never blocked
    void db
      .insert(matches)
      .values({
        id: record.matchId,
        status: record.status,
        winner: record.winner ?? undefined,
        forfeitBy: record.forfeitBy ?? undefined,
        scores: record.scores,
        roundCount: record.roundCount,
        targetScore: record.targetScore,
        playerIds: record.playerIds,
        startedAt: record.startedAt,
        endedAt: record.endedAt,
      })
      .then(async () => {
        console.log(`[db/matches] match ${record.matchId.slice(0, 8)} persisted OK — flushing moves + rounds`);
        // Match row created — flush rounds FIRST (moves depend on round_id FK)
        await flushMatchRounds(record.matchId);
        await flushMatchMoves(record.matchId);
      })
      .catch((err: unknown) => {
        console.error("[db/matches] FAILED to persist match:", err);
      });
  } else {
    // Dev fallback: log to console
    console.log(
      `[db/matches] ${record.status.toUpperCase()} ` +
        `match=${record.matchId.slice(0, 8)} ` +
        `winner=${record.winner ?? "null"} ` +
        `scores=[${record.scores.join(",")}] ` +
        `rounds=${record.roundCount}` +
        (record.forfeitBy ? ` forfeit_by=${record.forfeitBy.slice(0, 8)}` : ""),
    );
  }
}
