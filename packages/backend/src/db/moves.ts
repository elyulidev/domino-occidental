/**
 * Match move persistence — records each play/pass to Supabase for replay & audit.
 *
 * This module uses a lazy postgres connection. If SUPABASE_DB_URL is not set
 * (e.g. local dev without Supabase), moves are logged to console instead.
 *
 * The game loop is NEVER blocked by DB writes — recordMatchMove is fire-and-forget.
 */

import type postgres from "postgres";

// ---------------------------------------------------------------------------
// Lazy connection
// ---------------------------------------------------------------------------

let sql: ReturnType<typeof postgres> | null = null;

function getDb(): ReturnType<typeof postgres> | null {
  if (sql) return sql;

  const url = process.env.SUPABASE_DB_URL ?? (Bun.env as Record<string, string | undefined>).SUPABASE_DB_URL;
  if (!url) return null;

  // Dynamic import to avoid crashing if postgres is not installed
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const postgresModule = require("postgres") as typeof postgres;
    sql = postgresModule(url, { max: 1, idle_timeout: 10 });
    return sql;
  } catch {
    console.warn("[db/moves] postgres module not available, will log to console");
    return null;
  }
}

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
export function recordMatchMove(move: MoveRecord): void {
  const db = getDb();

  const moveNumber = nextMoveNumber(move.matchId);

  if (db) {
    // Fire-and-forget: don't await — game loop is never blocked
    void db`
      insert into public.match_moves (
        match_id, round_number, player_index, move_number,
        is_pass, action_source, tile_id, tile_top, tile_bottom, side,
        board_left_end, board_right_end
      ) values (
        ${move.matchId}, ${move.roundNumber}, ${move.playerIndex}, ${moveNumber},
        ${move.isPass}, ${move.actionSource}, ${move.tileId ?? null}, ${move.tileTop ?? null},
        ${move.tileBottom ?? null}, ${move.side ?? null},
        ${move.boardLeftEnd}, ${move.boardRightEnd}
      )
    `.catch((err: unknown) => {
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
