import { describe, expect, it } from "bun:test";
import { formatScore, resolveLeadingPair, playerToPair } from "../score-panel";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("score-panel helpers", () => {
  // ── formatScore ──

  describe("formatScore", () => {
    it("formats zero", () => {
      expect(formatScore(0)).toBe("0");
    });

    it("formats small numbers without separators", () => {
      expect(formatScore(150)).toBe("150");
    });

    it("formats large numbers with locale separators", () => {
      // toLocaleString uses the system locale — just verify it contains digits
      const result = formatScore(1200);
      expect(result).toMatch(/1.*200/);
    });
  });

  // ── resolveLeadingPair ──

  describe("resolveLeadingPair", () => {
    it("returns 0 when pair 0 leads", () => {
      expect(resolveLeadingPair([150, 100])).toBe(0);
    });

    it("returns 1 when pair 1 leads", () => {
      expect(resolveLeadingPair([80, 200])).toBe(1);
    });

    it("returns null when tied", () => {
      expect(resolveLeadingPair([100, 100])).toBeNull();
    });

    it("returns null when both zero", () => {
      expect(resolveLeadingPair([0, 0])).toBeNull();
    });
  });

  // ── playerToPair ──

  describe("playerToPair", () => {
    it("maps player 0 to pair 0", () => {
      expect(playerToPair(0)).toBe(0);
    });

    it("maps player 1 to pair 1", () => {
      expect(playerToPair(1)).toBe(1);
    });

    it("maps player 2 to pair 0", () => {
      expect(playerToPair(2)).toBe(0);
    });

    it("maps player 3 to pair 1", () => {
      expect(playerToPair(3)).toBe(1);
    });
  });
});
