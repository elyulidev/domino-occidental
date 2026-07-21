/**
 * Match round persistence — records per-hand results to Supabase for replay
 * and match history.
 *
 * This module uses a lazy postgres connection. If SUPABASE_DB_URL is not set
 * (e.g. local dev without Supabase), rounds are logged to console instead.
 *
 * The game loop is NEVER blocked by DB writes — recordRound is fire-and-forget.
 *
 * IMPORTANT: match_rounds has a FK to matches. The match row doesn't exist in
 * the DB until persistMatch() creates it. So we buffer rounds in memory and
 * flush them after the match row is created.
 */

import { getDb } from "./client";
import { matchRounds } from "./schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoundRecord {
  matchId: string;
  roundNumber: number;
  winningPair: number | null;
  points: number;
  isBlocked: boolean;
  isAnnulled: boolean;
  reason: "empty_hand" | "blocked" | "annulled" | "forced_winner";
  handScores: [number, number];
  scoresAfter: [number, number];
  boardLeftEnd: number | null;
  boardRightEnd: number | null;
  boardTileCount: number;
  playerHands: number[];
  firstPlayer: number;
}

// ---------------------------------------------------------------------------
// Round recording
// ---------------------------------------------------------------------------

/**
 * Buffered rounds per match — accumulated during gameplay, flushed after
 * the match row is created in the DB by persistMatch().
 */
const bufferedRounds = new Map<string, RoundRecord[]>();

/**
 * Persist a match round to Supabase (fire-and-forget).
 *
 * If the DB connection is unavailable (no SUPABASE_DB_URL), logs to console
 * so local development is not disrupted.
 */
export async function recordRound(round: RoundRecord): Promise<void> {
  const db = await getDb();

  if (db) {
    // Buffer the round — will be flushed after the match row is created in the DB.
    // match_rounds has FK to matches, so we can't insert until persistMatch() runs.
    const rounds = bufferedRounds.get(round.matchId) ?? [];
    rounds.push(round);
    bufferedRounds.set(round.matchId, rounds);
  } else {
    // Dev fallback: log to console
    console.log(
      `[db/rounds] ROUND  match=${round.matchId.slice(0, 8)} ` +
        `round=${round.roundNumber} winner=${round.winningPair ?? "null"} ` +
        `points=${round.points} reason=${round.reason}` +
        ` scores=[${round.scoresAfter.join(",")}]`,
    );
  }
}

/**
 * Flush all buffered rounds for a match to the database.
 *
 * Called after persistMatch() creates the match row (FK constraint satisfied).
 * Fire-and-forget: errors are logged, game loop is never blocked.
 */
export async function flushMatchRounds(matchId: string): Promise<void> {
  const db = await getDb();
  const rounds = bufferedRounds.get(matchId);
  if (!rounds || rounds.length === 0) {
    bufferedRounds.delete(matchId);
    return;
  }

  if (db) {
    try {
      await db.insert(matchRounds).values(
        rounds.map((r) => ({
          matchId: r.matchId,
          roundNumber: r.roundNumber,
          winningPair: r.winningPair ?? undefined,
          points: r.points,
          isBlocked: r.isBlocked,
          isAnnulled: r.isAnnulled,
          reason: r.reason,
          handScores: r.handScores,
          scoresAfter: r.scoresAfter,
          boardLeftEnd: r.boardLeftEnd,
          boardRightEnd: r.boardRightEnd,
          boardTileCount: r.boardTileCount,
          playerHands: r.playerHands,
          firstPlayer: r.firstPlayer,
        })),
      );
      console.log(
        `[db/rounds] flushed ${rounds.length} rounds for match ${matchId.slice(0, 8)}`,
      );
    } catch (err: unknown) {
      console.error(
        `[db/rounds] failed to flush ${rounds.length} rounds for match ${matchId.slice(0, 8)}:`,
        err,
      );
    }
  } else {
    console.log(
      `[db/rounds] skipped flush (${rounds.length} rounds) — no DB connection`,
    );
  }

  bufferedRounds.delete(matchId);
}

/**
 * Reset round buffers (TEST-ONLY).
 */
export function resetRoundBuffers(): void {
  bufferedRounds.clear();
}
