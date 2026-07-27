import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MatchState } from "@domino/shared";
import {
  persistTerminalMatch,
  recordMatchMove,
  recordRound,
  findHandEndedEvent,
  findTerminalEvent,
  extractRoundData,
} from "./persistence";

// ---------------------------------------------------------------------------
// Mock db module
// ---------------------------------------------------------------------------

const mockInsert = vi.fn().mockResolvedValue(undefined);
const mockUpsert = vi.fn().mockResolvedValue(undefined);

vi.mock("./db", () => ({
  supabaseInsert: (...args: unknown[]) => mockInsert(...args),
  supabaseUpsert: (...args: unknown[]) => mockUpsert(...args),
}));

const CONFIG = {
  supabaseUrl: "https://test.supabase.co",
  serviceRoleKey: "test-key",
};

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeMatch(overrides?: Partial<MatchState>): MatchState {
  return {
    matchId: "match-aaa-bbb-ccc",
    status: "in_progress",
    players: [
      {
        id: "p1",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: new Date("2026-01-01T00:00:00Z"),
        blockedTileIds: [],
      },
      {
        id: "p2",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: new Date("2026-01-01T00:00:00Z"),
        blockedTileIds: [],
      },
      {
        id: "p3",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: new Date("2026-01-01T00:00:00Z"),
        blockedTileIds: [],
      },
      {
        id: "p4",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: new Date("2026-01-01T00:00:00Z"),
        blockedTileIds: [],
      },
    ],
    board: { leftEnd: 5, rightEnd: 3, tiles: [] },
    turn: {
      currentTurn: 0,
      turnDeadline: null,
      consecutiveNullRounds: 0,
      roundNumber: 2,
      lastHandWinner: null,
    },
    scores: { scores: [150, 120], isTiebreaker: false },
    pool: [],
    poolCount: 0,
    targetScore: 200,
    ...overrides,
  } as MatchState;
}

beforeEach(() => {
  mockInsert.mockClear();
  mockUpsert.mockClear();
});

// ---------------------------------------------------------------------------
// persistTerminalMatch
// ---------------------------------------------------------------------------

describe("persistTerminalMatch", () => {
  it("upserts a finished match with winner", async () => {
    const state = makeMatch({ status: "finished" });
    const event = { type: "match_ended" as const, winner: 0 };

    await persistTerminalMatch(state, event, CONFIG.supabaseUrl, CONFIG.serviceRoleKey);

    expect(mockUpsert).toHaveBeenCalledOnce();
    const [table, row, onConflict, cfg] = mockUpsert.mock.calls[0] as [
      string,
      Record<string, unknown>,
      string,
      typeof CONFIG,
    ];

    expect(table).toBe("matches");
    expect(onConflict).toBe("id");
    expect(row.id).toBe("match-aaa-bbb-ccc");
    expect(row.status).toBe("finished");
    expect(row.winner).toBe(0);
    expect(row.forfeit_by).toBeNull();
    expect(row.scores).toEqual([150, 120]);
    expect(row.round_count).toBe(3); // roundNumber 2 + 1
    expect(cfg.serviceRoleKey).toBe("test-key");
  });

  it("upserts an abandoned match with forfeit player", async () => {
    const state = makeMatch({ status: "abandoned" });
    const event = {
      type: "match_abandoned" as const,
      disconnectedPlayerId: "p2",
    };

    await persistTerminalMatch(state, event, CONFIG.supabaseUrl, CONFIG.serviceRoleKey);

    const [, row] = mockUpsert.mock.calls[0] as [string, Record<string, unknown>];
    expect(row.status).toBe("abandoned");
    expect(row.forfeit_by).toBe("p2");
    expect(row.winner).toBeNull();
  });

  it("propagates DB error to caller (caller handles via .catch)", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("network"));
    const state = makeMatch({ status: "finished" });

    await expect(
      persistTerminalMatch(
        state,
        { type: "match_ended", winner: 1 },
        CONFIG.supabaseUrl,
        CONFIG.serviceRoleKey,
      ),
    ).rejects.toThrow("network");
  });
});

// ---------------------------------------------------------------------------
// recordMatchMove
// ---------------------------------------------------------------------------

describe("recordMatchMove", () => {
  it("inserts a play move with correct fields", async () => {
    const state = makeMatch();
    const move = {
      playerId: "p1",
      isPass: false,
      tileId: "tile-001",
      tileTop: 5,
      tileBottom: 3,
      side: "left" as const,
      actionSource: "player" as const,
      moveNumber: 1,
    };

    await recordMatchMove(state, move, CONFIG.supabaseUrl, CONFIG.serviceRoleKey);

    expect(mockInsert).toHaveBeenCalledOnce();
    const [table, row] = mockInsert.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];

    expect(table).toBe("match_moves");
    expect(row.match_id).toBe("match-aaa-bbb-ccc");
    expect(row.round_number).toBe(2);
    expect(row.player_index).toBe(0); // p1 is index 0
    expect(row.is_pass).toBe(false);
    expect(row.tile_id).toBe("tile-001");
    expect(row.tile_top).toBe(5);
    expect(row.side).toBe("left");
    expect(row.action_source).toBe("player");
  });

  it("inserts a pass move with null tile fields", async () => {
    const state = makeMatch();
    const move = {
      playerId: "p3",
      isPass: true,
      actionSource: "timeout" as const,
      moveNumber: 5,
    };

    await recordMatchMove(state, move, CONFIG.supabaseUrl, CONFIG.serviceRoleKey);

    const [, row] = mockInsert.mock.calls[0] as [string, Record<string, unknown>];
    expect(row.is_pass).toBe(true);
    expect(row.tile_id).toBeNull();
    expect(row.player_index).toBe(2); // p3 is index 2
    expect(row.action_source).toBe("timeout");
  });

  it("propagates DB error to caller", async () => {
    mockInsert.mockRejectedValueOnce(new Error("network"));
    const state = makeMatch();

    await expect(
      recordMatchMove(
        state,
        { playerId: "p1", isPass: true, actionSource: "player", moveNumber: 1 },
        CONFIG.supabaseUrl,
        CONFIG.serviceRoleKey,
      ),
    ).rejects.toThrow("network");
  });
});

// ---------------------------------------------------------------------------
// recordRound
// ---------------------------------------------------------------------------

describe("recordRound", () => {
  it("inserts a round with correct fields", async () => {
    const state = makeMatch();
    const roundData = {
      winningPair: 0,
      points: 45,
      isBlocked: false,
      isAnnulled: false,
      reason: "empty_hand" as const,
      handScores: [45, 0] as [number, number],
      scoresAfter: [195, 120] as [number, number],
    };

    await recordRound(state, roundData, CONFIG.supabaseUrl, CONFIG.serviceRoleKey);

    expect(mockInsert).toHaveBeenCalledOnce();
    const [table, row] = mockInsert.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];

    expect(table).toBe("match_rounds");
    expect(row.match_id).toBe("match-aaa-bbb-ccc");
    expect(row.round_number).toBe(2);
    expect(row.winning_pair).toBe(0);
    expect(row.points).toBe(45);
    expect(row.reason).toBe("empty_hand");
    expect(row.hand_scores).toEqual([45, 0]);
    expect(row.scores_after).toEqual([195, 120]);
  });

  it("propagates DB error to caller", async () => {
    mockInsert.mockRejectedValueOnce(new Error("network"));
    const state = makeMatch();

    await expect(
      recordRound(
        state,
        {
          winningPair: null,
          points: 0,
          isBlocked: true,
          isAnnulled: false,
          reason: "blocked",
          handScores: [0, 0],
          scoresAfter: [150, 120],
        },
        CONFIG.supabaseUrl,
        CONFIG.serviceRoleKey,
      ),
    ).rejects.toThrow("network");
  });
});

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

describe("findHandEndedEvent", () => {
  it("returns the hand_ended event", () => {
    const events = [
      { type: "play_tile" },
      { type: "hand_ended" },
      { type: "round_started" },
    ];
    expect(findHandEndedEvent(events)).toEqual({ type: "hand_ended" });
  });

  it("returns null when no hand_ended", () => {
    const events = [{ type: "play_tile" }, { type: "round_started" }];
    expect(findHandEndedEvent(events)).toBeNull();
  });
});

describe("findTerminalEvent", () => {
  it("returns match_ended event", () => {
    const events = [{ type: "match_ended", winner: 1 }];
    expect(findTerminalEvent(events)).toEqual({ type: "match_ended", winner: 1 });
  });

  it("returns match_abandoned event", () => {
    const events = [{ type: "match_abandoned", disconnectedPlayerId: "p2" }];
    expect(findTerminalEvent(events)).toEqual({
      type: "match_abandoned",
      disconnectedPlayerId: "p2",
    });
  });

  it("returns null when no terminal event", () => {
    const events = [{ type: "play_tile" }];
    expect(findTerminalEvent(events)).toBeNull();
  });
});

describe("extractRoundData", () => {
  it("extracts round data from hand_ended event", () => {
    const state = makeMatch();
    const event = {
      type: "hand_ended",
      winningPair: 1,
      points: 30,
      isBlocked: false,
      isAnnulled: false,
      reason: "empty_hand",
      handScores: [0, 30],
    };

    const result = extractRoundData(state, event);
    expect(result).toEqual({
      winningPair: 1,
      points: 30,
      isBlocked: false,
      isAnnulled: false,
      reason: "empty_hand",
      handScores: [0, 30],
      scoresAfter: [150, 120],
    });
  });

  it("returns null when no event", () => {
    const state = makeMatch();
    expect(extractRoundData(state, null)).toBeNull();
  });
});
