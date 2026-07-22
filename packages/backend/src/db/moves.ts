/**
 * Match move persistence — records each play/pass to Supabase for replay & audit.
 *
 * This module uses a lazy postgres connection. If SUPABASE_DB_URL is not set
 * (e.g. local dev without Supabase), moves are logged to console instead.
 *
 * The game loop is NEVER blocked by DB writes — recordMatchMove is fire-and-forget.
 *
 * NORMALIZATION: match_moves now references match_rounds via round_id FK.
 * The round_id is resolved from the rounds buffer (rounds must be recorded
 * before moves within the same hand, or at least before flush).
 */

import { getDb } from "./client";
import { matchMoves } from "./schema";
import { ensureRoundId } from "./rounds";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoveRecord {
  matchId: string;
  roundNumber: number;
  playerIndex: number;
  moveNumber: number;
  isPass: boolean;
  actionSource: "player" | "timeout" | "forfeit";
  tileId?: string;
  tileTop?: number;
  tileBottom?: number;
  side?: "left" | "right";
  boardLeftEnd: number | null;
  boardRightEnd: number | null;
}

// ---------------------------------------------------------------------------
// Move recording
// ---------------------------------------------------------------------------

/**
 * In-memory move counter per match (resets on server restart, like the game state).
 */
const moveCounters = new Map<string, number>();

/**
 * Internal move record with resolved roundId for DB insert.
 */
interface BufferedMove extends MoveRecord {
  moveNumber: number;
  roundId: string;
}

/**
 * Buffered moves per match — accumulated during gameplay, flushed after
 * the match row is created in the DB by persistMatch().
 */
const bufferedMoves = new Map<string, BufferedMove[]>();

/**
 * Get the next move number for a match, then increment.
 */
function nextMoveNumber(matchId: string): number {
  const current = moveCounters.get(matchId) ?? 0;
  moveCounters.set(matchId, current + 1);
  return current + 1;
}

/**
 * Persist a match move to Supabase (fire-and-forget).
 *
 * If the DB connection is unavailable (no SUPABASE_DB_URL), logs to console
 * so local development is not disrupted.
 *
 * Resolves round_id from the rounds buffer before buffering.
 */
export async function recordMatchMove(move: MoveRecord): Promise<void> {
  const db = await getDb();

  const moveNumber = nextMoveNumber(move.matchId);

  // Resolve round_id from rounds buffer (generates UUID on first move of each hand)
  const roundId = ensureRoundId(move.matchId, move.roundNumber);

  if (db) {
    // Buffer the move — will be flushed after the match row is created in the DB.
    // match_moves has FK to matches AND match_rounds, so we can't insert until
    // persistMatch() runs and rounds are flushed first.
    const moves = bufferedMoves.get(move.matchId) ?? [];
    moves.push({ ...move, moveNumber, roundId });
    bufferedMoves.set(move.matchId, moves);
  } else {
    // Dev fallback: log to console
    console.log(
      `[db/moves] ${move.isPass ? "PASS" : "PLAY"}  match=${move.matchId.slice(0, 8)} ` +
      `round=${move.roundNumber} move#=${moveNumber} player=${move.playerIndex}` +
      ` source=${move.actionSource}` +
      (move.isPass ? "" : ` tile=${move.tileId} side=${move.side}`),
    );
  }
}

export async function flushMatchMoves(matchId: string): Promise<void> {
  const db = await getDb();
  const moves = bufferedMoves.get(matchId);
  if (!moves || moves.length === 0) {
    bufferedMoves.delete(matchId);
    moveCounters.delete(matchId);
    return;
  }

  if (db) {
    try {
      await db.insert(matchMoves).values(
        moves.map((m) => ({
          matchId: m.matchId,
          roundId: m.roundId,  // resolved from rounds buffer
          roundNumber: m.roundNumber,
          playerIndex: m.playerIndex,
          moveNumber: m.moveNumber,
          isPass: m.isPass,
          actionSource: m.actionSource,
          tileId: m.tileId ?? undefined,
          tileTop: m.tileTop ?? undefined,
          tileBottom: m.tileBottom ?? undefined,
          side: m.side ?? undefined,
          boardLeftEnd: m.boardLeftEnd,
          boardRightEnd: m.boardRightEnd,
        })),
      );
      console.log(`[db/moves] flushed ${moves.length} moves for match ${matchId.slice(0, 8)}`);
    } catch (err: unknown) {
      console.error(`[db/moves] failed to flush ${moves.length} moves for match ${matchId.slice(0, 8)}:`, err);
    }
  } else {
    console.log(`[db/moves] skipped flush (${moves.length} moves) — no DB connection`);
  }

  bufferedMoves.delete(matchId);
  moveCounters.delete(matchId);
}

/**
 * Reset move counters (TEST-ONLY).
 */
export function resetMoveCounters(): void {
  moveCounters.clear();
  bufferedMoves.clear();
}
