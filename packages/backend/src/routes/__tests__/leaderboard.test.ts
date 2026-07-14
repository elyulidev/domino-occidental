// Set env BEFORE any imports (ESM hoists imports above all statements)
process.env.SUPABASE_JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

import { beforeEach, describe, expect, it, vi } from "bun:test";
import { Elysia } from "elysia";
import { authErrorHandler, authGuard } from "../../auth/guard";
import { signToken } from "../../test-utils";
import { leaderboardRoutes } from "../leaderboard";

// Mock the DB client
vi.mock("../../db/client", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../../db/client";

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Thenable helper (mimics Drizzle's query chain)
// ---------------------------------------------------------------------------

function thenable<T>(value: T) {
  let resolveFn: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolveFn = r;
  });
  let called = false;
  return {
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable for Drizzle mock
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

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

function createTestApp() {
  return new Elysia()
    .onError(authErrorHandler)
    .use(authGuard())
    .use(leaderboardRoutes);
}

// ---------------------------------------------------------------------------
// Helper: build mock DB for leaderboard queries
// The route makes 2 DB calls:
//   1) db.select({ count }).from(profiles) → [{ count: N }]
//   2) db.select({ id, ... }).from(profiles).orderBy(...) → allRows
// ---------------------------------------------------------------------------

function mockLeaderboardDb(allRows: unknown[], totalCount: number) {
  const mockDb = {
    select: vi
      .fn()
      // Call 1: count query
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce(thenable([{ count: totalCount }])),
      })
      // Call 2: all profiles ordered by elo DESC
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce(thenable(allRows)),
        }),
      }),
  };

  return mockDb;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /leaderboard/individual", () => {
  // --- Scenario 1: First page returns ≤10 entries ---
  it("returns first page with at most 10 entries", async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      id: `user-${i + 1}`,
      username: `player${i + 1}`,
      avatarUrl: null,
      elo: 1500 - i * 10,
    }));
    mockGetDb.mockResolvedValue(mockLeaderboardDb(entries, 10));

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/leaderboard/individual?page=1&limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(10);
    expect(body.total).toBe(10);
    expect(body.page).toBe(1);
    expect(body.totalPages).toBe(1);
  });

  // --- Scenario 2: Pagination works ---
  it("returns entries 11-20 on page 2 with totalPages=3 for 25 users", async () => {
    // Route fetches ALL rows from DB, then slices in JS.
    // So the mock must return all 25 rows.
    const allRows = Array.from({ length: 25 }, (_, i) => ({
      id: `user-${i + 1}`,
      username: `player${i + 1}`,
      avatarUrl: null,
      elo: 1500 - i * 10,
    }));
    mockGetDb.mockResolvedValue(mockLeaderboardDb(allRows, 25));

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/leaderboard/individual?page=2&limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(10);
    expect(body.total).toBe(25);
    expect(body.page).toBe(2);
    expect(body.totalPages).toBe(3);
    // Verify it's the second page of entries
    expect(body.data[0].username).toBe("player11");
    expect(body.data[9].username).toBe("player20");
  });

  // --- Scenario 3: Same ELO shares rank ---
  it("gives same rank to players with equal ELO", async () => {
    const entries = [
      { id: "a", username: "alice", avatarUrl: null, elo: 1400 },
      { id: "b", username: "bob", avatarUrl: null, elo: 1400 },
      { id: "c", username: "charlie", avatarUrl: null, elo: 1300 },
    ];
    mockGetDb.mockResolvedValue(mockLeaderboardDb(entries, 3));

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/leaderboard/individual?page=1&limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].rank).toBe(1);
    expect(body.data[1].rank).toBe(1);
    expect(body.data[2].rank).toBe(3);
  });

  // --- Scenario 4: 401 without auth ---
  it("returns 401 without authorization header", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/leaderboard/individual"),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  // --- Scenario 5: Empty leaderboard ---
  it("returns empty data array for empty leaderboard", async () => {
    mockGetDb.mockResolvedValue(mockLeaderboardDb([], 0));

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/leaderboard/individual?page=1&limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.totalPages).toBe(0);
  });

  // --- Scenario 6: Each entry contains required fields ---
  it("returns entries with rank, username, elo, avatar_url", async () => {
    const entries = [
      { id: "u1", username: "alice", avatarUrl: "https://avatar.test/a.png", elo: 1500 },
    ];
    mockGetDb.mockResolvedValue(mockLeaderboardDb(entries, 1));

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/leaderboard/individual?page=1&limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    const entry = body.data[0];
    expect(entry).toHaveProperty("rank");
    expect(entry).toHaveProperty("username");
    expect(entry).toHaveProperty("elo");
    expect(entry).toHaveProperty("avatar_url");
    expect(entry.username).toBe("alice");
    expect(entry.elo).toBe(1500);
  });

  // --- Scenario 7: Entries ordered by elo DESC ---
  it("returns entries ordered by elo descending", async () => {
    const entries = [
      { id: "a", username: "high", avatarUrl: null, elo: 1600 },
      { id: "b", username: "mid", avatarUrl: null, elo: 1400 },
      { id: "c", username: "low", avatarUrl: null, elo: 1200 },
    ];
    mockGetDb.mockResolvedValue(mockLeaderboardDb(entries, 3));

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/leaderboard/individual?page=1&limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].elo).toBe(1600);
    expect(body.data[1].elo).toBe(1400);
    expect(body.data[2].elo).toBe(1200);
  });

  // --- Scenario 8: DB unavailable returns empty ---
  it("returns empty data when DB is unavailable", async () => {
    mockGetDb.mockResolvedValue(null);

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/leaderboard/individual?page=1&limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });
});
