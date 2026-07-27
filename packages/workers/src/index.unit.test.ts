import { describe, it, expect, vi, beforeEach } from "vitest";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "./index";
import type { Env } from "./types";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockEnv(): Env {
  const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));

  return {
    GAME_DO: {
      idFromName: vi.fn().mockReturnValue("mock-game-id"),
      get: vi.fn().mockReturnValue({ fetch: mockFetch }),
      idFromString: vi.fn(),
      newUniqueId: vi.fn(),
    } as unknown as Env["GAME_DO"],

    MATCHMAKING_DO: {
      idFromName: vi.fn().mockReturnValue("mock-matchmaking-id"),
      get: vi.fn().mockReturnValue({ fetch: mockFetch }),
      idFromString: vi.fn(),
      newUniqueId: vi.fn(),
    } as unknown as Env["MATCHMAKING_DO"],

    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: "test-anon-key",
    JWT_SECRET: "test-secret",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Worker fetch handler", () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
  });

  it("routes /ws/game/:matchId to GAME_DO", async () => {
    const req = new Request("https://example.com/ws/game/match-123");
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(env.GAME_DO.idFromName).toHaveBeenCalledWith("match-123");
    expect(res.status).toBe(200);
  });

  it("routes /ws/matchmaking to MATCHMAKING_DO", async () => {
    const req = new Request("https://example.com/ws/matchmaking");
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(env.MATCHMAKING_DO.idFromName).toHaveBeenCalledWith("singleton");
    expect(res.status).toBe(200);
  });

  it("routes /matchmaking/* HTTP to MATCHMAKING_DO", async () => {
    const req = new Request("https://example.com/matchmaking/status");
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(env.MATCHMAKING_DO.idFromName).toHaveBeenCalledWith("singleton");
    expect(res.status).toBe(200);
  });

  it("returns 404 for unknown paths", async () => {
    const req = new Request("https://example.com/unknown/path");
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "not_found" });
  });

  it("passes the original request to the DO stub fetch", async () => {
    const req = new Request("https://example.com/ws/game/match-456");
    const ctx = createExecutionContext();
    await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);

    const stubFetch = (
      env.GAME_DO.get as ReturnType<typeof vi.fn>
    ).mock.results[0].value.fetch;
    expect(stubFetch).toHaveBeenCalledWith(req);
  });
});
