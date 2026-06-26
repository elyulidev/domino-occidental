import { beforeEach, describe, expect, it } from "bun:test";
import {
  cleanup,
  createGame,
  getActiveCount,
  getAllActive,
  getGame,
  hasGame,
  removeGame,
  resetStore,
  updateGame,
} from "../store";
import type { MatchState, PlayerState } from "../types";

function makeMatch(overrides?: Partial<MatchState>): MatchState {
  const now = new Date();
  const basePlayer: PlayerState = {
    id: "p0",
    hand: [],
    consecutivePasses: 0,
    isConnected: true,
    lastActionAt: now,
  };
  return {
    matchId: "test-match",
    players: [
      { ...basePlayer, id: "p0" },
      { ...basePlayer, id: "p1" },
      { ...basePlayer, id: "p2" },
      { ...basePlayer, id: "p3" },
    ],
    board: { leftEnd: null, rightEnd: null, tiles: [] },
    turn: {
      currentTurn: 0 as const,
      turnDeadline: null,
      consecutiveNullRounds: 0,
      roundNumber: 0,
      lastHandWinner: null,
    },
    scores: { scores: [0, 0] as [number, number], isTiebreaker: false },
    pool: [],
    poolCount: 0,
    status: "in_progress",
    targetScore: 200,
    ...overrides,
  };
}

describe("createGame + getGame", () => {
  beforeEach(() => resetStore());

  it("stores a match and getGame retrieves it", () => {
    const match = makeMatch();
    createGame("m1", match);
    expect(getGame("m1")).toBe(match);
  });

  it("duplicate matchId overwrites previous state", () => {
    const first = makeMatch({ matchId: "m1", status: "in_progress" });
    const second = makeMatch({ matchId: "m1", status: "finished" });
    createGame("m1", first);
    createGame("m1", second);
    expect(getGame("m1")?.status).toBe("finished");
  });

  it("getGame returns null for missing matchId", () => {
    expect(getGame("nonexistent")).toBeNull();
  });
});

describe("updateGame + removeGame", () => {
  beforeEach(() => resetStore());

  it("updateGame replaces state for existing match", () => {
    createGame("m1", makeMatch());
    const updated = makeMatch({ matchId: "m1", status: "finished" });
    updateGame("m1", updated);
    expect(getGame("m1")?.status).toBe("finished");
  });

  it("updateGame on missing matchId is no-op", () => {
    const state = makeMatch({ matchId: "m1" });
    updateGame("m1", state);
    expect(getGame("m1")).toBeNull();
    expect(hasGame("m1")).toBe(false);
  });

  it("removeGame returns true and removes existing match", () => {
    createGame("m1", makeMatch());
    const removed = removeGame("m1");
    expect(removed).toBe(true);
    expect(hasGame("m1")).toBe(false);
  });

  it("removeGame returns false for missing matchId", () => {
    expect(removeGame("nonexistent")).toBe(false);
  });
});

describe("hasGame + getActiveCount", () => {
  beforeEach(() => resetStore());

  it("hasGame returns true for stored match", () => {
    createGame("m1", makeMatch());
    expect(hasGame("m1")).toBe(true);
  });

  it("hasGame returns false for unknown matchId", () => {
    expect(hasGame("unknown")).toBe(false);
  });

  it("getActiveCount starts at 0", () => {
    expect(getActiveCount()).toBe(0);
  });

  it("getActiveCount increments after createGame", () => {
    createGame("m1", makeMatch());
    createGame("m2", makeMatch({ matchId: "m2" }));
    expect(getActiveCount()).toBe(2);
  });

  it("getActiveCount decrements after removeGame", () => {
    createGame("m1", makeMatch());
    createGame("m2", makeMatch({ matchId: "m2" }));
    removeGame("m1");
    expect(getActiveCount()).toBe(1);
  });
});

describe("cleanup", () => {
  beforeEach(() => resetStore());

  it("removes stale matches (all players idle > maxAgeMs)", () => {
    const oldDate = new Date(Date.now() - 200_000);
    const stale = makeMatch({
      matchId: "m1",
      players: [
        {
          id: "p0",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p1",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p2",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p3",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
      ],
    });
    createGame("m1", stale);
    const removed = cleanup(100_000);
    expect(removed).toBe(1);
    expect(hasGame("m1")).toBe(false);
  });

  it("keeps recent matches (at least one player active within window)", () => {
    const oldDate = new Date(Date.now() - 200_000);
    const recentDate = new Date(Date.now() - 50_000);
    const mixed = makeMatch({
      matchId: "m1",
      players: [
        {
          id: "p0",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p1",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: recentDate,
        },
        {
          id: "p2",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p3",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
      ],
    });
    createGame("m1", mixed);
    const removed = cleanup(100_000);
    expect(removed).toBe(0);
    expect(hasGame("m1")).toBe(true);
  });

  it("returns correct count of removed entries", () => {
    const oldDate = new Date(Date.now() - 300_000);
    const stale1 = makeMatch({
      matchId: "m1",
      players: [
        {
          id: "p0",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p1",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p2",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p3",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
      ],
    });
    const stale2 = makeMatch({
      matchId: "m2",
      players: [
        {
          id: "p0",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p1",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p2",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p3",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
      ],
    });
    createGame("m1", stale1);
    createGame("m2", stale2);
    const removed = cleanup(100_000);
    expect(removed).toBe(2);
  });

  it("empty store returns 0", () => {
    expect(cleanup(100_000)).toBe(0);
  });

  it("mix of stale and recent — only stale removed", () => {
    const oldDate = new Date(Date.now() - 300_000);
    const recentDate = new Date();
    const stale = makeMatch({
      matchId: "m1",
      players: [
        {
          id: "p0",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p1",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p2",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
        {
          id: "p3",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: oldDate,
        },
      ],
    });
    const fresh = makeMatch({
      matchId: "m2",
      players: [
        {
          id: "p0",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: recentDate,
        },
        {
          id: "p1",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: recentDate,
        },
        {
          id: "p2",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: recentDate,
        },
        {
          id: "p3",
          hand: [],
          consecutivePasses: 0,
          isConnected: true,
          lastActionAt: recentDate,
        },
      ],
    });
    createGame("m1", stale);
    createGame("m2", fresh);
    const removed = cleanup(100_000);
    expect(removed).toBe(1);
    expect(hasGame("m1")).toBe(false);
    expect(hasGame("m2")).toBe(true);
  });
});

describe("getAllActive", () => {
  beforeEach(() => resetStore());

  it("non-empty store returns entries", () => {
    const m = makeMatch();
    createGame("m1", m);
    const all = getAllActive();
    expect(all.length).toBe(1);
    expect(all[0][0]).toBe("m1");
    expect(all[0][1]).toBe(m);
  });

  it("empty store returns []", () => {
    expect(getAllActive()).toEqual([]);
  });

  it("entries match what was stored", () => {
    const m1 = makeMatch({ matchId: "m1" });
    const m2 = makeMatch({ matchId: "m2" });
    createGame("m1", m1);
    createGame("m2", m2);
    const all = getAllActive();
    expect(all.length).toBe(2);
    expect(all.map((e) => e[0]).sort()).toEqual(["m1", "m2"]);
  });
});
