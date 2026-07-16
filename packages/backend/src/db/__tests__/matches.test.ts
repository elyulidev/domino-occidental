import { beforeEach, describe, expect, it, vi } from "bun:test";

// Mock the client module — sibling path
vi.mock("../client", () => ({
  getDb: vi.fn(),
}));

// Must import AFTER vi.mock so the mock is wired
import type { GameEvent, MatchState } from "@domino/shared";
import { getDb } from "../client";
import { extractTerminalData, persistMatch } from "../matches";

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MockDb {
  insert: ReturnType<typeof vi.fn>;
  _mockValues: ReturnType<typeof vi.fn>;
  _mockInsert: ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMatchState(overrides?: Partial<MatchState>): MatchState {
  return {
    matchId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    players: [
      { id: "p1-uuid-0001", hand: [], consecutivePasses: 0, isConnected: true, lastActionAt: new Date(), blockedTileIds: [] },
      { id: "p2-uuid-0002", hand: [], consecutivePasses: 0, isConnected: true, lastActionAt: new Date(), blockedTileIds: [] },
      { id: "p3-uuid-0003", hand: [], consecutivePasses: 0, isConnected: true, lastActionAt: new Date(), blockedTileIds: [] },
      { id: "p4-uuid-0004", hand: [], consecutivePasses: 0, isConnected: true, lastActionAt: new Date(), blockedTileIds: [] },
    ],
    board: { leftEnd: null, rightEnd: null, tiles: [] },
    turn: { currentTurn: 0, turnDeadline: null, consecutiveNullRounds: 0, roundNumber: 5, lastHandWinner: null },
    scores: { scores: [210, 180], isTiebreaker: false },
    pool: [],
    poolCount: 0,
    status: "finished",
    targetScore: 200,
    ...overrides,
  };
}

function makeMockDb(insertError?: unknown): MockDb {
  const mockValues = vi.fn().mockReturnValue(
    insertError !== undefined
      ? Promise.reject(insertError)
      : Promise.resolve(),
  );
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  return { insert: mockInsert, _mockValues: mockValues, _mockInsert: mockInsert };
}

// ---------------------------------------------------------------------------
// Tests: extractTerminalData
// ---------------------------------------------------------------------------

describe("extractTerminalData", () => {
  it("extracts winner from match_ended event", () => {
    const state = makeMatchState();
    const events: GameEvent[] = [
      {
        type: "match_ended",
        winner: 0,
        finalScores: [210, 180],
        reason: "reached_target",
      },
    ];
    const record = extractTerminalData(state, events);
    expect(record).not.toBeNull();
    expect(record?.status).toBe("finished");
    expect(record?.winner).toBe(0);
    expect(record?.forfeitBy).toBeNull();
  });

  it("extracts forfeit_by from match_abandoned event", () => {
    const state = makeMatchState({ status: "abandoned" });
    const events: GameEvent[] = [
      {
        type: "match_abandoned",
        disconnectedPlayerId: "p2-uuid-0002",
        reason: "abandonment",
      },
    ];
    const record = extractTerminalData(state, events);
    expect(record).not.toBeNull();
    expect(record?.status).toBe("abandoned");
    expect(record?.forfeitBy).toBe("p2-uuid-0002");
    expect(record?.winner).toBeNull();
  });

  it("returns null when no terminal event found", () => {
    const state = makeMatchState({ status: "in_progress" });
    const events: GameEvent[] = [
      { type: "tile_played", playerId: "p1", tileId: "t1", side: "left", board: { leftEnd: null, rightEnd: null, tiles: [] } },
    ];
    const record = extractTerminalData(state, events);
    expect(record).toBeNull();
  });

  it("returns null when events array is empty", () => {
    const state = makeMatchState();
    const record = extractTerminalData(state, []);
    expect(record).toBeNull();
  });

  it("maps playerIds correctly from state", () => {
    const state = makeMatchState();
    const events: GameEvent[] = [
      { type: "match_ended", winner: 1, finalScores: [150, 220], reason: "reached_target" },
    ];
    const record = extractTerminalData(state, events);
    expect(record?.playerIds).toEqual(["p1-uuid-0001", "p2-uuid-0002", "p3-uuid-0003", "p4-uuid-0004"]);
  });

  it("maps scores correctly from state", () => {
    const state = makeMatchState({
      scores: { scores: [100, 200], isTiebreaker: false },
    });
    const events: GameEvent[] = [
      { type: "match_ended", winner: 1, finalScores: [100, 200], reason: "reached_target" },
    ];
    const record = extractTerminalData(state, events);
    expect(record?.scores).toEqual([100, 200]);
  });

  it("maps roundCount as roundNumber + 1 (1-indexed)", () => {
    const state = makeMatchState();
    state.turn.roundNumber = 7;
    const events: GameEvent[] = [
      { type: "match_ended", winner: 0, finalScores: [210, 180], reason: "reached_target" },
    ];
    const record = extractTerminalData(state, events);
    expect(record?.roundCount).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Tests: persistMatch
// ---------------------------------------------------------------------------

describe("persistMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls db.insert().values() with correct field mapping when DB is available", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    const state = makeMatchState();
    const events: GameEvent[] = [
      { type: "match_ended", winner: 0, finalScores: [210, 180], reason: "reached_target" },
    ];

    await persistMatch(state, events);

    expect(mockDb._mockInsert).toHaveBeenCalledTimes(1);
    expect(mockDb._mockValues).toHaveBeenCalledTimes(1);

    const fields = mockDb._mockValues.mock.calls[0][0];
    expect(fields.id).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(fields.status).toBe("finished");
    expect(fields.winner).toBe(0);
    // forfeitBy is undefined when null (Drizzle omits from SQL)
    expect(fields.forfeitBy).toBeUndefined();
    expect(fields.scores).toEqual([210, 180]);
    expect(fields.roundCount).toBe(6);
    expect(fields.targetScore).toBe(200);
    expect(fields.playerIds).toEqual(["p1-uuid-0001", "p2-uuid-0002", "p3-uuid-0003", "p4-uuid-0004"]);
  });

  it("logs to console when getDb() returns null", async () => {
    mockGetDb.mockResolvedValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const state = makeMatchState();
    const events: GameEvent[] = [
      { type: "match_ended", winner: 0, finalScores: [210, 180], reason: "reached_target" },
    ];

    await persistMatch(state, events);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain("[db/matches]");
    expect(output).toContain("FINISHED");
    expect(output).toContain("winner=0");

    consoleSpy.mockRestore();
  });

  it("catches insert errors via .catch() and logs to console.error", async () => {
    const dbError = new Error("connection refused");
    const mockDb = makeMockDb(dbError);
    mockGetDb.mockResolvedValue(mockDb);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = makeMatchState();
    const events: GameEvent[] = [
      { type: "match_ended", winner: 0, finalScores: [210, 180], reason: "reached_target" },
    ];

    await persistMatch(state, events);

    // Give the fire-and-forget promise time to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe("[db/matches] failed to persist match:");

    errorSpy.mockRestore();
  });

  it("does not block the game loop (fire-and-forget pattern)", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    const state = makeMatchState();
    const events: GameEvent[] = [
      { type: "match_ended", winner: 0, finalScores: [210, 180], reason: "reached_target" },
    ];

    // persistMatch should return a resolved promise (not block)
    const result = persistMatch(state, events);
    expect(result).toBeInstanceOf(Promise);
    await result;
  });
});
