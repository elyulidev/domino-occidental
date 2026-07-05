import { describe, expect, it } from "bun:test";
import {
  getTimeRemaining,
  isHumanTurn,
  turnProgressPercent,
  timerColorClass,
  resolveTimerClasses,
} from "../turn-timer";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("turn-timer helpers", () => {
  // ── getTimeRemaining ──

  describe("getTimeRemaining", () => {
    it("returns 0 for null deadline", () => {
      expect(getTimeRemaining(null)).toBe(0);
    });

    it("returns 0 for past deadline", () => {
      expect(getTimeRemaining(Date.now() - 5000)).toBe(0);
    });

    it("returns seconds remaining for future deadline", () => {
      const deadline = Date.now() + 30_000; // 30s from now
      const remaining = getTimeRemaining(deadline);
      // Allow ±1 for execution time
      expect(remaining).toBeGreaterThanOrEqual(29);
      expect(remaining).toBeLessThanOrEqual(31);
    });

    it("caps at 45 seconds max", () => {
      const deadline = Date.now() + 60_000; // 60s from now
      expect(getTimeRemaining(deadline)).toBe(45);
    });
  });

  // ── isHumanTurn ──

  describe("isHumanTurn", () => {
    it("returns true when currentTurn matches playerIndex", () => {
      expect(isHumanTurn(0, 0)).toBe(true);
    });

    it("returns false when currentTurn differs from playerIndex", () => {
      expect(isHumanTurn(1, 0)).toBe(false);
      expect(isHumanTurn(2, 0)).toBe(false);
      expect(isHumanTurn(3, 0)).toBe(false);
    });
  });

  // ── turnProgressPercent ──

  describe("turnProgressPercent", () => {
    it("returns 100 when full time remains", () => {
      expect(turnProgressPercent(45)).toBe(100);
    });

    it("returns 0 when no time remains", () => {
      expect(turnProgressPercent(0)).toBe(0);
    });

    it("returns ~50 at half time", () => {
      expect(turnProgressPercent(23)).toBe(51);
    });

    it("handles custom max seconds", () => {
      expect(turnProgressPercent(5, 10)).toBe(50);
    });
  });

  // ── timerColorClass ──

  describe("timerColorClass", () => {
    it("returns red when 10 seconds or less", () => {
      expect(timerColorClass(10)).toBe("bg-red-500");
      expect(timerColorClass(5)).toBe("bg-red-500");
      expect(timerColorClass(0)).toBe("bg-red-500");
    });

    it("returns amber when 11-20 seconds", () => {
      expect(timerColorClass(11)).toBe("bg-amber-500");
      expect(timerColorClass(20)).toBe("bg-amber-500");
    });

    it("returns green when more than 20 seconds", () => {
      expect(timerColorClass(21)).toBe("bg-green-500");
      expect(timerColorClass(45)).toBe("bg-green-500");
    });
  });

  // ── resolveTimerClasses ──

  describe("resolveTimerClasses", () => {
    it("returns full classes when compact is false (default)", () => {
      const cls = resolveTimerClasses();
      expect(cls).toContain("rounded-2xl");
      expect(cls).toContain("border");
      expect(cls).toContain("p-4");
    });

    it("returns full classes when compact is explicitly false", () => {
      const cls = resolveTimerClasses(false);
      expect(cls).toContain("rounded-2xl");
      expect(cls).toContain("border");
      expect(cls).toContain("p-4");
    });

    it("returns slim classes when compact is true", () => {
      const cls = resolveTimerClasses(true);
      expect(cls).toContain("p-2");
      expect(cls).not.toContain("rounded-2xl");
      expect(cls).not.toContain("border");
    });

    it("compact uses rounded-lg instead of rounded-2xl", () => {
      const cls = resolveTimerClasses(true);
      expect(cls).toContain("rounded-lg");
    });

    it("non-compact does not contain rounded-lg", () => {
      const cls = resolveTimerClasses(false);
      expect(cls).not.toContain("rounded-lg");
    });
  });
});
