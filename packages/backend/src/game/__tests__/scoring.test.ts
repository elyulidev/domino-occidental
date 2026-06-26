import { describe, expect, it } from "bun:test";
import {
  applyHandResult,
  calculateTotal,
  checkMatchEnd,
  createScoreState,
  getLosingPlayers,
  getPairIndex,
  scoreHand,
} from "../scoring";
import type { Tile } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tile(top: number, bottom: number): Tile {
  return { top, bottom, id: crypto.randomUUID() };
}

// ---------------------------------------------------------------------------
// getPairIndex
// ---------------------------------------------------------------------------

describe("getPairIndex", () => {
  it("maps player 0 to pair 0", () => {
    expect(getPairIndex(0)).toBe(0);
  });

  it("maps player 1 to pair 1", () => {
    expect(getPairIndex(1)).toBe(1);
  });

  it("maps player 2 to pair 0", () => {
    expect(getPairIndex(2)).toBe(0);
  });

  it("maps player 3 to pair 1", () => {
    expect(getPairIndex(3)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateTotal
// ---------------------------------------------------------------------------

describe("calculateTotal", () => {
  it("sums top+bottom for a standard hand", () => {
    const hand = [tile(6, 4), tile(3, 2), tile(9, 1)];
    expect(calculateTotal(hand)).toBe(25);
  });

  it("returns 0 for an empty hand", () => {
    expect(calculateTotal([])).toBe(0);
  });

  it("returns sum for a single tile", () => {
    expect(calculateTotal([tile(5, 5)])).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// getLosingPlayers
// ---------------------------------------------------------------------------

describe("getLosingPlayers", () => {
  it("returns indices of players not in pair 0 when pair 0 wins", () => {
    expect(getLosingPlayers(0)).toEqual([1, 2, 3]);
  });

  it("returns indices of players not in pair 1 when pair 1 wins", () => {
    expect(getLosingPlayers(1)).toEqual([0, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// scoreHand — normal win
// ---------------------------------------------------------------------------

describe("scoreHand — normal win", () => {
  it("awards sum of three losers' tiles when P1 empties hand", () => {
    const hands: Tile[][] = [
      [],
      [tile(3, 2), tile(1, 1)],
      [tile(4, 3)],
      [tile(6, 2), tile(0, 0)],
    ];
    const result = scoreHand(hands, false, 0);
    expect(result.winningPair).toBe(0);
    // P2: 5+2=7, P3: 7, P4: 8+0=8 → 22
    expect(result.points).toBe(22);
    expect(result.isAnnulled).toBe(false);
  });

  it("awards sum of three losers' tiles when P2 empties hand", () => {
    const hands: Tile[][] = [[tile(5, 2)], [], [tile(1, 1)], [tile(3, 0)]];
    const result = scoreHand(hands, false, 0);
    expect(result.winningPair).toBe(1);
    // P1: 7, P3: 2, P4: 3 → 12
    expect(result.points).toBe(12);
    expect(result.isAnnulled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scoreHand — blocked
// ---------------------------------------------------------------------------

describe("scoreHand — blocked", () => {
  it("lower pair sum wins and gets the losing pair's total", () => {
    // P0(10) + P2(5) = 15  vs  P1(20) + P3(33) = 53
    const hands: Tile[][] = [
      [tile(5, 5)],
      [tile(9, 9), tile(1, 1)],
      [tile(2, 3)],
      [tile(8, 8), tile(9, 8)],
    ];
    const result = scoreHand(hands, true, 0);
    expect(result.winningPair).toBe(0);
    expect(result.points).toBe(53); // losing pair total (20+33)
    expect(result.isBlocked).toBe(true);
    expect(result.isAnnulled).toBe(false);
  });

  it("annuls the hand when both pair sums are equal", () => {
    // P0(10) + P2(5) = 15  vs  P1(15) + P3(0) = 15
    const hands: Tile[][] = [[tile(5, 5)], [tile(8, 7)], [tile(2, 3)], []];
    const result = scoreHand(hands, true, 0);
    expect(result.isAnnulled).toBe(true);
    expect(result.points).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// scoreHand — annulled cascade
// ---------------------------------------------------------------------------

describe("scoreHand — annulled cascade", () => {
  it("still annuls on the 3rd consecutive annulled hand", () => {
    // Both pairs tied → annulled
    const hands: Tile[][] = [[tile(5, 5)], [tile(8, 7)], [tile(2, 3)], []];
    const result = scoreHand(hands, true, 2); // 2 previous = this is 3rd
    expect(result.isAnnulled).toBe(true);
  });

  it("forces a winner on the 4th consecutive annulled hand", () => {
    // P3 has lowest individual sum (0) → pair 1 wins
    const hands: Tile[][] = [
      [tile(5, 5)], // total 10
      [tile(8, 7)], // total 15
      [tile(2, 3)], // total 5
      [], // total 0
    ];
    const result = scoreHand(hands, true, 3); // 3 previous = this is 4th
    expect(result.isAnnulled).toBe(false);
    expect(result.winningPair).toBe(1); // P3 is in pair 1
    // Points: sum of all 4 players = 10+15+5+0 = 30
    expect(result.points).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// createScoreState
// ---------------------------------------------------------------------------

describe("createScoreState", () => {
  it("returns defaults", () => {
    const state = createScoreState();
    expect(state.scores).toEqual([0, 0]);
    expect(state.isTiebreaker).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyHandResult
// ---------------------------------------------------------------------------

describe("applyHandResult", () => {
  it("adds points to the winning pair", () => {
    const state = createScoreState();
    const result = applyHandResult(state, {
      winningPair: 0,
      points: 25,
      isBlocked: false,
      isAnnulled: false,
    });
    expect(result.scores).toEqual([25, 0]);
  });

  it("accumulates across multiple hands", () => {
    let state = createScoreState();
    state = applyHandResult(state, {
      winningPair: 0,
      points: 100,
      isBlocked: false,
      isAnnulled: false,
    });
    state = applyHandResult(state, {
      winningPair: 1,
      points: 80,
      isBlocked: false,
      isAnnulled: false,
    });
    expect(state.scores).toEqual([100, 80]);
  });

  it("does not mutate the original state", () => {
    const original = createScoreState();
    const next = applyHandResult(original, {
      winningPair: 0,
      points: 50,
      isBlocked: false,
      isAnnulled: false,
    });
    expect(original.scores).toEqual([0, 0]);
    expect(next.scores).toEqual([50, 0]);
  });
});

// ---------------------------------------------------------------------------
// checkMatchEnd
// ---------------------------------------------------------------------------

describe("checkMatchEnd", () => {
  it("returns not over when both pairs are under 200", () => {
    const state = {
      scores: [120, 90] as [number, number],
      isTiebreaker: false,
    };
    const result = checkMatchEnd(state);
    expect(result.isOver).toBe(false);
  });

  it("returns over when one pair reaches 200", () => {
    const state = {
      scores: [200, 140] as [number, number],
      isTiebreaker: false,
    };
    const result = checkMatchEnd(state);
    expect(result.isOver).toBe(true);
    expect(result.winner).toBe(0);
    expect(result.reason).toBe("reached_target");
  });

  it("returns over with higher winner when both are over 200", () => {
    const state = {
      scores: [220, 205] as [number, number],
      isTiebreaker: false,
    };
    const result = checkMatchEnd(state);
    expect(result.isOver).toBe(true);
    expect(result.winner).toBe(0);
    expect(result.reason).toBe("both_over_200");
  });

  it("returns tiebreaker when both are at exact tie 200+", () => {
    const state = {
      scores: [215, 215] as [number, number],
      isTiebreaker: false,
    };
    const result = checkMatchEnd(state);
    expect(result.isOver).toBe(false);
    expect(result.winner).toBeNull();
    expect(result.reason).toBe("tiebreaker");
  });
});
