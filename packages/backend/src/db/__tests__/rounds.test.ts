import { beforeEach, describe, expect, it, vi } from "bun:test";

// Mock the client module — sibling path
vi.mock("../client", () => ({
  getDb: vi.fn(),
}));

// Must import AFTER vi.mock so the mock is wired
import { getDb } from "../client";
import { flushMatchRounds, getRoundId, type RoundRecord, recordRound, resetRoundBuffers } from "../rounds";

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

function makeRound(overrides?: Partial<RoundRecord>): RoundRecord {
  return {
    matchId: "00000000-0000-0000-0000-000000000001",
    roundId: "11111111-1111-1111-1111-111111111111",
    roundNumber: 0,
    winningPair: 0,
    points: 45,
    isBlocked: false,
    isAnnulled: false,
    reason: "empty_hand",
    handScores: [0, 45],
    scoresAfter: [45, 0],
    boardLeftEnd: 3,
    boardRightEnd: 7,
    boardTileCount: 20,
    playerHands: [0, 15, 12, 18],
    firstPlayer: 0,
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
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetRoundBuffers();
  vi.clearAllMocks();
});

describe("recordRound", () => {
  // --- Scenario 1: buffers round when DB is available ---
  it("buffers round when getDb() returns a DB instance", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    const round = makeRound();
    await recordRound(round);

    // Should not call insert yet — just buffer
    expect(mockDb._mockInsert).not.toHaveBeenCalled();
  });

  // --- Scenario 2: console fallback when DB is null ---
  it("logs to console when getDb() returns null", async () => {
    mockGetDb.mockResolvedValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const round = makeRound();
    await recordRound(round);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain("[db/rounds]");
    expect(output).toContain("ROUND");
    expect(output).toContain("match=00000000");
    expect(output).toContain("round=0");
    expect(output).toContain("winner=0");
    expect(output).toContain("points=45");
    expect(output).toContain("reason=empty_hand");
    expect(output).toContain("scores=[45,0]");

    consoleSpy.mockRestore();
  });

  // --- Scenario 3: console fallback logs null winner for annulled hand ---
  it("logs null winner when winningPair is null (annulled hand)", async () => {
    mockGetDb.mockResolvedValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const round = makeRound({ winningPair: null, reason: "annulled", points: 0 });
    await recordRound(round);

    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain("winner=null");
    expect(output).toContain("points=0");
    expect(output).toContain("reason=annulled");

    consoleSpy.mockRestore();
  });

  // --- Scenario 4: multiple rounds are buffered for same match ---
  it("buffers multiple rounds for the same match", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    await recordRound(makeRound({ roundNumber: 0 }));
    await recordRound(makeRound({ roundNumber: 1 }));
    await recordRound(makeRound({ roundNumber: 2 }));

    // Still no insert calls — all buffered
    expect(mockDb._mockInsert).not.toHaveBeenCalled();
  });
});

describe("flushMatchRounds", () => {
  // --- Scenario 1: flushes buffered rounds to DB ---
  it("calls db.insert(matchRounds).values() with mapped fields", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    // Buffer a round first
    await recordRound(makeRound());

    // Now flush
    await flushMatchRounds("00000000-0000-0000-0000-000000000001");

    expect(mockDb._mockInsert).toHaveBeenCalledTimes(1);
    expect(mockDb._mockValues).toHaveBeenCalledTimes(1);

    // Drizzle values() receives an array of row objects
    const rows = mockDb._mockValues.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      matchId: "00000000-0000-0000-0000-000000000001",
      roundNumber: 0,
      winningPair: 0,
      points: 45,
      isBlocked: false,
      isAnnulled: false,
      reason: "empty_hand",
      handScores: [0, 45],
      scoresAfter: [45, 0],
      boardLeftEnd: 3,
      boardRightEnd: 7,
      boardTileCount: 20,
      playerHands: [0, 15, 12, 18],
      firstPlayer: 0,
    });
  });

  // --- Scenario 2: flush is a no-op when no rounds are buffered ---
  it("does nothing when no rounds are buffered for the match", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    await flushMatchRounds("nonexistent-match-id");

    expect(mockDb._mockInsert).not.toHaveBeenCalled();
  });

  // --- Scenario 3: flush clears the buffer after success ---
  it("clears the buffer after successful flush", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    await recordRound(makeRound({ roundNumber: 0 }));
    await recordRound(makeRound({ roundNumber: 1 }));

    await flushMatchRounds("00000000-0000-0000-0000-000000000001");

    // Second flush should be a no-op
    await flushMatchRounds("00000000-0000-0000-0000-000000000001");
    expect(mockDb._mockInsert).toHaveBeenCalledTimes(1);
  });

  // --- Scenario 4: console fallback when DB is null during flush ---
  it("logs skip message when getDb() returns null during flush", async () => {
    // First: buffer a round with DB available
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);
    await recordRound(makeRound());

    // Now: switch to null DB for the flush
    mockGetDb.mockResolvedValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await flushMatchRounds("00000000-0000-0000-0000-000000000001");

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const flushOutput = consoleSpy.mock.calls[0][0] as string;
    expect(flushOutput).toContain("[db/rounds]");
    expect(flushOutput).toContain("skipped flush");
    expect(flushOutput).toContain("no DB connection");

    consoleSpy.mockRestore();
  });

  // --- Scenario 5: insert error propagates to caller (for transaction rollback) ---
  it("propagates insert errors (caller handles via transaction catch)", async () => {
    const dbError = new Error("connection refused");
    const mockDb = makeMockDb(dbError);
    mockGetDb.mockResolvedValue(mockDb);

    await recordRound(makeRound());

    await expect(
      flushMatchRounds("00000000-0000-0000-0000-000000000001"),
    ).rejects.toThrow("connection refused");
  });

  // --- Scenario 6: maps all fields correctly including optional nulls ---
  it("maps winningPair as undefined when null (Drizzle omits from SQL)", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    await recordRound(makeRound({ winningPair: null, boardLeftEnd: null, boardRightEnd: null }));
    await flushMatchRounds("00000000-0000-0000-0000-000000000001");

    const fields = mockDb._mockValues.mock.calls[0][0];
    expect(fields.winningPair).toBeUndefined();
    expect(fields.boardLeftEnd).toBeUndefined();
    expect(fields.boardRightEnd).toBeUndefined();
  });

  // --- Scenario 7: flushes multiple rounds in one insert ---
  it("flushes all buffered rounds in a single insert call", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    await recordRound(makeRound({ roundNumber: 0 }));
    await recordRound(makeRound({ roundNumber: 1 }));
    await recordRound(makeRound({ roundNumber: 2 }));

    await flushMatchRounds("00000000-0000-0000-0000-000000000001");

    expect(mockDb._mockInsert).toHaveBeenCalledTimes(1);
    expect(mockDb._mockValues).toHaveBeenCalledTimes(1);

    // Drizzle values() receives an array of row objects
    const rows = mockDb._mockValues.mock.calls[0][0];
    expect(rows).toHaveLength(3);
    expect(rows[0].roundNumber).toBe(0);
    expect(rows[1].roundNumber).toBe(1);
    expect(rows[2].roundNumber).toBe(2);
  });

  // --- Scenario 8: flush includes roundId in insert ---
  it("includes roundId in flushed rows for FK reference from match_moves", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    const roundId = "22222222-2222-2222-2222-222222222222";
    await recordRound(makeRound({ roundId }));
    await flushMatchRounds("00000000-0000-0000-0000-000000000001");

    const rows = mockDb._mockValues.mock.calls[0][0];
    expect(rows[0].id).toBe(roundId);
  });
});

describe("getRoundId", () => {
  it("returns undefined for unknown round", () => {
    expect(getRoundId("match-1", 0)).toBeUndefined();
  });

  it("returns roundId after recordRound is called", async () => {
    mockGetDb.mockResolvedValue(makeMockDb());

    const roundId = "33333333-3333-3333-3333-333333333333";
    await recordRound(makeRound({ roundId }));

    expect(getRoundId("00000000-0000-0000-0000-000000000001", 0)).toBe(roundId);
  });

  it("returns undefined after flush clears the buffer", async () => {
    mockGetDb.mockResolvedValue(makeMockDb());

    await recordRound(makeRound({ roundId: "44444444-4444-4444-4444-444444444444" }));
    await flushMatchRounds("00000000-0000-0000-0000-000000000001");

    expect(getRoundId("00000000-0000-0000-0000-000000000001", 0)).toBeUndefined();
  });

  it("distinguishes between rounds of the same match", async () => {
    mockGetDb.mockResolvedValue(makeMockDb());

    await recordRound(makeRound({ roundNumber: 0, roundId: "aaaa-aaaa" }));
    await recordRound(makeRound({ roundNumber: 1, roundId: "bbbb-bbbb" }));

    expect(getRoundId("00000000-0000-0000-0000-000000000001", 0)).toBe("aaaa-aaaa");
    expect(getRoundId("00000000-0000-0000-0000-000000000001", 1)).toBe("bbbb-bbbb");
  });
});
