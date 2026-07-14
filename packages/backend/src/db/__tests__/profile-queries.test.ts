import { beforeEach, describe, expect, it, vi } from "bun:test";

// Mock the client module — sibling path
vi.mock("../client", () => ({
  getDb: vi.fn(),
}));

// Must import AFTER vi.mock so the mock is wired
import { getDb } from "../client";
import { getLeaderboard, getProfile } from "../queries/profiles";

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a thenable that resolves to the given value.
 * Drizzle's query chain returns thenables — our mock must behave the same.
 */
function thenable<T>(value: T) {
  let resolveFn: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolveFn = r;
  });
  let called = false;
  return {
    then(onfulfilled?: (v: T) => unknown) {
      if (!called) {
        called = true;
        resolveFn(value);
      }
      return promise.then(onfulfilled);
    },
    [Symbol.toStringTag]: "Promise",
  };
}

/**
 * Build a mock DB that tracks sequential select() calls.
 * Each call to select() pops the next result set from the queue.
 *
 * results[0] = result for first select() call (e.g. profile query)
 * results[1] = result for second select() call (e.g. rank count)
 *
 * The chain is: select().from().where() → thenable(rows)
 * For leaderboard: select().from().orderBy().offset().limit() → thenable(rows)
 */
function makeMockDb(results: unknown[][]): {
  select: ReturnType<typeof vi.fn>;
  _calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  let callIndex = 0;

  function buildChain(finalResult: unknown[]) {
    const asThenable = () => thenable(finalResult);
    const orderByChain = {
      offset: Object.assign(
        (...args: unknown[]) => {
          calls.push({ method: "offset", args });
          return {
            limit: Object.assign(
              (...args: unknown[]) => {
                calls.push({ method: "limit", args });
                return asThenable();
              },
              { toString: () => "limit" },
            ),
          };
        },
        { toString: () => "offset" },
      ),
    };
    return {
      from: Object.assign(
        (...args: unknown[]) => {
          calls.push({ method: "from", args });
          return {
            where: Object.assign(
              (...args: unknown[]) => {
                calls.push({ method: "where", args });
                return {
                  orderBy: Object.assign(
                    (...args: unknown[]) => {
                      calls.push({ method: "orderBy", args });
                      return orderByChain;
                    },
                    { toString: () => "orderBy" },
                  ),
                  // where() is terminal for getProfile queries — spread thenable
                  ...asThenable(),
                };
              },
              { toString: () => "where" },
            ),
            // orderBy() without where (leaderboard path)
            orderBy: Object.assign(
              (...args: unknown[]) => {
                calls.push({ method: "orderBy", args });
                return orderByChain;
              },
              { toString: () => "orderBy" },
            ),
          };
        },
        { toString: () => "from" },
      ),
    };
  }

  return {
    select: Object.assign(
      (...args: unknown[]) => {
        calls.push({ method: "select", args });
        const result = results[callIndex] ?? [];
        callIndex++;
        return buildChain(result);
      },
      { toString: () => "select" },
    ),
    _calls: calls,
  };
}

// ---------------------------------------------------------------------------
// Tests — getProfile
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProfile", () => {
  // --- Scenario 1: profile found with rank computation ---
  it("returns profile data with computed rank when user exists", async () => {
    const profileRow = {
      id: "user-1",
      username: "testuser",
      avatarUrl: "https://avatar.test/u1.png",
      elo: 1500,
      coins: 300,
      country: "AR",
    };
    // results[0] = profile query result, results[1] = rank count query result
    const mockDb = makeMockDb([[profileRow], [{ count: 5 }]]);
    mockGetDb.mockResolvedValue(mockDb);

    const result = await getProfile("user-1");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user-1");
    expect(result?.username).toBe("testuser");
    expect(result?.avatarUrl).toBe("https://avatar.test/u1.png");
    expect(result?.elo).toBe(1500);
    expect(result?.coins).toBe(300);
    expect(result?.country).toBe("AR");
    expect(result?.rank).toBe(6); // 5 players above + 1
  });

  // --- Scenario 2: profile not found ---
  it("returns null when user does not exist", async () => {
    const mockDb = makeMockDb([[]]);
    mockGetDb.mockResolvedValue(mockDb);

    const result = await getProfile("nonexistent-user");

    expect(result).toBeNull();
  });

  // --- Scenario 3: DB unavailable ---
  it("returns null when DB is unavailable", async () => {
    mockGetDb.mockResolvedValue(null);

    const result = await getProfile("user-1");

    expect(result).toBeNull();
  });

  // --- Scenario 4: rank = 1 when no one has higher elo ---
  it("returns rank 1 when player has highest elo", async () => {
    const profileRow = {
      id: "user-1",
      username: "topplayer",
      avatarUrl: null,
      elo: 2000,
      coins: 500,
      country: null,
    };
    // rank count = 0 → rank = 1
    const mockDb = makeMockDb([[profileRow], [{ count: 0 }]]);
    mockGetDb.mockResolvedValue(mockDb);

    const result = await getProfile("user-1");

    expect(result).not.toBeNull();
    expect(result?.rank).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — getLeaderboard
// ---------------------------------------------------------------------------

describe("getLeaderboard", () => {
  // --- Scenario 1: returns paginated results ---
  it("returns leaderboard entries ordered by elo desc", async () => {
    const mockRows = [
      { id: "u1", username: "alice", avatarUrl: null, elo: 1800, coins: 500, country: null },
      { id: "u2", username: "bob", avatarUrl: null, elo: 1600, coins: 300, country: null },
    ];
    const mockDb = makeMockDb([mockRows]);
    mockGetDb.mockResolvedValue(mockDb);

    const result = await getLeaderboard(1, 10);

    expect(result).toHaveLength(2);
    expect(result[0].username).toBe("alice");
    expect(result[0].elo).toBe(1800);
  });

  // --- Scenario 2: empty leaderboard ---
  it("returns empty array when no profiles exist", async () => {
    const mockDb = makeMockDb([[]]);
    mockGetDb.mockResolvedValue(mockDb);

    const result = await getLeaderboard(1, 10);

    expect(result).toEqual([]);
  });

  // --- Scenario 3: DB unavailable ---
  it("returns empty array when DB is unavailable", async () => {
    mockGetDb.mockResolvedValue(null);

    const result = await getLeaderboard(1, 10);

    expect(result).toEqual([]);
  });

  // --- Scenario 4: pagination offset ---
  it("applies correct offset for page 2 with limit 10", async () => {
    const mockRows = [
      { id: "u11", username: "player11", avatarUrl: null, elo: 1000, coins: 250, country: null },
    ];
    const mockDb = makeMockDb([mockRows]);
    mockGetDb.mockResolvedValue(mockDb);

    await getLeaderboard(2, 10);

    // Check that offset(10) and limit(10) were called
    const offsetCall = mockDb._calls.find(
      (c) => c.method === "offset",
    );
    const limitCall = mockDb._calls.find(
      (c) => c.method === "limit",
    );
    expect(offsetCall).toBeDefined();
    expect(offsetCall?.args[0]).toBe(10);
    expect(limitCall).toBeDefined();
    expect(limitCall?.args[0]).toBe(10);
  });
});
