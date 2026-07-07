import { describe, expect, it } from "bun:test";
import {
  advanceTurn,
  calculateDeadline,
  checkTurnTimeout,
  createTurnState,
  getFirstPlayer,
  getNextPlayer,
  incrementNullRounds,
  isNewRound,
  PLAYER_COUNT,
  resetNullRounds,
  setCurrentTurn,
  TURN_TIMEOUT_MS,
} from "@domino/shared/src/game";
import type { Tile } from "../types";

// Helper to create a Tile with a given id
function tile(top: number, bottom: number, id = `t-${top}-${bottom}`): Tile {
  return { top, bottom, id };
}

describe("constants", () => {
  it("TURN_TIMEOUT_MS is 45_000", () => {
    expect(TURN_TIMEOUT_MS).toBe(45_000);
  });

  it("PLAYER_COUNT is 4", () => {
    expect(PLAYER_COUNT).toBe(4);
  });
});

describe("createTurnState", () => {
  it("returns default state with currentTurn 0", () => {
    const state = createTurnState();
    expect(state.currentTurn).toBe(0);
  });

  it("returns default state with turnDeadline null", () => {
    const state = createTurnState();
    expect(state.turnDeadline).toBeNull();
  });

  it("returns default state with consecutiveNullRounds 0", () => {
    const state = createTurnState();
    expect(state.consecutiveNullRounds).toBe(0);
  });

  it("returns default state with roundNumber 0", () => {
    const state = createTurnState();
    expect(state.roundNumber).toBe(0);
  });

  it("returns default state with lastHandWinner null", () => {
    const state = createTurnState();
    expect(state.lastHandWinner).toBeNull();
  });
});

describe("advanceTurn", () => {
  it("cycles 0 to 1", () => {
    const state = createTurnState();
    const next = advanceTurn(state);
    expect(next.currentTurn).toBe(1);
  });

  it("cycles 1 to 2", () => {
    const state = createTurnState();
    const s1 = advanceTurn(state);
    const s2 = advanceTurn(s1);
    expect(s2.currentTurn).toBe(2);
  });

  it("cycles 2 to 3", () => {
    const state = createTurnState();
    let s = state;
    for (let i = 0; i < 2; i++) s = advanceTurn(s);
    const s3 = advanceTurn(s);
    expect(s3.currentTurn).toBe(3);
  });

  it("cycles 3 back to 0", () => {
    const state = createTurnState();
    let s = state;
    for (let i = 0; i < 3; i++) s = advanceTurn(s);
    const s4 = advanceTurn(s);
    expect(s4.currentTurn).toBe(0);
  });

  it("does not mutate original state", () => {
    const state = createTurnState();
    const original = { ...state };
    advanceTurn(state);
    expect(state.currentTurn).toBe(original.currentTurn);
    expect(state.turnDeadline).toBe(original.turnDeadline);
  });
});

describe("setCurrentTurn", () => {
  it("sets a valid player index", () => {
    const state = createTurnState();
    const next = setCurrentTurn(state, 2);
    expect(next.currentTurn).toBe(2);
  });

  it("throws for index < 0", () => {
    const state = createTurnState();
    expect(() => setCurrentTurn(state, -1)).toThrow("Invalid playerIndex: -1");
  });

  it("throws for index > 3", () => {
    const state = createTurnState();
    expect(() => setCurrentTurn(state, 4)).toThrow("Invalid playerIndex: 4");
  });

  it("sets index 0 (boundary)", () => {
    const state = createTurnState();
    const next = setCurrentTurn(state, 0);
    expect(next.currentTurn).toBe(0);
  });

  it("sets index 3 (boundary)", () => {
    const state = createTurnState();
    const next = setCurrentTurn(state, 3);
    expect(next.currentTurn).toBe(3);
  });
});

describe("getNextPlayer", () => {
  it("returns next index after current", () => {
    const state = createTurnState();
    expect(getNextPlayer(state)).toBe(1);
  });

  it("returns next index from non-zero", () => {
    const state = createTurnState();
    const s2 = setCurrentTurn(state, 2);
    expect(getNextPlayer(s2)).toBe(3);
  });

  it("wraps from 3 to 0", () => {
    const state = createTurnState();
    const s3 = setCurrentTurn(state, 3);
    expect(getNextPlayer(s3)).toBe(0);
  });

  it("does not mutate the state", () => {
    const state = createTurnState();
    getNextPlayer(state);
    expect(state.currentTurn).toBe(0);
  });
});

describe("calculateDeadline", () => {
  it("sets deadline to now + TURN_TIMEOUT_MS", () => {
    const state = createTurnState();
    const now = 1_000_000;
    const next = calculateDeadline(state, now);
    expect(next.turnDeadline).toBe(now + TURN_TIMEOUT_MS);
  });

  it("uses Date.now() when now is not provided", () => {
    const state = createTurnState();
    const before = Date.now();
    const next = calculateDeadline(state);
    const after = Date.now();
    expect(next.turnDeadline).toBeGreaterThanOrEqual(before + TURN_TIMEOUT_MS);
    expect(next.turnDeadline).toBeLessThanOrEqual(after + TURN_TIMEOUT_MS);
  });

  it("overwrites an existing deadline", () => {
    const state = calculateDeadline(createTurnState(), 1_000_000);
    const next = calculateDeadline(state, 2_000_000);
    expect(next.turnDeadline).toBe(2_000_000 + TURN_TIMEOUT_MS);
  });
});

describe("checkTurnTimeout", () => {
  it("returns timedOut false when turnDeadline is null", () => {
    const state = createTurnState();
    const result = checkTurnTimeout(state, Date.now());
    expect(result.timedOut).toBe(false);
    expect(result.playerIndex).toBe(0);
  });

  it("returns timedOut false before deadline", () => {
    const state = calculateDeadline(createTurnState(), 1_000_000);
    const result = checkTurnTimeout(state, 1_000_000 + 30_000); // 30s before deadline
    expect(result.timedOut).toBe(false);
    expect(result.playerIndex).toBe(0);
  });

  it("returns timedOut true after deadline", () => {
    const state = calculateDeadline(createTurnState(), 1_000_000);
    const result = checkTurnTimeout(state, 1_000_000 + 46_000); // 1s after deadline
    expect(result.timedOut).toBe(true);
    expect(result.playerIndex).toBe(0);
  });

  it("returns timedOut true exactly at deadline", () => {
    const state = calculateDeadline(createTurnState(), 1_000_000);
    const result = checkTurnTimeout(state, 1_000_000 + TURN_TIMEOUT_MS);
    expect(result.timedOut).toBe(true);
    expect(result.playerIndex).toBe(0);
  });

  it("returns correct playerIndex for non-zero turn", () => {
    const state = setCurrentTurn(createTurnState(), 3);
    const withDeadline = calculateDeadline(state, 1_000_000);
    const result = checkTurnTimeout(withDeadline, 1_000_000 + 46_000);
    expect(result.timedOut).toBe(true);
    expect(result.playerIndex).toBe(3);
  });
});

describe("incrementNullRounds", () => {
  it("increments from 0 to 1", () => {
    const state = createTurnState();
    const next = incrementNullRounds(state);
    expect(next.consecutiveNullRounds).toBe(1);
  });

  it("increments from 1 to 2", () => {
    const state = incrementNullRounds(createTurnState());
    const next = incrementNullRounds(state);
    expect(next.consecutiveNullRounds).toBe(2);
  });

  it("does not mutate original state", () => {
    const state = createTurnState();
    incrementNullRounds(state);
    expect(state.consecutiveNullRounds).toBe(0);
  });
});

describe("resetNullRounds", () => {
  it("resets from 3 to 0", () => {
    let state = createTurnState();
    for (let i = 0; i < 3; i++) state = incrementNullRounds(state);
    const next = resetNullRounds(state);
    expect(next.consecutiveNullRounds).toBe(0);
  });

  it("does not mutate original state", () => {
    let state = createTurnState();
    for (let i = 0; i < 3; i++) state = incrementNullRounds(state);
    resetNullRounds(state);
    expect(state.consecutiveNullRounds).toBe(3);
  });
});

describe("getFirstPlayer", () => {
  it("selects player with highest double (double-9)", () => {
    const hands: Tile[][] = [
      [tile(5, 5)],
      [tile(3, 3)],
      [tile(9, 9)],
      [tile(1, 1)],
    ];
    expect(getFirstPlayer(hands)).toBe(2);
  });

  it("selects highest sum when no doubles", () => {
    const hands: Tile[][] = [
      [tile(1, 2)], // sum 3
      [tile(8, 9)], // sum 17
      [tile(4, 5)], // sum 9
      [tile(6, 7)], // sum 13
    ];
    expect(getFirstPlayer(hands)).toBe(1);
  });

  it("returns lastHandWinner when provided", () => {
    const hands: Tile[][] = [
      [tile(9, 9)],
      [tile(1, 1)],
      [tile(0, 0)],
      [tile(2, 2)],
    ];
    expect(getFirstPlayer(hands, 1)).toBe(1);
  });

  it("returns lastHandWinner even when hands would suggest different", () => {
    const hands: Tile[][] = [
      [tile(9, 9)],
      [tile(0, 0)],
      [tile(0, 0)],
      [tile(0, 0)],
    ];
    expect(getFirstPlayer(hands, 3)).toBe(3);
  });

  it("sum tie: lower index wins", () => {
    const hands: Tile[][] = [
      [tile(5, 5)], // sum 10
      [tile(3, 7)], // sum 10
      [tile(2, 8)], // sum 10
      [tile(4, 6)], // sum 10
    ];
    expect(getFirstPlayer(hands)).toBe(0);
  });

  it("handles empty hands gracefully", () => {
    const hands: Tile[][] = [[], [], [], []];
    // No doubles, all sums are 0 → first player (index 0) wins tie
    expect(getFirstPlayer(hands)).toBe(0);
  });

  it("selects higher double over lower double", () => {
    const hands: Tile[][] = [
      [tile(4, 4)], // double-4, sum 8
      [tile(7, 7)], // double-7, sum 14
      [tile(2, 2)], // double-2, sum 4
      [tile(1, 1)], // double-1, sum 2
    ];
    expect(getFirstPlayer(hands)).toBe(1);
  });
});

describe("isNewRound", () => {
  it("returns true for fresh state", () => {
    const state = createTurnState();
    expect(isNewRound(state)).toBe(true);
  });

  it("returns false after turn advancement", () => {
    const state = advanceTurn(createTurnState());
    expect(isNewRound(state)).toBe(false);
  });

  it("returns false after deadline is set", () => {
    const state = calculateDeadline(createTurnState());
    expect(isNewRound(state)).toBe(false);
  });
});

describe("immutability", () => {
  it("advanceTurn does not mutate original", () => {
    const state = createTurnState();
    const snapshot = { ...state };
    advanceTurn(state);
    expect(state).toEqual(snapshot);
  });

  it("setCurrentTurn does not mutate original", () => {
    const state = createTurnState();
    const snapshot = { ...state };
    setCurrentTurn(state, 2);
    expect(state).toEqual(snapshot);
  });

  it("calculateDeadline does not mutate original", () => {
    const state = createTurnState();
    const snapshot = { ...state };
    calculateDeadline(state, 1_000_000);
    expect(state).toEqual(snapshot);
  });

  it("incrementNullRounds does not mutate original", () => {
    const state = createTurnState();
    const snapshot = { ...state };
    incrementNullRounds(state);
    expect(state).toEqual(snapshot);
  });

  it("resetNullRounds does not mutate original", () => {
    const state = incrementNullRounds(createTurnState());
    const snapshot = { ...state };
    resetNullRounds(state);
    expect(state).toEqual(snapshot);
  });
});
