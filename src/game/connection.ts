import { isBlocked } from "./board";
import { handleHandEnd } from "./match";
import { incrementPasses, setConnected, updateLastAction } from "./player";
import { advanceTurn, calculateDeadline } from "./turn";
import type { ActionResult, GameEvent, MatchState } from "./types";
import { ABANDONMENT_THRESHOLD_MS, RECONNECT_WINDOW_MS } from "./types";

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

  const events: GameEvent[] = [{ type: "player_reconnected", playerId }];

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

/**
 * Forces a pass for a disconnected player when it's their turn.
 *
 * Validates the player index and current turn, then applies a forced pass
 * (increment passes, update last action, advance turn, set deadline).
 * Checks if the board becomes blocked after the forced pass.
 *
 * Design decision: trusts the WS layer — no isConnected check.
 * The WS layer decides when to call this function.
 *
 * @param match - Current match state
 * @param playerIndex - Index of the player (0–3)
 * @param now - Current timestamp
 * @returns ActionResult with updated state and events
 */
export function forcePassForDisconnected(
  match: MatchState,
  playerIndex: 0 | 1 | 2 | 3,
  now: Date,
): ActionResult {
  // 1. Validate playerIndex
  if (playerIndex < 0 || playerIndex > 3) {
    return {
      match,
      events: [gameError("INVALID_PLAYER_INDEX", "Player index must be 0-3")],
    };
  }

  // 2. Check it's their turn
  if (match.turn.currentTurn !== playerIndex) {
    return { match, events: [] };
  }

  // 3. Get player and apply forced pass
  const player = match.players[playerIndex];
  const updatedPlayer = updateLastAction(incrementPasses(player), now);

  // 4. Build new players array
  const newPlayers = [...match.players] as MatchState["players"];
  newPlayers[playerIndex] = updatedPlayer;

  // 5. Advance turn and set deadline
  const newTurn = calculateDeadline(advanceTurn(match.turn), now.getTime());

  // 6. Build intermediate match
  const intermediateMatch: MatchState = {
    ...match,
    players: newPlayers,
    turn: newTurn,
  };

  // 7. Check if board is blocked
  const blocked = isBlocked(intermediateMatch.board, intermediateMatch.players);

  if (blocked) {
    const handEndResult = handleHandEnd(
      intermediateMatch,
      playerIndex,
      "blocked",
    );
    return {
      match: handEndResult.match,
      events: [
        {
          type: "turn_timeout" as const,
          playerId: player.id,
          forcedPass: true,
        },
        ...handEndResult.events,
      ],
    };
  }

  return {
    match: intermediateMatch,
    events: [
      { type: "turn_timeout" as const, playerId: player.id, forcedPass: true },
    ],
  };
}

/**
 * Checks whether a disconnected player has exceeded the abandonment threshold.
 *
 * - If match is not in_progress → no-op
 * - If elapsed < RECONNECT_WINDOW_MS → no-op (player still has time)
 * - If RECONNECT_WINDOW_MS <= elapsed < ABANDONMENT_THRESHOLD_MS → emits reconnection_window_expiring
 * - If elapsed >= ABANDONMENT_THRESHOLD_MS → match status = abandoned, emits match_abandoned
 *
 * @param match - Current match state
 * @param disconnectRecord - Record of disconnection with timestamp and player ID
 * @param now - Current timestamp
 * @returns ActionResult with updated state and events
 */
export function checkAbandonment(
  match: MatchState,
  disconnectRecord: { disconnectedAt: Date; playerId: string },
  now: Date,
): ActionResult {
  if (match.status !== "in_progress") {
    return { match, events: [] };
  }

  const elapsed = now.getTime() - disconnectRecord.disconnectedAt.getTime();

  // Check abandonment threshold first
  if (elapsed >= ABANDONMENT_THRESHOLD_MS) {
    const newMatch: MatchState = { ...match, status: "abandoned" };
    return {
      match: newMatch,
      events: [
        {
          type: "match_abandoned",
          disconnectedPlayerId: disconnectRecord.playerId,
          reason: "abandonment",
        },
      ],
    };
  }

  // Check if past reconnect window → emit warning
  if (elapsed >= RECONNECT_WINDOW_MS) {
    const secondsLeft = Math.max(
      0,
      Math.floor((ABANDONMENT_THRESHOLD_MS - elapsed) / 1000),
    );
    return {
      match,
      events: [
        {
          type: "reconnection_window_expiring",
          playerId: disconnectRecord.playerId,
          secondsLeft,
        },
      ],
    };
  }

  // Still within reconnect window → no-op
  return { match, events: [] };
}

/**
 * Voluntarily forfeits a match from a player.
 *
 * - If match is already finished or abandoned → no-op
 * - If player not found → PLAYER_NOT_FOUND error
 * - Otherwise: disconnects the player, sets match to abandoned, emits match_abandoned
 *
 * @param match - Current match state
 * @param playerId - ID of the player forfeiting
 * @param now - Current timestamp
 * @returns ActionResult with updated state and events
 */
export function forfeitMatch(
  match: MatchState,
  playerId: string,
  now: Date,
): ActionResult {
  // No-op if match already over
  if (match.status === "finished" || match.status === "abandoned") {
    return { match, events: [] };
  }

  // Find player
  const playerIndex = findPlayerIndex(match, playerId);
  if (playerIndex === -1) {
    return {
      match,
      events: [gameError("PLAYER_NOT_FOUND", "Player not found in match")],
    };
  }

  // Disconnect the player
  const player = match.players[playerIndex];
  let updatedPlayer = setConnected(player, false);
  updatedPlayer = { ...updatedPlayer, lastActionAt: now };

  // Build new players array
  const newPlayers = match.players.map((p, i) =>
    i === playerIndex ? updatedPlayer : p,
  ) as MatchState["players"];

  const newMatch: MatchState = {
    ...match,
    players: newPlayers,
    status: "abandoned",
  };

  return {
    match: newMatch,
    events: [
      {
        type: "match_abandoned",
        disconnectedPlayerId: playerId,
        reason: "forfeit",
      },
    ],
  };
}
