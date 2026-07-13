/**
 * Match move persistence — records each play/pass to Supabase for replay & audit.
 *
 * This module uses a lazy postgres connection. If SUPABASE_DB_URL is not set
 * (e.g. local dev without Supabase), moves are logged to console instead.
 *
 * The game loop is NEVER blocked by DB writes — recordMatchMove is fire-and-forget.
 */

import { getDb } from "./client";
import { matchMoves } from "./schema";

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
 */
export async function recordMatchMove(move: MoveRecord): Promise<void> {
  const db = await getDb();

  const moveNumber = nextMoveNumber(move.matchId);

  if (db) {
    // Fire-and-forget: don't await — game loop is never blocked
    void db
      .insert(matchMoves)
      .values({
        matchId: move.matchId,
        roundNumber: move.roundNumber,
        playerIndex: move.playerIndex,
        moveNumber: moveNumber,
        isPass: move.isPass,
        actionSource: move.actionSource,
        tileId: move.tileId ?? undefined,
        tileTop: move.tileTop ?? undefined,
        tileBottom: move.tileBottom ?? undefined,
        side: move.side ?? undefined,
        boardLeftEnd: move.boardLeftEnd,
        boardRightEnd: move.boardRightEnd,
      })
      .catch((err: unknown) => {
        console.error("[db/moves] failed to record match move:", err);
      });
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

/**
 * Reset move counters (TEST-ONLY).
 */
export function resetMoveCounters(): void {
  moveCounters.clear();
}
