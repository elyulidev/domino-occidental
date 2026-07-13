import { describe, expect, it } from "bun:test";

/**
 * Profiles schema — TDD tests.
 *
 * These tests verify that the profiles table schema exposes the `elo` and
 * `coins` columns with correct Drizzle column metadata. They import from
 * the barrel (../schema) to confirm the export path works end-to-end.
 *
 * RED phase: written BEFORE implementation. The tests reference columns
 * that do NOT yet exist on the profiles table definition.
 */

import { authUsers, profiles } from "../schema";

describe("profiles schema", () => {
  it("exports profiles table from barrel", () => {
    expect(profiles).toBeDefined();
    expect(profiles).toHaveProperty("elo");
    expect(profiles).toHaveProperty("coins");
  });

  it("exports authUsers table from barrel", () => {
    expect(authUsers).toBeDefined();
  });

  it("has elo column with default 1200", () => {
    const eloCol = profiles.elo;
    expect(eloCol).toBeDefined();
    expect((eloCol as Record<string, unknown>).default).toBe(1200);
  });

  it("has coins column with default 250", () => {
    const coinsCol = profiles.coins;
    expect(coinsCol).toBeDefined();
    expect((coinsCol as Record<string, unknown>).default).toBe(250);
  });

  it("preserves existing columns (username, avatarUrl, timestamps)", () => {
    expect(profiles.username).toBeDefined();
    expect(profiles.avatarUrl).toBeDefined();
    expect(profiles.createdAt).toBeDefined();
    expect(profiles.updatedAt).toBeDefined();
    expect(profiles.id).toBeDefined();
  });

  it("maps column names to correct SQL identifiers", () => {
    expect((profiles.elo as Record<string, unknown>).name).toBe("elo");
    expect((profiles.coins as Record<string, unknown>).name).toBe("coins");
    expect((profiles.username as Record<string, unknown>).name).toBe(
      "username",
    );
  });
});
