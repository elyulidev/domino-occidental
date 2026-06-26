import type {
  ActionResult,
  GameEvent,
  MatchState,
  Side,
  Tile,
} from "@domino/shared";
import { canPlay, createBoard, isBlocked, place } from "./board";
import {
  createPlayer,
  hasTile,
  incrementPasses,
  removeTile,
  resetPasses,
  sumHand,
  updateLastAction,
} from "./player";
import {
  applyHandResult,
  calculateTotal,
  checkMatchEnd,
  createScoreState,
  getPairIndex,
  scoreHand,
} from "./scoring";
import {
  advanceTurn,
  calculateDeadline,
  checkTurnTimeout,
  createTurnState,
  getFirstPlayer,
  incrementNullRounds,
  resetNullRounds,
  setCurrentTurn,
} from "./turn";

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
  }) as [
    MatchState["players"][0],
    MatchState["players"][1],
    MatchState["players"][2],
    MatchState["players"][3],
  ];

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
  const players = match.players.map((p) =>
    resetPasses(p),
  ) as MatchState["players"];

  // Determine first player
  const hands = players.map((p) => p.hand);
  const firstPlayer = getFirstPlayer(
    hands,
    match.turn.lastHandWinner ?? undefined,
  );

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
):
  | { playerIndex: number; error: null }
  | { playerIndex: number; error: GameEvent } {
  if (match.status === "finished") {
    return {
      playerIndex: -1,
      error: gameError("MATCH_ALREADY_OVER", "Match has already ended"),
    };
  }
  if (match.status !== "in_progress") {
    return {
      playerIndex: -1,
      error: gameError("MATCH_NOT_ACTIVE", "Match is not in progress"),
    };
  }

  const playerIndex = findPlayerIndex(match, playerId);
  if (playerIndex === -1) {
    return {
      playerIndex: -1,
      error: gameError("PLAYER_NOT_FOUND", "Player not found in match"),
    };
  }

  const player = match.players[playerIndex];
  if (!player.isConnected) {
    return {
      playerIndex,
      error: gameError("PLAYER_DISCONNECTED", "Player is disconnected"),
    };
  }

  if (match.turn.currentTurn !== playerIndex) {
    return {
      playerIndex,
      error: gameError("NOT_YOUR_TURN", "It is not your turn"),
    };
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
    return {
      match,
      events: [gameError("TILE_NOT_FOUND", "Tile not found in hand")],
    };
  }

  // Find the tile (safe: hasTile confirmed existence above)
  const tile = player.hand.find((t) => t.id === tileId);
  if (!tile) {
    return {
      match,
      events: [gameError("TILE_NOT_FOUND", "Tile not found in hand")],
    };
  }

  // Check if the tile can be played on the specified side
  if (!canPlay(tile, side, match.board)) {
    return {
      match,
      events: [gameError("INVALID_PLAY", "Tile cannot be played on this side")],
    };
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
export function passTurn(match: MatchState, playerId: string): ActionResult {
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

  const events: GameEvent[] = [{ type: "player_passed", playerId }];

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
export function checkTimeout(match: MatchState, now: number): ActionResult {
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
export function handleHandEnd(
  match: MatchState,
  lastPlayerIndex: number,
  reason: "empty_hand" | "blocked",
): ActionResult {
  const hands = match.players.map((p) => p.hand);
  const isBlockedBoard = reason === "blocked";

  // Score the hand
  const result = scoreHand(
    hands,
    isBlockedBoard,
    match.turn.consecutiveNullRounds,
  );

  // Handle annulled hand
  if (result.isAnnulled) {
    // Check if we need to force a winner (4th+ consecutive)
    if (match.turn.consecutiveNullRounds >= 3) {
      // Find player with minimum individual sum
      let minSum = Number.POSITIVE_INFINITY;
      let minIndex = 0;
      for (let i = 0; i < 4; i++) {
        const playerSum = sumHand(match.players[i].hand);
        if (playerSum < minSum) {
          minSum = playerSum;
          minIndex = i;
        }
      }

      const winningPair = getPairIndex(minIndex);
      // Points = sum of the losing pair's tiles
      const losers = winningPair === 0 ? [1, 3] : [0, 2];
      const points = losers.reduce(
        (sum, i) => sum + sumHand(match.players[i].hand),
        0,
      );

      // Apply score
      const newScores = applyHandResult(match.scores, {
        winningPair,
        points,
        isBlocked: true,
        isAnnulled: false,
      });

      // Reset null rounds
      let newTurn = resetNullRounds(match.turn);
      newTurn = { ...newTurn, lastHandWinner: minIndex as 0 | 1 | 2 | 3 };

      const newMatch: MatchState = {
        ...match,
        scores: newScores,
        turn: newTurn,
      };

      const events: GameEvent[] = [
        { type: "hand_ended", winner: minIndex, reason: "forced_winner" },
        { type: "hand_scored", winningPair, points, scores: newScores.scores },
      ];

      // Check match end
      const matchResult = checkMatchEnd(newScores);
      if (matchResult.isOver && matchResult.winner !== null) {
        events.push({
          type: "match_ended",
          winner: matchResult.winner,
          finalScores: newScores.scores,
          reason: matchResult.reason,
        });
        return { match: { ...newMatch, status: "finished" }, events };
      }

      return { match: newMatch, events };
    }

    // Annulled but not 4th cascade — increment null rounds
    const newTurn = incrementNullRounds(match.turn);

    const newMatch: MatchState = {
      ...match,
      turn: newTurn,
    };

    return {
      match: newMatch,
      events: [{ type: "hand_ended", winner: null, reason: "annulled" }],
    };
  }

  // Normal or blocked win (not annulled)
  // Determine winner player index for the event
  let winnerPlayerIndex: number;
  let eventReason: "empty_hand" | "blocked" | "forced_winner";

  if (reason === "empty_hand") {
    winnerPlayerIndex = lastPlayerIndex;
    eventReason = "empty_hand";
  } else {
    // Blocked: check if this was a forced winner (4th+ cascade with tied pair sums)
    const totals = hands.map((h) => calculateTotal(h));
    const pair0Sum = totals[0] + totals[2];
    const pair1Sum = totals[1] + totals[3];
    const isForcedWinner =
      pair0Sum === pair1Sum && match.turn.consecutiveNullRounds >= 3;

    if (isForcedWinner) {
      // scoreHand already picked the lowest individual sum player as winner
      // Find the player index that scoreHand would have selected
      let minSum = Number.POSITIVE_INFINITY;
      let minIndex = 0;
      for (let i = 0; i < 4; i++) {
        if (totals[i] < minSum) {
          minSum = totals[i];
          minIndex = i;
        }
      }
      winnerPlayerIndex = minIndex;
      eventReason = "forced_winner";
    } else {
      // Normal blocked win: winner is the first player of the winning pair
      winnerPlayerIndex = result.winningPair === 0 ? 0 : 1;
      eventReason = "blocked";
    }
  }

  // Apply score
  const newScores = applyHandResult(match.scores, result);

  // Reset null rounds
  let newTurn = resetNullRounds(match.turn);
  newTurn = { ...newTurn, lastHandWinner: winnerPlayerIndex as 0 | 1 | 2 | 3 };

  const newMatch: MatchState = {
    ...match,
    scores: newScores,
    turn: newTurn,
  };

  const events: GameEvent[] = [
    { type: "hand_ended", winner: winnerPlayerIndex, reason: eventReason },
    {
      type: "hand_scored",
      winningPair: result.winningPair,
      points: result.points,
      scores: newScores.scores,
    },
  ];

  // Check match end
  const matchResult = checkMatchEnd(newScores);
  if (matchResult.isOver && matchResult.winner !== null) {
    events.push({
      type: "match_ended",
      winner: matchResult.winner,
      finalScores: newScores.scores,
      reason: matchResult.reason,
    });
    return { match: { ...newMatch, status: "finished" }, events };
  }

  return { match: newMatch, events };
}
