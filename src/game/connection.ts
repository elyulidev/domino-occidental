import {
  createPlayer,
  setConnected,
  updateLastAction,
} from "./player";
import {
  RECONNECT_WINDOW_MS,
} from "./types";
import type { ActionResult, GameEvent, MatchState } from "./types";

/**
 * Creates a game_error event.
 */
function gameError(code: string, message: string): GameEvent {
  return { type: "game_error", code, message };
}

/**
 * Finds the player index for a given player ID.
 */
function findPlayerIndex(match: MatchState, playerId: string): number {
  return match.players.findIndex((p) => p.id === playerId);
}

/**
 * Disconnects a player from the match.
 *
 * - If player not found → PLAYER_NOT_FOUND error
 * - If already disconnected → no-op (return match with empty events)
 * - Otherwise: sets isConnected = false, updates lastActionAt, emits player_disconnected
 *
 * @param match - Current match state
 * @param playerId - ID of the player to disconnect
 * @param disconnectedAt - Timestamp of disconnection
 * @returns ActionResult with updated state and events
 */
export function disconnectPlayer(
  match: MatchState,
  playerId: string,
  disconnectedAt: Date,
): ActionResult {
  const playerIndex = findPlayerIndex(match, playerId);

  if (playerIndex === -1) {
    return {
      match,
      events: [gameError("PLAYER_NOT_FOUND", "Player not found in match")],
    };
  }

  const player = match.players[playerIndex];

  // Already disconnected → no-op
  if (!player.isConnected) {
    return { match, events: [] };
  }

  // Disconnect the player
  let updatedPlayer = setConnected(player, false);
  updatedPlayer = { ...updatedPlayer, lastActionAt: disconnectedAt };

  // Build new players array
  const newPlayers = match.players.map((p, i) =>
    i === playerIndex ? updatedPlayer : p,
  ) as MatchState["players"];

  const newMatch: MatchState = {
    ...match,
    players: newPlayers,
  };

  const events: GameEvent[] = [
    {
      type: "player_disconnected",
      playerId,
      reconnectWindowMs: RECONNECT_WINDOW_MS,
    },
  ];

  return { match: newMatch, events };
}

/**
 * Reconnects a disconnected player.
 *
 * - If player not found → PLAYER_NOT_FOUND error
 * - If already connected → no-op
 * - Otherwise: sets isConnected = true, updates lastActionAt, emits player_reconnected
 *
 * @param match - Current match state
 * @param playerId - ID of the player to reconnect
 * @param now - Current timestamp
 * @returns ActionResult with updated state and events
 */
export function reconnectPlayer(
  match: MatchState,
  playerId: string,
  now: Date,
): ActionResult {
  const playerIndex = findPlayerIndex(match, playerId);

  if (playerIndex === -1) {
    return {
      match,
      events: [gameError("PLAYER_NOT_FOUND", "Player not found in match")],
    };
  }

  const player = match.players[playerIndex];

  // Already connected → no-op
  if (player.isConnected) {
    return { match, events: [] };
  }

  // Reconnect the player
  let updatedPlayer = setConnected(player, true);
  updatedPlayer = { ...updatedPlayer, lastActionAt: now };

  // Build new players array
  const newPlayers = match.players.map((p, i) =>
    i === playerIndex ? updatedPlayer : p,
  ) as MatchState["players"];

  const newMatch: MatchState = {
    ...match,
    players: newPlayers,
  };

  const events: GameEvent[] = [
    { type: "player_reconnected", playerId },
  ];

  return { match: newMatch, events };
}

/**
 * Checks whether the reconnection window has expired.
 *
 * Pure query function — does NOT return ActionResult.
 *
 * @param disconnectRecord - Record of disconnection with timestamp and player ID
 * @param now - Current timestamp
 * @returns Object with windowExpired flag and secondsLeft countdown
 */
export function checkReconnectWindow(
  disconnectRecord: { disconnectedAt: Date; playerId: string },
  now: Date,
): { windowExpired: boolean; secondsLeft: number } {
  const elapsed = now.getTime() - disconnectRecord.disconnectedAt.getTime();
  const windowExpired = elapsed >= RECONNECT_WINDOW_MS;
  const secondsLeft = Math.max(
    0,
    Math.floor((RECONNECT_WINDOW_MS - elapsed) / 1000),
  );

  return { windowExpired, secondsLeft };
}
