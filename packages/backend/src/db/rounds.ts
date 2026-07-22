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
 *
 * NORMALIZATION: match_moves now references match_rounds via round_id.
 * Each buffered round gets a UUID that moves can look up via getRoundId().
 */

import type { MatchState } from "@domino/shared";
import { getDb } from "./client";
import { matchRounds } from "./schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoundRecord {
  matchId: string;
  roundId: string;  // generated UUID for FK reference from match_moves
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
 * Key: `${matchId}:${roundNumber}` → RoundRecord
 */
const bufferedRounds = new Map<string, RoundRecord[]>();

/**
 * Lookup map: `${matchId}:${roundNumber}` → roundId (UUID)
 * Used by match_moves to resolve the FK before flush.
 */
const roundIdLookup = new Map<string, string>();

/**
 * Generate a lookup key for round ID resolution.
 */
function roundKey(matchId: string, roundNumber: number): string {
  return `${matchId}:${roundNumber}`;
}

/**
 * Look up the round UUID for a given match + round number.
 * Returns undefined if the round hasn't been recorded yet.
 * Used by moves.ts to resolve the round_id FK.
 */
export function getRoundId(matchId: string, roundNumber: number): string | undefined {
  return roundIdLookup.get(roundKey(matchId, roundNumber));
}

/**
 * Ensure a round UUID exists in the lookup map.
 * Called by moves.ts on the FIRST move of each hand so the round_id FK is
 * resolved before any move is buffered. If the round was already registered
 * (e.g. by recordRound at hand_end), returns the existing UUID.
 */
export function ensureRoundId(matchId: string, roundNumber: number): string {
  const key = roundKey(matchId, roundNumber);
  const existing = roundIdLookup.get(key);
  if (existing) return existing;

  const id = crypto.randomUUID();
  roundIdLookup.set(key, id);
  return id;
}

/**
 * Persist a match round to Supabase (fire-and-forget).
 *
 * If the DB connection is unavailable (no SUPABASE_DB_URL), logs to console
 * so local development is not disrupted.
 *
 * Generates a UUID for the round so match_moves can reference it via FK.
 */
export async function recordRound(round: RoundRecord): Promise<void> {
  const db = await getDb();

  if (db) {
    // Buffer the round — will be flushed after the match row is created in the DB.
    // match_rounds has FK to matches, so we can't insert until persistMatch() runs.
    const rounds = bufferedRounds.get(round.matchId) ?? [];
    rounds.push(round);
    bufferedRounds.set(round.matchId, rounds);

    // Register round ID for moves lookup (or reuse existing from ensureRoundId)
    const key = roundKey(round.matchId, round.roundNumber);
    const existingId = roundIdLookup.get(key);
    if (existingId) {
      // Round was already registered by ensureRoundId — use that UUID
      round.roundId = existingId;
    } else {
      roundIdLookup.set(key, round.roundId);
    }
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
    // Clean up round ID lookup entries for this match
    for (const key of roundIdLookup.keys()) {
      if (key.startsWith(`${matchId}:`)) roundIdLookup.delete(key);
    }
    return;
  }

  if (db) {
    try {
      await db.insert(matchRounds).values(
        rounds.map((r) => ({
          id: r.roundId,  // use pre-generated UUID
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
  // Clean up round ID lookup entries for this match
  for (const key of roundIdLookup.keys()) {
    if (key.startsWith(`${matchId}:`)) roundIdLookup.delete(key);
  }
}

/**
 * Record a stub round for the in-progress hand when a match is abandoned.
 *
 * When a player forfeits or times out mid-hand, `hand_ended` never fires,
 * so `recordRound()` is never called. But moves may have already been
 * buffered with a `round_id` from `ensureRoundId()`. This function
 * creates a stub round with `reason: 'abandoned'` so the FK constraint
 * on `match_moves.round_id` is satisfied.
 *
 * If the current round was already recorded (normal hand_end flow),
 * this is a no-op.
 */
export function recordAbandonedRoundIfNeeded(
  matchId: string,
  state: MatchState,
): void {
  const roundNumber = state.turn.roundNumber;
  const existing = getRoundId(matchId, roundNumber);
  if (existing) return; // round already recorded — nothing to do

  const boardTileCount = state.board.tiles.length;
  const playerHands = state.players.map((p) => p.hand.length) as [
    number,
    number,
    number,
    number,
  ];

  const roundData: RoundRecord = {
    matchId,
    roundId: ensureRoundId(matchId, roundNumber),
    roundNumber,
    winningPair: null,
    points: 0,
    isBlocked: false,
    isAnnulled: false,
    reason: "abandoned",
    handScores: [0, 0],
    scoresAfter: [...state.scores.scores] as [number, number],
    boardLeftEnd: state.board.leftEnd,
    boardRightEnd: state.board.rightEnd,
    boardTileCount,
    playerHands,
    firstPlayer: state.turn.currentTurn,
  };

  void recordRound(roundData);
}

/**
 * Reset round buffers (TEST-ONLY).
 */
export function resetRoundBuffers(): void {
  bufferedRounds.clear();
  roundIdLookup.clear();
}
