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
  Tile,
  PlayerState,
  DealResult,
  Side,
  PlacedTile,
  BoardState,
  TurnState,
  TimeoutResult,
  PairIndex,
  ScoreState,
  HandResult,
  MatchResult,
  MatchStatus,
  MatchState,
  ActionResult,
  EloConfig,
  EloResult,
  GameEvent,
} from "@domino/shared";

// ── Game constants ──────────────────────────────────────────────────────────

export {
  TURN_TIMEOUT_MS,
  PLAYER_COUNT,
  HEARTBEAT_MS,
  RECONNECT_WINDOW_MS,
  ABANDONMENT_THRESHOLD_MS,
  TARGET_SCORE,
} from "@domino/shared";
