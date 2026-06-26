/**
 * Pure ELO calculation functions for the matchmaking system.
 *
 * Follows the standard ELO formula with K-factor variants:
 * - K=32: casual matches (default)
 * - K=48: tournament matches
 * - K=16: players with ELO > 2000 (stabilization)
 *
 * @see AGENTS.md §6 for ELO rules
 */

/**
 * Compute expected score for player A against player B.
 * Returns a value between 0 and 1.
 *
 * Formula: E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *
 * @param ratingA - Current ELO rating of player A
 * @param ratingB - Current ELO rating of player B
 * @returns Expected score (0–1)
 */
export function computeExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Compute ELO delta for a single player.
 *
 * Formula: ΔR = K × (S_A - E_A)
 *
 * @param kFactor - K-factor (32, 48, or 16)
 * @param expectedScore - from computeExpectedScore
 * @param score - 1 for win, 0 for loss
 * @returns The delta (positive for win, negative for loss), rounded to nearest integer
 */
export function computeEloDelta(
  kFactor: number,
  expectedScore: number,
  score: number,
): number {
  return Math.round(kFactor * (score - expectedScore));
}

/**
 * Get the appropriate K-factor based on current ELO and game type.
 *
 * Rules:
 * - Tournament: K=48 (higher impact)
 * - ELO > 2000: K=16 (stabilization)
 * - Default (casual): K=32
 *
 * @param currentElo - Player's current ELO rating
 * @param isTournament - Whether this is a tournament match
 * @returns K-factor value
 */
export function getKFactor(
  currentElo: number,
  isTournament: boolean = false,
): number {
  if (isTournament) return 48;
  if (currentElo > 2000) return 16;
  return 32;
}

/**
 * Compute initial pair ELO as average of individual ELOs.
 *
 * When two players form a pair, their combined ELO is the rounded average.
 *
 * @param elo1 - Individual ELO of player 1
 * @param elo2 - Individual ELO of player 2
 * @returns Initial pair ELO (rounded to nearest integer)
 */
export function computeInitialPairElo(elo1: number, elo2: number): number {
  return Math.round((elo1 + elo2) / 2);
}

/**
 * Compute the penalty delta for abandonment/forfeit.
 *
 * Penalty is 50% extra on the normal loss delta:
 * floor(K × (0 - E_A) × 1.5)
 *
 * This applies to both individual and pair ELO.
 *
 * @param kFactor - K-factor for this match
 * @param expectedScore - from computeExpectedScore
 * @returns A negative number (the penalty to apply)
 */
export function computeAbandonPenalty(
  kFactor: number,
  expectedScore: number,
): number {
  return Math.floor(kFactor * (0 - expectedScore) * 1.5);
}
