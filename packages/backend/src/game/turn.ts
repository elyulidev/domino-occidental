import type { Tile, TimeoutResult, TurnState } from "@domino/shared";

/**
 * Timeout window for a single turn in milliseconds.
 */
export const TURN_TIMEOUT_MS = 45_000;

/**
 * Number of players in a match.
 */
export const PLAYER_COUNT = 4;

/**
 * Creates an initial TurnState with default values.
 *
 * @returns TurnState with currentTurn 0, all counters at zero, no deadline, no winner
 */
export function createTurnState(): TurnState {
  return {
    currentTurn: 0,
    turnDeadline: null,
    consecutiveNullRounds: 0,
    roundNumber: 0,
    lastHandWinner: null,
  };
}

/**
 * Advances the turn to the next player in cycle order: 0→1→2→3→0.
 *
 * Returns a new state — the original is never mutated.
 *
 * @param state - Current turn state
 * @returns New state with currentTurn advanced by one
 */
export function advanceTurn(state: TurnState): TurnState {
  return {
    ...state,
    currentTurn: ((state.currentTurn + 1) % PLAYER_COUNT) as 0 | 1 | 2 | 3,
  };
}

/**
 * Sets the current turn to a specific player index.
 *
 * @param state - Current turn state
 * @param playerIndex - Target player index (0–3)
 * @returns New state with the specified currentTurn
 * @throws {Error} If playerIndex is < 0 or > 3
 */
export function setCurrentTurn(
  state: TurnState,
  playerIndex: number,
): TurnState {
  if (playerIndex < 0 || playerIndex > 3) {
    throw new Error(`Invalid playerIndex: ${playerIndex}`);
  }
  return { ...state, currentTurn: playerIndex as 0 | 1 | 2 | 3 };
}

/**
 * Returns the next player index without mutating state.
 *
 * @param state - Current turn state
 * @returns The index of the player whose turn comes next
 */
export function getNextPlayer(state: TurnState): 0 | 1 | 2 | 3 {
  return ((state.currentTurn + 1) % PLAYER_COUNT) as 0 | 1 | 2 | 3;
}

/**
 * Sets the turn deadline to `now + TURN_TIMEOUT_MS`.
 *
 * If `now` is not provided, uses `Date.now()`.
 * Overwrites any existing deadline.
 *
 * @param state - Current turn state
 * @param now - Current time in Unix ms (defaults to Date.now())
 * @returns New state with updated turnDeadline
 */
export function calculateDeadline(state: TurnState, now?: number): TurnState {
  const currentTime = now ?? Date.now();
  return { ...state, turnDeadline: currentTime + TURN_TIMEOUT_MS };
}

/**
 * Checks whether the current turn has timed out.
 *
 * CRITICAL: Guards against `turnDeadline === null` — in that case, always
 * returns `{ timedOut: false, playerIndex: state.currentTurn }`.
 *
 * @param state - Current turn state
 * @param now - Current time in Unix ms
 * @returns TimeoutResult with timedOut flag and the player index
 */
export function checkTurnTimeout(state: TurnState, now: number): TimeoutResult {
  if (state.turnDeadline === null) {
    return { timedOut: false, playerIndex: state.currentTurn };
  }
  return {
    timedOut: now >= state.turnDeadline,
    playerIndex: state.currentTurn,
  };
}

/**
 * Increments the consecutive null rounds counter by 1.
 *
 * @param state - Current turn state
 * @returns New state with consecutiveNullRounds incremented
 */
export function incrementNullRounds(state: TurnState): TurnState {
  return {
    ...state,
    consecutiveNullRounds: state.consecutiveNullRounds + 1,
  };
}

/**
 * Resets the consecutive null rounds counter to 0.
 *
 * @param state - Current turn state
 * @returns New state with consecutiveNullRounds set to 0
 */
export function resetNullRounds(state: TurnState): TurnState {
  return { ...state, consecutiveNullRounds: 0 };
}

/**
 * Selects the first player for a new hand.
 *
 * Rules:
 * 1. If `lastHandWinner` is provided, returns it directly (subsequent hands).
 * 2. Scans all hands for the highest double tile (by pip sum).
 * 3. If no doubles, selects the player with the highest sum of all tiles.
 * 4. Tie-break: lower index wins.
 *
 * @param hands - Array of 4 player hands (each an array of Tiles)
 * @param lastHandWinner - Winner of the previous hand (optional)
 * @returns Index of the player who goes first (0–3)
 */
export function getFirstPlayer(
  hands: Tile[][],
  lastHandWinner?: number,
): 0 | 1 | 2 | 3 {
  if (lastHandWinner !== undefined) {
    return lastHandWinner as 0 | 1 | 2 | 3;
  }

  let bestDoubleSum = -1;
  let bestDoubleIndex = -1;
  let bestSum = -1;
  let bestSumIndex = -1;

  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];
    let handSum = 0;

    for (const t of hand) {
      handSum += t.top + t.bottom;

      // Check for double (top === bottom)
      if (t.top === t.bottom) {
        const doubleSum = t.top + t.bottom;
        if (doubleSum > bestDoubleSum) {
          bestDoubleSum = doubleSum;
          bestDoubleIndex = i;
        }
      }
    }

    // Track best sum (only if no double found for this player)
    if (handSum > bestSum) {
      bestSum = handSum;
      bestSumIndex = i;
    }
  }

  // If a double was found, use that player
  if (bestDoubleIndex !== -1) {
    return bestDoubleIndex as 0 | 1 | 2 | 3;
  }

  // Fallback to highest sum (lower index wins ties via >)
  return (bestSumIndex !== -1 ? bestSumIndex : 0) as 0 | 1 | 2 | 3;
}

/**
 * Detects whether the turn state represents a fresh, untouched round.
 *
 * Returns `true` only when `roundNumber === 0` AND `turnDeadline === null`.
 *
 * @param state - Current turn state
 * @returns true if the state is initial/new round
 */
export function isNewRound(state: TurnState): boolean {
  return (
    state.roundNumber === 0 &&
    state.turnDeadline === null &&
    state.currentTurn === 0
  );
}
