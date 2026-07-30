import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseInsert, supabaseUpsert } from "./db";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const CONFIG = {
  supabaseUrl: "https://test.supabase.co",
  serviceRoleKey: "test-service-role-key",
};

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// supabaseInsert
// ---------------------------------------------------------------------------

describe("supabaseInsert", () => {
  it("sends POST to /rest/v1/{table} with correct headers", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });

    await supabaseInsert("matches", { id: "m1", status: "finished" }, CONFIG);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("https://test.supabase.co/rest/v1/matches");
    expect(opts.method).toBe("POST");

    const headers = opts.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${CONFIG.serviceRoleKey}`);
    expect(headers.apikey).toBe(CONFIG.serviceRoleKey);
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body as string);
    expect(body).toEqual({ id: "m1", status: "finished" });
  });

  it("logs error on non-ok response", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ message: "duplicate key" }),
    });

    await supabaseInsert("matches", { id: "m1" }, CONFIG);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("insert failed table=matches status=409"),
    );
    consoleSpy.mockRestore();
  });

  it("handles non-JSON error body gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    await supabaseInsert("matches", { id: "m1" }, CONFIG);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("HTTP 500"),
    );
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// supabaseUpsert
// ---------------------------------------------------------------------------

describe("supabaseUpsert", () => {
  it("sends POST with on_conflict query param and merge-duplicates Prefer header", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });

    await supabaseUpsert(
      "matches",
      { id: "m1", status: "finished" },
      "id",
      CONFIG,
    );

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];

    expect(url).toContain("on_conflict=id");
    expect(opts.method).toBe("POST");

    const headers = opts.headers as Record<string, string>;
    expect(headers.Prefer).toContain("resolution=merge-duplicates");
  });

  it("logs error on failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: "invalid input" }),
    });

    await supabaseUpsert("matches", { id: "m1" }, "id", CONFIG);

    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });
});
