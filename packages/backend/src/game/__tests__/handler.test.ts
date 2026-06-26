import { describe, expect, it, vi } from "bun:test";
import type { MatchState, PlayerState } from "@domino/shared";
import { sanitizeState } from "@domino/shared";
import { handleMessage } from "../handler";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

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
      { ...basePlayer, id: "p0", hand: [{ id: "t1", top: 3, bottom: 4 }] },
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

function makeStore(match: MatchState | null = null) {
  let state = match;
  return {
    getGame: vi.fn((id: string) => (id === "test-match" ? state : null)),
    updateGame: vi.fn((_id: string, s: MatchState) => {
      state = s;
    }),
  };
}

// ---------------------------------------------------------------------------
// sanitizeState
// ---------------------------------------------------------------------------

describe("sanitizeState", () => {
  it("strips hand arrays and exposes handSize per player", () => {
    const match = makeMatch();
    const sanitized = sanitizeState(match);

    expect(sanitized.players[0].handSize).toBe(1);
    expect(sanitized.players[1].handSize).toBe(0);
    expect(sanitized.players[2].handSize).toBe(0);
    expect(sanitized.players[3].handSize).toBe(0);

    // hand arrays must not be present
    expect("hand" in sanitized.players[0]).toBe(false);
  });

  it("includes poolCount from pool length", () => {
    const match = makeMatch({
      pool: [{ id: "x", top: 0, bottom: 1 }],
      poolCount: 1,
    });
    const sanitized = sanitizeState(match);
    expect(sanitized.poolCount).toBe(1);
  });

  it("exposes board, scores, currentTurn, status, targetScore", () => {
    const match = makeMatch();
    const sanitized = sanitizeState(match);

    expect(sanitized.board).toEqual(match.board);
    expect(sanitized.scores).toEqual([0, 0]);
    expect(sanitized.currentTurn).toBe(0);
    expect(sanitized.status).toBe("in_progress");
    expect(sanitized.targetScore).toBe(200);
    expect(sanitized.roundNumber).toBe(0);
  });

  it("does not expose internal fields like pool array or consecutivePasses", () => {
    const match = makeMatch();
    const sanitized = sanitizeState(match);

    expect("pool" in sanitized).toBe(false);
    expect("consecutivePasses" in sanitized.players[0]).toBe(false);
    expect("lastActionAt" in sanitized.players[0]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleMessage
// ---------------------------------------------------------------------------

describe("handleMessage", () => {
  // ---- Scenario 1: play_tile routes to playTile ----
  it("play_tile routes to playTile and emits tile_played", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const store = makeStore(match);

    const result = handleMessage(store, "test-match", "p0", {
      type: "play_tile",
      tileId: "t1",
      side: "left",
    });

    expect(store.updateGame).toHaveBeenCalled();
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    const tileEvent = result.events.find((e) => e.type === "tile_played");
    expect(tileEvent).toBeDefined();
    if (tileEvent?.type === "tile_played") {
      expect(tileEvent.playerId).toBe("p0");
      expect(tileEvent.tileId).toBe("t1");
      expect(tileEvent.side).toBe("left");
    }
  });

  // ---- Scenario 2: pass routes to passTurn ----
  it("pass routes to passTurn and emits player_passed", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const store = makeStore(match);

    const result = handleMessage(store, "test-match", "p0", { type: "pass" });

    expect(store.updateGame).toHaveBeenCalled();
    expect(result.events.length).toBeGreaterThanOrEqual(1);
    const passEvent = result.events.find((e) => e.type === "player_passed");
    expect(passEvent).toBeDefined();
    if (passEvent?.type === "player_passed") {
      expect(passEvent.playerId).toBe("p0");
    }
  });

  // ---- Scenario 3: leave routes to forfeitMatch ----
  it("leave routes to forfeitMatch and emits match_abandoned", () => {
    const match = makeMatch();
    const store = makeStore(match);

    const result = handleMessage(store, "test-match", "p0", { type: "leave" });

    expect(store.updateGame).toHaveBeenCalled();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("match_abandoned");
    if (result.events[0].type === "match_abandoned") {
      expect(result.events[0].disconnectedPlayerId).toBe("p0");
      expect(result.events[0].reason).toBe("forfeit");
    }
  });

  // ---- Scenario 4: Unknown matchId ----
  it("returns MATCH_NOT_FOUND for unknown matchId", () => {
    const store = makeStore(null);

    const result = handleMessage(store, "nonexistent", "p0", {
      type: "pass",
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("MATCH_NOT_FOUND");
    }
    expect(store.updateGame).not.toHaveBeenCalled();
  });

  // ---- Scenario 5: Unknown message type ----
  it("returns INVALID_MESSAGE for unknown message type", () => {
    const match = makeMatch();
    const store = makeStore(match);

    const result = handleMessage(
      store,
      "test-match",
      "p0",
      // @ts-expect-error — testing unknown message type
      { type: "alien" },
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("INVALID_MESSAGE");
    }
    expect(result.sanitizedState).toBeDefined();
    expect(store.updateGame).not.toHaveBeenCalled();
  });

  // ---- Scenario 6: Engine game_error passed through (NOT_YOUR_TURN) ----
  it("passes through NOT_YOUR_TURN when wrong player sends play_tile", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const store = makeStore(match);

    // p1 tries to play on p0's turn
    const result = handleMessage(store, "test-match", "p1", {
      type: "play_tile",
      tileId: "t1",
      side: "left",
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("NOT_YOUR_TURN");
    }
    // State should not have been updated on error
    expect(store.updateGame).not.toHaveBeenCalled();
  });

  // ---- Scenario 7: Sanitization in handler response ----
  it("returns sanitizedState after a successful play_tile", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const store = makeStore(match);

    const result = handleMessage(store, "test-match", "p0", {
      type: "play_tile",
      tileId: "t1",
      side: "left",
    });

    expect(result.sanitizedState).toBeDefined();
    expect(result.sanitizedState?.matchId).toBe("test-match");
    // Pool array should be stripped
    expect(result.sanitizedState).not.toHaveProperty("pool");
    // Hand should be represented as handSize
    expect(result.sanitizedState?.players[0].handSize).toBe(0); // tile was played
  });

  // ---- Triangulation: pass with not-your-turn ----
  it("passes through NOT_YOUR_TURN when wrong player sends pass", () => {
    const match = makeMatch({
      turn: {
        currentTurn: 0,
        turnDeadline: null,
        consecutiveNullRounds: 0,
        roundNumber: 0,
        lastHandWinner: null,
      },
    });
    const store = makeStore(match);

    const result = handleMessage(store, "test-match", "p1", {
      type: "pass",
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("game_error");
    if (result.events[0].type === "game_error") {
      expect(result.events[0].code).toBe("NOT_YOUR_TURN");
    }
    expect(store.updateGame).not.toHaveBeenCalled();
  });

  // ---- Triangulation: leave on already-finished match ----
  it("leave on already-finished match returns no-op (no events, no update)", () => {
    const match = makeMatch({ status: "finished" });
    const store = makeStore(match);

    const result = handleMessage(store, "test-match", "p0", { type: "leave" });

    // forfeitMatch returns empty events when match is already over
    expect(result.events).toHaveLength(0);
    expect(store.updateGame).not.toHaveBeenCalled();
  });
});
