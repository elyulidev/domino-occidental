/**
 * Game types — re-exported from \@domino/shared (single source of truth).
 *
 * Module-specific types from the shared package (GameStore, SanitizedMatchState,
 * WsServerMessage, UserChannelManager, etc.) are NOT re-exported here to keep
 * the game/types.ts namespace focused on the game-domain type surface.
 * Import those directly from "\@domino/shared".
 *
 * @see packages/shared/src/types.ts for the canonical definitions
 */

// ── Core game domain types ──────────────────────────────────────────────────

export type {
  ActionResult,
  BoardState,
  DealResult,
  EloConfig,
  EloResult,
  GameEvent,
  HandResult,
  MatchResult,
  MatchState,
  MatchStatus,
  PairIndex,
  PlacedTile,
  PlayerState,
  ScoreState,
  Side,
  Tile,
  TimeoutResult,
  TurnState,
} from "@domino/shared";

// ── Game constants ──────────────────────────────────────────────────────────

export {
  ABANDONMENT_THRESHOLD_MS,
  HEARTBEAT_MS,
  PLAYER_COUNT,
  RECONNECT_WINDOW_MS,
  TARGET_SCORE,
  TURN_TIMEOUT_MS,
} from "@domino/shared";
