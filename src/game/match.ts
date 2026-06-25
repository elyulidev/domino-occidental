import { createBoard } from "./board";
import { createPlayer, resetPasses } from "./player";
import { createScoreState } from "./scoring";
import {
  calculateDeadline,
  createTurnState,
  getFirstPlayer,
  setCurrentTurn,
} from "./turn";
import type { ActionResult, MatchState, Tile } from "./types";

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
