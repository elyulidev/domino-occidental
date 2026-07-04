import { describe, expect, it } from "bun:test";
import type { Tile } from "../../types";
import { sanitizeState } from "../../handler";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTile(top: number, bottom: number, id: string): Tile {
  return { top, bottom, id };
}

function makeMatch(overrides?: Record<string, unknown>) {
  const now = new Date();
  const basePlayer = {
    id: "p0",
    hand: [makeTile(3, 4, "t1"), makeTile(5, 6, "t2")],
    consecutivePasses: 0,
    isConnected: true,
    lastActionAt: now,
  };
  return {
    matchId: "test-match",
    players: [
      { ...basePlayer, id: "p0" },
      { ...basePlayer, id: "p1", hand: [makeTile(1, 2, "t3")] },
      { ...basePlayer, id: "p2", hand: [] },
      { ...basePlayer, id: "p3", hand: [makeTile(7, 8, "t4"), makeTile(9, 9, "t5"), makeTile(0, 1, "t6")] },
    ],
    board: { leftEnd: null, rightEnd: null, tiles: [] },
    turn: {
      currentTurn: 0,
      turnDeadline: 1700000000000,
      consecutiveNullRounds: 2,
      roundNumber: 5,
      lastHandWinner: 1,
    },
    scores: { scores: [50, 30], isTiebreaker: false },
    pool: [makeTile(0, 0, "t7")],
    poolCount: 1,
    status: "in_progress",
    targetScore: 200,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — SanitizedMatchState turn fields
// ---------------------------------------------------------------------------

describe("sanitizeState — turn-related fields", () => {
  it("includes turnDeadline from match.turn.turnDeadline", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: 1700000000000,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const sanitized = sanitizeState(match as any);
    expect(sanitized.turnDeadline).toBe(1700000000000);
  });

  it("includes turnDeadline as null when server has no deadline", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const sanitized = sanitizeState(match as any);
    expect(sanitized.turnDeadline).toBeNull();
  });

  it("includes consecutiveNullRounds from match.turn", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 3,
        roundNumber: 10,
        lastHandWinner: null,
      },
    });
    const sanitized = sanitizeState(match as any);
    expect(sanitized.consecutiveNullRounds).toBe(3);
  });

  it("includes consecutiveNullRounds as 0 when no null rounds", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const sanitized = sanitizeState(match as any);
    expect(sanitized.consecutiveNullRounds).toBe(0);
  });

  it("includes lastHandWinner from match.turn", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 5,
        lastHandWinner: 2,
      },
    });
    const sanitized = sanitizeState(match as any);
    expect(sanitized.lastHandWinner).toBe(2);
  });

  it("includes lastHandWinner as null for first hand", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const sanitized = sanitizeState(match as any);
    expect(sanitized.lastHandWinner).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — SanitizedMatchState backward compatibility
// ---------------------------------------------------------------------------

describe("sanitizeState — backward compatibility", () => {
  it("still includes all existing fields", () => {
    const match = makeMatch();
    const sanitized = sanitizeState(match as any);

    expect(sanitized.matchId).toBe("test-match");
    expect(sanitized.players).toHaveLength(4);
    expect(sanitized.board).toBeDefined();
    expect(sanitized.currentTurn).toBe(0);
    expect(sanitized.scores).toEqual([50, 30]);
    expect(sanitized.roundNumber).toBe(5);
    expect(sanitized.poolCount).toBe(1);
    expect(sanitized.status).toBe("in_progress");
    expect(sanitized.targetScore).toBe(200);
  });

  it("player handSize still computed correctly", () => {
    const match = makeMatch();
    const sanitized = sanitizeState(match as any);

    expect(sanitized.players[0].handSize).toBe(2);
    expect(sanitized.players[1].handSize).toBe(1);
    expect(sanitized.players[2].handSize).toBe(0);
    expect(sanitized.players[3].handSize).toBe(3);
  });
});
