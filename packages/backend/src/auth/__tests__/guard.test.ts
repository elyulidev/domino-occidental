// Set env BEFORE any imports (ESM hoists imports above all statements)
process.env.SUPABASE_JWT_SECRET = "test-jwt-secret-that-is-at-least-32-chars-long";

import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { signToken, signTokenNoSub } from "../../test-utils";
import { authErrorHandler, authGuard } from "../guard";

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

function createTestApp() {
  return new Elysia()
    .onError(authErrorHandler)
    .use(authGuard())
    .get("/protected", ({ userId }: { userId: string }) => ({
      userId,
    }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("authGuard", () => {
  // --- Scenario 1: no Authorization header → 401 ---
  it("returns 401 with JSON error when Authorization header is missing", async () => {
    const app = createTestApp();
    const res = await app.handle(new Request("http://localhost/protected"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  // --- Scenario 2: Authorization header without Bearer prefix → 401 ---
  it("returns 401 when Authorization header lacks Bearer prefix", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: "Token abc123" },
      }),
    );

    expect(res.status).toBe(401);
  });

  // --- Scenario 3: invalid/expired token → 401 ---
  it("returns 401 with JSON error when JWT verification fails", async () => {
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: "Bearer invalid-token-value" },
      }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });

  // --- Scenario 4: valid token → injects userId ---
  it("injects userId into context when token is valid", async () => {
    const app = createTestApp();
    const token = await signToken("user-abc-123");

    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.userId).toBe("user-abc-123");
  });

  // --- Scenario 5: token with no sub claim → 401 ---
  it("returns 401 with JSON error when token payload has no sub claim", async () => {
    const token = await signTokenNoSub();
    const app = createTestApp();
    const res = await app.handle(
      new Request("http://localhost/protected", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "unauthorized" });
  });
});
