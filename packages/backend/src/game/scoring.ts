import type {
  HandResult,
  MatchResult,
  PairIndex,
  ScoreState,
  Tile,
} from "@domino/shared";
import { TARGET_SCORE } from "@domino/shared";

/**
 * Maps a player index (0–3) to its pair index.
 *
 * Pairs: P1+P3 = pair 0, P2+P4 = pair 1.
 *
 * @param playerIndex - Player index (0, 1, 2, or 3)
 * @returns Pair index (0 or 1)
 */
export function getPairIndex(playerIndex: number): PairIndex {
  return playerIndex % 2 === 0 ? 0 : 1;
}

/**
 * Calculates the total pips of a hand (sum of top + bottom for each tile).
 *
 * @param hand - Array of tiles
 * @returns Sum of all pips in the hand
 */
export function calculateTotal(hand: Tile[]): number {
  let total = 0;
  for (const t of hand) {
    total += t.top + t.bottom;
  }
  return total;
}

/**
 * Returns the player indices that are NOT in the winning pair.
 *
 * Used to sum the losers' tiles for scoring.
 *
 * @param winningPair - Index of the winning pair (0 or 1)
 * @returns Array of three losing player indices
 */
export function getLosingPlayers(
  winningPair: PairIndex,
): [number, number, number] {
  if (winningPair === 0) {
    return [1, 2, 3];
  }
  return [0, 2, 3];
}

/**
 * Scores a single hand based on the tiles remaining in each player's hand.
 *
 * - Normal win (not blocked): winning pair gets the sum of all three losers' tiles.
 * - Blocked hand: pair with lower individual sum wins; points = losing pair's total.
 * - Blocked tie: hand is annulled (isAnnulled: true).
 * - Annulled cascade: if this is the 4th+ consecutive annulled hand, the player
 *   with the lowest individual sum wins (override).
 *
 * @param hands - Array of 4 hands (indexed 0–3), each being the player's remaining tiles
 * @param isBlocked - Whether the board is blocked (no valid moves)
 * @param consecutiveAnnulled - Number of consecutive annulled hands before this one
 * @returns HandResult with winner, points, and flags
 */
export function scoreHand(
  hands: Tile[][],
  isBlocked: boolean,
  consecutiveAnnulled: number,
): HandResult {
  if (!isBlocked) {
    // Normal win: the player with an empty hand wins.
    // Sum of all three losers' tiles awarded to winning pair.
    const winnerIndex = hands.findIndex((h) => h.length === 0);
    const winningPair = getPairIndex(winnerIndex);
    const losers = getLosingPlayers(winningPair);
    const points = losers.reduce((sum, i) => sum + calculateTotal(hands[i]), 0);
    return {
      winningPair,
      points,
      isBlocked: false,
      isAnnulled: false,
    };
  }

  // Blocked hand: compare pair sums.
  const totals = hands.map((h) => calculateTotal(h));
  const pair0Sum = totals[0] + totals[2];
  const pair1Sum = totals[1] + totals[3];

  if (pair0Sum === pair1Sum) {
    // Tie — annulled unless cascade forces a winner.
    if (consecutiveAnnulled >= 3) {
      // 4th+ annulled: lowest individual sum wins.
      let minSum = Number.POSITIVE_INFINITY;
      let minIndex = 0;
      for (let i = 0; i < 4; i++) {
        if (totals[i] < minSum) {
          minSum = totals[i];
          minIndex = i;
        }
      }
      return {
        winningPair: getPairIndex(minIndex),
        points: totals.reduce((a, b) => a + b, 0),
        isBlocked: true,
        isAnnulled: false,
      };
    }
    return {
      winningPair: 0, // placeholder — annulled, no real winner
      points: 0,
      isBlocked: true,
      isAnnulled: true,
    };
  }

  // Clear winner: lower pair sum wins.
  const winningPair: PairIndex = pair0Sum < pair1Sum ? 0 : 1;
  const points = winningPair === 0 ? pair1Sum : pair0Sum;
  return {
    winningPair,
    points,
    isBlocked: true,
    isAnnulled: false,
  };
}

/**
 * Creates the initial score state for a new match.
 *
 * @returns ScoreState with both pairs at 0, not in tiebreaker
 */
export function createScoreState(): ScoreState {
  return { scores: [0, 0], isTiebreaker: false };
}

/**
 * Applies a hand result to the score state, returning a new immutable state.
 *
 * If the hand was annulled, no points are added.
 *
 * @param state - Current score state
 * @param result - Result of scoring a hand
 * @returns New ScoreState with updated scores
 */
export function applyHandResult(
  state: ScoreState,
  result: HandResult,
): ScoreState {
  if (result.isAnnulled) {
    return { ...state, scores: [...state.scores] };
  }
  const newScores: [number, number] = [...state.scores];
  newScores[result.winningPair] += result.points;
  return { ...state, scores: newScores };
}

/**
 * Checks whether the match has ended based on accumulated scores.
 *
 * - Single pair >= 200 → match over (reached_target).
 * - Both pairs >= 200 → higher wins (both_over_200).
 * - Both pairs >= 200 with exact tie → tiebreaker (match continues).
 *
 * @param state - Current score state
 * @returns MatchResult indicating whether the match is over
 */
export function checkMatchEnd(state: ScoreState): MatchResult {
  const [s0, s1] = state.scores;

  if (s0 >= TARGET_SCORE && s1 >= TARGET_SCORE) {
    if (state.isTiebreaker) {
      return { isOver: false, winner: null, reason: "tiebreaker" };
    }
    if (s0 > s1) {
      return { isOver: true, winner: 0, reason: "both_over_200" };
    }
    if (s1 > s0) {
      return { isOver: true, winner: 1, reason: "both_over_200" };
    }
    // Exact tie at 200+ → tiebreaker
    return { isOver: false, winner: null, reason: "tiebreaker" };
  }

  if (s0 >= TARGET_SCORE) {
    return { isOver: true, winner: 0, reason: "reached_target" };
  }
  if (s1 >= TARGET_SCORE) {
    return { isOver: true, winner: 1, reason: "reached_target" };
  }

  return { isOver: false, winner: null, reason: "" };
}
