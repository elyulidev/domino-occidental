import { canPlay, createBoard, isBlocked, place } from "./board";
import { createPlayer, hasTile, incrementPasses, removeTile, resetPasses, updateLastAction } from "./player";
import { createScoreState } from "./scoring";
import {
  advanceTurn,
  calculateDeadline,
  checkTurnTimeout,
  createTurnState,
  getFirstPlayer,
  setCurrentTurn,
} from "./turn";
import type { ActionResult, GameEvent, MatchState, Side, Tile } from "./types";

/**
 * Initializes a new match state from pre-dealt hands and pool.
 *
 * Creates all four player states, sets up the board, turn, and score state.
 * Does NOT emit round_started — call startHand() to begin the first hand.
 *
 * @param matchId - Unique identifier for this match
 * @param hands - Pre-dealt hands for each of the 4 players
 * @param pool - Remaining tiles in the pool (face-down)
 * @param targetScore - Points needed to win (default 200)
 * @returns ActionResult with the initial MatchState and no events
 */
export function initializeMatch(
  matchId: string,
  hands: [Tile[], Tile[], Tile[], Tile[]],
  pool: Tile[],
  targetScore: number = 200,
): ActionResult {
  const players = hands.map((hand, i) => {
    const player = createPlayer(`p${i}`);
    let currentHand = player.hand;
    for (const tile of hand) {
      currentHand = [...currentHand, tile];
    }
    return { ...player, hand: currentHand };
  }) as [MatchState["players"][0], MatchState["players"][1], MatchState["players"][2], MatchState["players"][3]];

  const match: MatchState = {
    matchId,
    players,
    board: createBoard(),
    turn: createTurnState(),
    scores: createScoreState(),
    pool,
    poolCount: pool.length,
    status: "in_progress",
    targetScore,
  };

  return { match, events: [] };
}

/**
 * Starts a new hand within an existing match.
 *
 * Resets passes, creates a fresh board, determines the first player,
 * and sets the turn deadline.
 *
 * @param match - Current match state
 * @returns ActionResult with updated state and round_started event
 */
export function startHand(match: MatchState): ActionResult {
  // Reset all players' passes
  const players = match.players.map((p) => resetPasses(p)) as MatchState["players"];

  // Determine first player
  const hands = players.map((p) => p.hand);
  const firstPlayer = getFirstPlayer(hands, match.turn.lastHandWinner ?? undefined);

  // Set turn
  let newTurn = setCurrentTurn(match.turn, firstPlayer);
  newTurn = calculateDeadline(newTurn);

  const updatedMatch: MatchState = {
    ...match,
    players,
    board: createBoard(),
    turn: newTurn,
  };

  return {
    match: updatedMatch,
    events: [{ type: "round_started", firstPlayer }],
  };
}

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
 * Validates that a player action can proceed.
 *
 * @returns null if valid, or a game_error event if invalid
 */
function validateAction(
  match: MatchState,
  playerId: string,
): { playerIndex: number; error: null } | { playerIndex: number; error: GameEvent } {
  if (match.status === "finished") {
    return { playerIndex: -1, error: gameError("MATCH_ALREADY_OVER", "Match has already ended") };
  }
  if (match.status !== "in_progress") {
    return { playerIndex: -1, error: gameError("MATCH_NOT_ACTIVE", "Match is not in progress") };
  }

  const playerIndex = findPlayerIndex(match, playerId);
  if (playerIndex === -1) {
    return { playerIndex: -1, error: gameError("PLAYER_NOT_FOUND", "Player not found in match") };
  }

  const player = match.players[playerIndex];
  if (!player.isConnected) {
    return { playerIndex, error: gameError("PLAYER_DISCONNECTED", "Player is disconnected") };
  }

  if (match.turn.currentTurn !== playerIndex) {
    return { playerIndex, error: gameError("NOT_YOUR_TURN", "It is not your turn") };
  }

  return { playerIndex, error: null };
}

/**
 * Plays a tile on the board.
 *
 * Validates all preconditions, places the tile, removes it from the hand,
 * advances the turn, and checks for hand end conditions.
 *
 * @param match - Current match state
 * @param playerId - ID of the player making the move
 * @param tileId - ID of the tile to play
 * @param side - Which side of the board to place on
 * @returns ActionResult with updated state and events
 */
export function playTile(
  match: MatchState,
  playerId: string,
  tileId: string,
  side: Side,
): ActionResult {
  const validation = validateAction(match, playerId);
  if (validation.error) {
    return { match, events: [validation.error] };
  }

  const playerIndex = validation.playerIndex;
  const player = match.players[playerIndex];

  // Check tile exists in hand
  if (!hasTile(player.hand, tileId)) {
    return { match, events: [gameError("TILE_NOT_FOUND", "Tile not found in hand")] };
  }

  // Find the tile
  const tile = player.hand.find((t) => t.id === tileId)!;

  // Check if the tile can be played on the specified side
  if (!canPlay(tile, side, match.board)) {
    return { match, events: [gameError("INVALID_PLAY", "Tile cannot be played on this side")] };
  }

  // Place the tile
  const newBoard = place(tile, side, playerId, match.board);

  // Remove tile from hand
  const newHand = removeTile(player.hand, tileId);

  // Update player state
  const updatedPlayer = {
    ...player,
    hand: newHand,
    consecutivePasses: 0,
    lastActionAt: new Date(),
  };

  // Build new players array
  const newPlayers = match.players.map((p, i) =>
    i === playerIndex ? updatedPlayer : p,
  ) as MatchState["players"];

  // Advance turn and set deadline
  let newTurn = advanceTurn(match.turn);
  newTurn = calculateDeadline(newTurn);

  // Build new match state
  const newMatch: MatchState = {
    ...match,
    players: newPlayers,
    board: newBoard,
    turn: newTurn,
  };

  // Emit tile_played event
  const events: GameEvent[] = [
    { type: "tile_played", playerId, tileId, side, board: newBoard },
  ];

  // Check for hand end conditions
  if (newHand.length === 0) {
    // Player emptied their hand
    const handEndResult = handleHandEnd(newMatch, playerIndex, "empty_hand");
    return {
      match: handEndResult.match,
      events: [...events, ...handEndResult.events],
    };
  }

  if (isBlocked(newBoard, newPlayers)) {
    // Board is blocked
    const handEndResult = handleHandEnd(newMatch, playerIndex, "blocked");
    return {
      match: handEndResult.match,
      events: [...events, ...handEndResult.events],
    };
  }

  return { match: newMatch, events };
}

/**
 * Passes the current player's turn.
 *
 * @param match - Current match state
 * @param playerId - ID of the player passing
 * @returns ActionResult with updated state and events
 */
export function passTurn(
  match: MatchState,
  playerId: string,
): ActionResult {
  const validation = validateAction(match, playerId);
  if (validation.error) {
    return { match, events: [validation.error] };
  }

  const playerIndex = validation.playerIndex;
  const player = match.players[playerIndex];

  // Can't pass with empty hand (already won)
  if (player.hand.length === 0) {
    return {
      match,
      events: [gameError("HAND_EMPTY", "Cannot pass with an empty hand")],
    };
  }

  // Update player
  let updatedPlayer = incrementPasses(player);
  updatedPlayer = updateLastAction(updatedPlayer);

  // Build new players array
  const newPlayers = match.players.map((p, i) =>
    i === playerIndex ? updatedPlayer : p,
  ) as MatchState["players"];

  // Advance turn and set deadline
  let newTurn = advanceTurn(match.turn);
  newTurn = calculateDeadline(newTurn);

  // Build new match state
  const newMatch: MatchState = {
    ...match,
    players: newPlayers,
    turn: newTurn,
  };

  const events: GameEvent[] = [
    { type: "player_passed", playerId },
  ];

  // Check if board is now blocked
  if (isBlocked(match.board, newPlayers)) {
    const handEndResult = handleHandEnd(newMatch, playerIndex, "blocked");
    return {
      match: handEndResult.match,
      events: [...events, ...handEndResult.events],
    };
  }

  return { match: newMatch, events };
}

/**
 * Checks if the current turn has timed out and forces a pass if so.
 *
 * @param match - Current match state
 * @param now - Current time in Unix ms
 * @returns ActionResult with updated state and events
 */
export function checkTimeout(
  match: MatchState,
  now: number,
): ActionResult {
  const timeoutResult = checkTurnTimeout(match.turn, now);

  if (!timeoutResult.timedOut) {
    return { match, events: [] };
  }

  const playerIndex = timeoutResult.playerIndex;
  const player = match.players[playerIndex];

  // Update player (force pass)
  let updatedPlayer = incrementPasses(player);
  updatedPlayer = updateLastAction(updatedPlayer);

  // Build new players array
  const newPlayers = match.players.map((p, i) =>
    i === playerIndex ? updatedPlayer : p,
  ) as MatchState["players"];

  // Advance turn and set deadline
  let newTurn = advanceTurn(match.turn);
  newTurn = calculateDeadline(newTurn);

  // Build new match state
  const newMatch: MatchState = {
    ...match,
    players: newPlayers,
    turn: newTurn,
  };

  const events: GameEvent[] = [
    { type: "turn_timeout", playerId: player.id, forcedPass: true },
  ];

  // Check if board is now blocked
  if (isBlocked(match.board, newPlayers)) {
    const handEndResult = handleHandEnd(newMatch, playerIndex, "blocked");
    return {
      match: handEndResult.match,
      events: [...events, ...handEndResult.events],
    };
  }

  return { match: newMatch, events };
}

/**
 * Handles the end of a hand (empty hand or blocked board).
 *
 * This is an internal function called by playTile, passTurn, and checkTimeout.
 * It scores the hand, updates scores, and checks for match end.
 *
 * @param match - Current match state
 * @param lastPlayerIndex - Index of the player who triggered the hand end
 * @param reason - Why the hand ended
 * @returns ActionResult with updated state and events
 */
function handleHandEnd(
  match: MatchState,
  lastPlayerIndex: number,
  reason: "empty_hand" | "blocked",
): ActionResult {
  // This will be implemented in T8
  // For now, return a basic result
  return { match, events: [] };
}
