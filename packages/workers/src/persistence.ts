/**
 * DB persistence layer for CF Workers.
 *
 * Ports the Supabase write logic from:
 * - backend/db/matches.ts  → persistTerminalMatch
 * - backend/db/moves.ts    → recordMatchMove
 * - backend/db/rounds.ts   → recordRound
 *
 * Key differences from the Elysia backend:
 * - Uses native fetch() via db.ts instead of Drizzle ORM
 * - No in-memory buffering (DO storage is the buffer; we write at terminal state)
 * - All writes are fire-and-forget (ctx.waitUntil in caller)
 * - Errors are logged but never crash the game
 */

import type { MatchState } from "@domino/shared";
import { supabaseInsert, supabaseUpsert } from "./db";

// ---------------------------------------------------------------------------
// Config helper
// ---------------------------------------------------------------------------

interface PersistenceConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
}

function cfg(supabaseUrl: string, serviceRoleKey: string): PersistenceConfig {
  return { supabaseUrl, serviceRoleKey };
}

// ---------------------------------------------------------------------------
// Types — match what the backend schema expects
// ---------------------------------------------------------------------------

/** Row shape for the `matches` table */
export interface MatchRow {
  id: string;
  status: "finished" | "abandoned";
  winner: number | null;
  forfeit_by: string | null;
  scores: number[];
  round_count: number;
  target_score: number;
  player_ids: string[];
  started_at: string;
  ended_at: string;
}

/** Row shape for the `match_moves` table */
export interface MoveRow {
  id: string;
  match_id: string;
  round_id: string;
  round_number: number;
  player_index: number;
  move_number: number;
  is_pass: boolean;
  action_source: string;
  tile_id: string | null;
  tile_top: number | null;
  tile_bottom: number | null;
  side: string | null;
  board_left_end: number | null;
  board_right_end: number | null;
}

/** Row shape for the `match_rounds` table */
export interface RoundRow {
  id: string;
  match_id: string;
  round_number: number;
  winning_pair: number | null;
  points: number;
  is_blocked: boolean;
  is_annulled: boolean;
  reason: string;
  hand_scores: number[];
  scores_after: number[];
  board_left_end: number | null;
  board_right_end: number | null;
  board_tile_count: number;
  player_hands: number[];
  first_player: number;
}

// ---------------------------------------------------------------------------
// Terminal match persistence
// ---------------------------------------------------------------------------

/**
 * Persist a terminal-state match to Supabase.
 *
 * Called when match_ended or match_abandoned fires.
 * Upserts into `matches` so replay runs are idempotent.
 */
export async function persistTerminalMatch(
  state: MatchState,
  endedEvent:
    | { type: "match_ended"; winner: number }
    | { type: "match_abandoned"; disconnectedPlayerId: string }
    | null,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  const config = cfg(supabaseUrl, serviceRoleKey);

  let winner: number | null = null;
  let forfeitBy: string | null = null;

  if (endedEvent?.type === "match_ended") {
    winner = endedEvent.winner;
  }
  if (endedEvent?.type === "match_abandoned") {
    forfeitBy = endedEvent.disconnectedPlayerId;
  }

  const row: MatchRow = {
    id: state.matchId,
    status: state.status as "finished" | "abandoned",
    winner,
    forfeit_by: forfeitBy,
    scores: [...state.scores.scores],
    round_count: state.turn.roundNumber + 1,
    target_score: state.targetScore,
    player_ids: state.players.map((p) => p.id),
    started_at: state.players[0].lastActionAt.toISOString(),
    ended_at: new Date().toISOString(),
  };

  await supabaseUpsert("matches", row, "id", config);
  console.log(
    `[persistence] match ${state.matchId.slice(0, 8)} persisted (${state.status})`,
  );
}

// ---------------------------------------------------------------------------
// Move recording
// ---------------------------------------------------------------------------

/**
 * Record a single move to match_moves.
 *
 * Called after each playTile/passTurn. Inserts a row directly — no buffering.
 */
export async function recordMatchMove(
  state: MatchState,
  move: {
    playerId: string;
    isPass: boolean;
    tileId?: string;
    tileTop?: number;
    tileBottom?: number;
    side?: string;
    actionSource: "player" | "timeout" | "forfeit";
    moveNumber: number;
  },
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  const config = cfg(supabaseUrl, serviceRoleKey);

  const playerIndex = state.players.findIndex((p) => p.id === move.playerId);
  const roundId = `${state.matchId}:r${state.turn.roundNumber}`;

  const row: MoveRow = {
    id: crypto.randomUUID(),
    match_id: state.matchId,
    round_id: roundId,
    round_number: state.turn.roundNumber,
    player_index: playerIndex,
    move_number: move.moveNumber,
    is_pass: move.isPass,
    action_source: move.actionSource,
    tile_id: move.tileId ?? null,
    tile_top: move.tileTop ?? null,
    tile_bottom: move.tileBottom ?? null,
    side: move.side ?? null,
    board_left_end: state.board.leftEnd,
    board_right_end: state.board.rightEnd,
  };

  await supabaseInsert("match_moves", row, config);
}

// ---------------------------------------------------------------------------
// Round recording
// ---------------------------------------------------------------------------

/**
 * Record a completed round (hand) to match_rounds.
 *
 * Called when hand_ended fires. Inserts a row directly — no buffering.
 */
export async function recordRound(
  state: MatchState,
  roundData: {
    winningPair: number | null;
    points: number;
    isBlocked: boolean;
    isAnnulled: boolean;
    reason: "empty_hand" | "blocked" | "annulled" | "forced_winner" | "abandoned";
    handScores: [number, number];
    scoresAfter: [number, number];
  },
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<void> {
  const config = cfg(supabaseUrl, serviceRoleKey);

  const roundId = `${state.matchId}:r${state.turn.roundNumber}`;

  const row: RoundRow = {
    id: roundId,
    match_id: state.matchId,
    round_number: state.turn.roundNumber,
    winning_pair: roundData.winningPair,
    points: roundData.points,
    is_blocked: roundData.isBlocked,
    is_annulled: roundData.isAnnulled,
    reason: roundData.reason,
    hand_scores: [...roundData.handScores],
    scores_after: [...roundData.scoresAfter],
    board_left_end: state.board.leftEnd,
    board_right_end: state.board.rightEnd,
    board_tile_count: state.board.tiles.length,
    player_hands: state.players.map((p) => p.hand.length),
    first_player: state.turn.currentTurn,
  };

  await supabaseInsert("match_rounds", row, config);
}

// ---------------------------------------------------------------------------
// Helpers for GameDO wiring
// ---------------------------------------------------------------------------

/**
 * Extract the hand_ended event from a list of game events.
 * Returns null if no hand_ended event exists.
 */
export function findHandEndedEvent(
  events: Array<{ type: string }>,
): { type: "hand_ended" } | null {
  const ev = events.find((e) => e.type === "hand_ended");
  return ev && ev.type === "hand_ended" ? (ev as { type: "hand_ended" }) : null;
}

/**
 * Extract the terminal match event from a list of game events.
 */
export function findTerminalEvent(
  events: Array<{ type: string }>,
):
  | { type: "match_ended"; winner: number }
  | { type: "match_abandoned"; disconnectedPlayerId: string }
  | null {
  const ended = events.find(
    (e): e is { type: "match_ended"; winner: number } => e.type === "match_ended",
  );
  if (ended) return ended;

  const abandoned = events.find(
    (e): e is { type: "match_abandoned"; disconnectedPlayerId: string } =>
      e.type === "match_abandoned",
  );
  return abandoned ?? null;
}

/**
 * Extract round result data from a hand_ended event or reconstruct from state.
 *
 * The shared game engine emits hand_ended with:
 *   { type: "hand_ended", winningPair, points, isBlocked, isAnnulled, reason, handScores }
 *
 * If the event lacks some fields, we fall back to state.
 */
export function extractRoundData(
  state: MatchState,
  handEndedEvent?: { type: "hand_ended"; [key: string]: unknown } | null,
): {
  winningPair: number | null;
  points: number;
  isBlocked: boolean;
  isAnnulled: boolean;
  reason: "empty_hand" | "blocked" | "annulled" | "forced_winner";
  handScores: [number, number];
  scoresAfter: [number, number];
} | null {
  if (!handEndedEvent) return null;

  // The hand_ended event from @domino/shared carries the round result
  const ev = handEndedEvent as Record<string, unknown>;

  return {
    winningPair: (ev.winningPair as number | null) ?? null,
    points: (ev.points as number) ?? 0,
    isBlocked: (ev.isBlocked as boolean) ?? false,
    isAnnulled: (ev.isAnnulled as boolean) ?? false,
    reason: (ev.reason as string) as
      | "empty_hand"
      | "blocked"
      | "annulled"
      | "forced_winner",
    handScores: (ev.handScores as [number, number]) ?? [0, 0],
    scoresAfter: [...state.scores.scores] as [number, number],
  };
}
