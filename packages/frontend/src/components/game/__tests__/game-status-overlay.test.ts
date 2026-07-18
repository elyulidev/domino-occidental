import { describe, expect, it } from "bun:test";
import { buildMatchResultMessage, resolveOverlayMode } from "../game-status-overlay";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("game-status-overlay helpers", () => {
  // ── resolveOverlayMode ──

  describe("resolveOverlayMode", () => {
    it("returns match_ended for finished status", () => {
      expect(resolveOverlayMode("finished")).toBe("match_ended");
    });

    it("returns match_ended for abandoned status", () => {
      expect(resolveOverlayMode("abandoned")).toBe("match_ended");
    });

    it("returns none for in_progress status", () => {
      expect(resolveOverlayMode("in_progress")).toBe("none");
    });

    it("returns none for waiting status", () => {
      expect(resolveOverlayMode("waiting")).toBe("none");
    });
  });

  // ── buildMatchResultMessage ──

  describe("buildMatchResultMessage", () => {
    it("shows abandoned message when status is abandoned", () => {
      const result = buildMatchResultMessage("abandoned", [0, 0]);
      expect(result.title).toBe("Match Abandoned");
      expect(result.subtitle).toContain("left the match");
    });

    it("shows leaver name when matchAbandonedBy and players provided", () => {
      const players = [
        { id: "p0", name: "Alice", handSize: 5, isConnected: true },
        { id: "p1", name: "Bob", handSize: 3, isConnected: false },
      ];
      const result = buildMatchResultMessage("abandoned", [0, 0], "p1", players);
      expect(result.title).toBe("Match Abandoned");
      expect(result.subtitle).toBe("Bob left the match");
    });

    it("falls back to generic message when matchAbandonedBy has no matching player", () => {
      const players = [
        { id: "p0", name: "Alice", handSize: 5, isConnected: true },
      ];
      const result = buildMatchResultMessage("abandoned", [0, 0], "p99", players);
      expect(result.subtitle).toBe("A player left the match");
    });

    it("falls back to generic message when matchAbandonedBy is null", () => {
      const result = buildMatchResultMessage("abandoned", [0, 0], null);
      expect(result.subtitle).toBe("A player left the match");
    });

    it("shows Pair 1 wins when pair 1 score exceeds target", () => {
      const result = buildMatchResultMessage("finished", [150, 210]);
      expect(result.title).toBe("Pair 2 Wins!");
      expect(result.subtitle).toContain("150 – 210");
    });

    it("shows Pair 1 wins when pair 0 score exceeds target", () => {
      const result = buildMatchResultMessage("finished", [220, 180]);
      expect(result.title).toBe("Pair 1 Wins!");
      expect(result.subtitle).toContain("220 – 180");
    });

    it("shows match complete when neither score exceeds target", () => {
      const result = buildMatchResultMessage("finished", [100, 120]);
      expect(result.title).toBe("Match Complete");
      expect(result.subtitle).toContain("100 – 120");
    });
  });
});
