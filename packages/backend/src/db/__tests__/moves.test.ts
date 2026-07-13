import { beforeEach, describe, expect, it, vi } from "bun:test";

// Mock the client module — sibling path
vi.mock("../client", () => ({
  getDb: vi.fn(),
}));

// Must import AFTER vi.mock so the mock is wired
import { getDb } from "../client";
import { type MoveRecord, recordMatchMove, resetMoveCounters } from "../moves";

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

function makeMove(overrides?: Partial<MoveRecord>): MoveRecord {
  return {
    matchId: "00000000-0000-0000-0000-000000000001",
    roundNumber: 3,
    playerIndex: 2,
    moveNumber: 0, // auto-assigned
    isPass: false,
    actionSource: "player",
    tileId: "tile-abc",
    tileTop: 5,
    tileBottom: 9,
    side: "left",
    boardLeftEnd: 3,
    boardRightEnd: 7,
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
  resetMoveCounters();
  vi.clearAllMocks();
});

describe("recordMatchMove", () => {
  // --- Scenario 1: calls db.insert().values() with correct field mapping ---
  it("calls db.insert(matchMoves).values() with mapped fields when DB is available", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    const move = makeMove();
    await recordMatchMove(move);

    // insert() must have been called with the matchMoves schema object
    expect(mockDb._mockInsert).toHaveBeenCalledTimes(1);
    // values() must have been called with the field mapping
    expect(mockDb._mockValues).toHaveBeenCalledTimes(1);

    const fields = mockDb._mockValues.mock.calls[0][0];
    expect(fields).toMatchObject({
      matchId: "00000000-0000-0000-0000-000000000001",
      roundNumber: 3,
      playerIndex: 2,
      moveNumber: 1, // first call → 1
      isPass: false,
      actionSource: "player",
      tileId: "tile-abc",
      tileTop: 5,
      tileBottom: 9,
      side: "left",
      boardLeftEnd: 3,
      boardRightEnd: 7,
    });
  });

  // --- Scenario 2: console fallback when DB is null ---
  it("logs to console when getDb() returns null", async () => {
    mockGetDb.mockResolvedValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const move = makeMove();
    await recordMatchMove(move);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain("[db/moves]");
    expect(output).toContain("PLAY");
    expect(output).toContain("match=00000000");
    expect(output).toContain("round=3");
    expect(output).toContain("move#=1");
    expect(output).toContain("player=2");
    expect(output).toContain("source=player");
    expect(output).toContain("tile=tile-abc");
    expect(output).toContain("side=left");

    consoleSpy.mockRestore();
  });

  // --- Scenario 3: console fallback logs PASS for pass moves ---
  it("logs PASS when isPass is true and DB is null", async () => {
    mockGetDb.mockResolvedValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const move = makeMove({ isPass: true, tileId: undefined, side: undefined });
    await recordMatchMove(move);

    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain("PASS");

    consoleSpy.mockRestore();
  });

  // --- Scenario 4: insert error is caught by .catch() ---
  it("catches insert errors via .catch() and logs to console.error", async () => {
    const dbError = new Error("connection refused");
    const mockDb = makeMockDb(dbError);
    mockGetDb.mockResolvedValue(mockDb);
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const move = makeMove();
    await recordMatchMove(move);

    // Give the fire-and-forget promise time to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe(
      "[db/moves] failed to record match move:",
    );
    expect(errorSpy.mock.calls[0][1]).toBe(dbError);

    errorSpy.mockRestore();
  });

  // --- Scenario 5: move number increments across calls ---
  it("increments moveNumber across multiple calls for the same match", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    const move = makeMove();
    await recordMatchMove(move);
    await recordMatchMove(move);
    await recordMatchMove(move);

    const call1 = mockDb._mockValues.mock.calls[0][0];
    const call2 = mockDb._mockValues.mock.calls[1][0];
    const call3 = mockDb._mockValues.mock.calls[2][0];

    expect(call1.moveNumber).toBe(1);
    expect(call2.moveNumber).toBe(2);
    expect(call3.moveNumber).toBe(3);
  });

  // --- Triangulation: optional fields are omitted when undefined ---
  it("passes optional fields as undefined when not provided", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    const move = makeMove({
      tileId: undefined,
      tileTop: undefined,
      tileBottom: undefined,
      side: undefined,
    });
    await recordMatchMove(move);

    const fields = mockDb._mockValues.mock.calls[0][0];
    // Optional fields are passed as undefined (Drizzle omits them from SQL)
    expect(fields.tileId).toBeUndefined();
    expect(fields.tileTop).toBeUndefined();
    expect(fields.tileBottom).toBeUndefined();
    expect(fields.side).toBeUndefined();
  });

  // --- Triangulation: different actionSource values ---
  it("passes actionSource through without modification", async () => {
    const mockDb = makeMockDb();
    mockGetDb.mockResolvedValue(mockDb);

    await recordMatchMove(makeMove({ actionSource: "timeout" }));
    await recordMatchMove(makeMove({ actionSource: "forfeit" }));

    const call1 = mockDb._mockValues.mock.calls[0][0];
    const call2 = mockDb._mockValues.mock.calls[1][0];

    expect(call1.actionSource).toBe("timeout");
    expect(call2.actionSource).toBe("forfeit");
  });
});
