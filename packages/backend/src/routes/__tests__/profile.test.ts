// Set env BEFORE any imports (ESM hoists imports above all statements)
process.env.SUPABASE_JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

import { beforeEach, describe, expect, it, vi } from "bun:test";
import { Elysia } from "elysia";
import { authErrorHandler, authGuard } from "../../auth/guard";
import { signToken } from "../../test-utils";
import { profileRoutes } from "../profile";

// Mock the DB client — sibling path (../../db/client)
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
    .use(profileRoutes);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /profile/me integration", () => {
  // --- Scenario 1: profile found ---
  it("returns 200 with profile data when user exists", async () => {
    const profileRow = {
      id: "user-1",
      username: "testuser",
      avatarUrl: "https://avatar.test/u1.png",
      elo: 1500,
      coins: 300,
      country: "AR",
    };
    // Two sequential DB calls: profile query then rank count
    const mockDb = {
      select: vi.fn()
        // First call → select from profiles where id
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce(thenable([profileRow])),
          }),
        })
        // Second call → count profiles with higher elo
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce(thenable([{ count: 5 }])),
          }),
        }),
    };
    mockGetDb.mockResolvedValue(mockDb);

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/profile/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("user-1");
    expect(body.username).toBe("testuser");
    expect(body.elo).toBe(1500);
    expect(body.coins).toBe(300);
    expect(body.country).toBe("AR");
    expect(body.rank).toBe(6);
  });

  // --- Scenario 2: profile not found → 404 ---
  it("returns 404 when profile does not exist", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce(thenable([])),
        }),
      }),
    };
    mockGetDb.mockResolvedValue(mockDb);

    const token = await signToken("nonexistent");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/profile/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Profile not found" });
  });

  // --- Scenario 3: DB unavailable → 200 with null data? ---
  // getProfile returns null when DB is unavailable, so the route returns 404
  it("returns 404 when DB is unavailable", async () => {
    mockGetDb.mockResolvedValue(null);

    const token = await signToken("user-1");
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/profile/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(404);
  });

  // --- Scenario 4: no auth token → 401 ---
  it("returns 401 without authorization header", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/profile/me"),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  // --- Scenario 5: invalid auth token → 401 ---
  it("returns 401 with invalid Bearer token", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/profile/me", {
        headers: { Authorization: "Bearer invalid-token" },
      }),
    );

    expect(res.status).toBe(401);
  });
});
