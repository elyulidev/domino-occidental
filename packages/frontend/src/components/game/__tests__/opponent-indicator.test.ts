import { describe, expect, it } from "bun:test";
import {
  computeOpponents,
  connectionDotClass,
  opponentPositionClass,
  resolveOpponentCardClass,
  resolveOpponentContainerClass,
} from "../opponent-indicator";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("opponent-indicator helpers", () => {
  // ── computeOpponents ──

  describe("computeOpponents", () => {
    it("returns three opponents (indices 1, 2, 3)", () => {
      const result = computeOpponents([], 0);
      expect(result).toHaveLength(3);
      expect(result.map((o) => o.index)).toEqual([1, 2, 3]);
    });

    it("labels opponents as P2, P3, P4", () => {
      const result = computeOpponents([], 0);
      expect(result[0].label).toBe("P2");
      expect(result[1].label).toBe("P3");
      expect(result[2].label).toBe("P4");
    });

    it("assigns correct pair labels (P1=Pair1, P2=Pair0, P3=Pair1)", () => {
      const result = computeOpponents([], 0);
      expect(result[0].pairLabel).toBe("Pair 1"); // index 1 → odd → Pair 1
      expect(result[1].pairLabel).toBe("Pair 0"); // index 2 → even → Pair 0
      expect(result[2].pairLabel).toBe("Pair 1"); // index 3 → odd → Pair 1
    });

    it("defaults all opponents to connected when players array is empty", () => {
      const result = computeOpponents([], 0);
      expect(result.every((o) => o.isConnected)).toBe(true);
    });

    it("returns handSize from store players", () => {
      const players = [
        { id: "p0", handSize: 10, isConnected: true },
        { id: "p1", handSize: 7, isConnected: true },
        { id: "p2", handSize: 3, isConnected: false },
        { id: "p3", handSize: 5, isConnected: true },
      ];
      const result = computeOpponents(players, 0);
      expect(result[0].handSize).toBe(7);  // p1
      expect(result[1].handSize).toBe(3);  // p2
      expect(result[2].handSize).toBe(5);  // p3
    });

    it("returns isConnected from store players", () => {
      const players = [
        { id: "p0", handSize: 10, isConnected: true },
        { id: "p1", handSize: 8, isConnected: true },
        { id: "p2", handSize: 6, isConnected: false },
        { id: "p3", handSize: 9, isConnected: true },
      ];
      const result = computeOpponents(players, 0);
      expect(result[0].isConnected).toBe(true);   // p1
      expect(result[1].isConnected).toBe(false);  // p2
      expect(result[2].isConnected).toBe(true);   // p3
    });

    it("falls back to defaults for missing players", () => {
      const players = [
        { id: "p0", handSize: 10, isConnected: true },
      ];
      const result = computeOpponents(players, 0);
      expect(result[0].handSize).toBe(10);    // default fallback
      expect(result[0].isConnected).toBe(true); // default fallback
    });
  });

  // ── opponentPositionClass ──

  describe("opponentPositionClass", () => {
    it("returns left justification for player index 1", () => {
      expect(opponentPositionClass(1)).toBe("justify-self-start");
    });

    it("returns center justification for player index 2", () => {
      expect(opponentPositionClass(2)).toBe("justify-self-center");
    });

    it("returns right justification for player index 3", () => {
      expect(opponentPositionClass(3)).toBe("justify-self-end");
    });

    it("returns center for unknown index", () => {
      expect(opponentPositionClass(99)).toBe("justify-self-center");
    });
  });

  // ── connectionDotClass ──

  describe("connectionDotClass", () => {
    it("returns green when connected", () => {
      expect(connectionDotClass(true)).toBe("bg-green-500");
    });

    it("returns red when disconnected", () => {
      expect(connectionDotClass(false)).toBe("bg-red-500");
    });
  });

  // ── resolveOpponentContainerClass ──

  describe("resolveOpponentContainerClass", () => {
    it("returns horizontal layout by default", () => {
      const cls = resolveOpponentContainerClass();
      expect(cls).toContain("flex-row");
      expect(cls).toContain("gap-4");
    });

    it("returns horizontal layout when explicitly set", () => {
      const cls = resolveOpponentContainerClass("horizontal");
      expect(cls).toContain("flex-row");
      expect(cls).toContain("gap-4");
    });

    it("returns vertical layout when direction is vertical", () => {
      const cls = resolveOpponentContainerClass("vertical");
      expect(cls).toContain("flex-col");
      expect(cls).toContain("gap-2");
    });
  });

  // ── resolveOpponentCardClass ──

  describe("resolveOpponentCardClass", () => {
    it("returns default card classes when not active and horizontal", () => {
      const cls = resolveOpponentCardClass(false, "horizontal");
      expect(cls).toContain("border-domino-700/50");
      expect(cls).toContain("bg-domino-900/60");
      expect(cls).toContain("p-4");
      expect(cls).toContain("flex-col");
    });

    it("returns active card classes when it is the current turn", () => {
      const cls = resolveOpponentCardClass(true, "horizontal");
      expect(cls).toContain("border-gold-500/60");
      expect(cls).toContain("bg-domino-800/80");
      expect(cls).toContain("ring-1");
    });

    it("returns compact card classes when direction is vertical", () => {
      const cls = resolveOpponentCardClass(false, "vertical");
      expect(cls).toContain("p-2");
      expect(cls).toContain("flex-row");
      expect(cls).not.toContain("border-domino-700/50");
    });

    it("returns compact active card classes when vertical and active", () => {
      const cls = resolveOpponentCardClass(true, "vertical");
      expect(cls).toContain("p-2");
      expect(cls).toContain("flex-row");
      expect(cls).toContain("border-gold-500/60");
    });

    it("vertical container uses items-stretch for equal card widths", () => {
      const cls = resolveOpponentContainerClass("vertical");
      expect(cls).toContain("items-stretch");
    });

    it("vertical active card includes ring indicator", () => {
      const cls = resolveOpponentCardClass(true, "vertical");
      expect(cls).toContain("ring-1");
      expect(cls).toContain("ring-gold-500/30");
    });
  });
});
