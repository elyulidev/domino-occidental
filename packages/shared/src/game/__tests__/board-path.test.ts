import { describe, expect, it } from "bun:test";
import {
  generatePath,
  resolveSlotIndex,
  resolveFlipped,
  type BoardPathSlot,
} from "../board-path";
import type { Tile } from "../../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTile(top: number, bottom: number, id = "t-1"): Tile {
  return { top, bottom, id };
}

// ---------------------------------------------------------------------------
// Tests — BoardPath
// ---------------------------------------------------------------------------

describe("board-path", () => {
  // ── generatePath ──

  describe("generatePath", () => {
    it("returns 109 slots", () => {
      const path = generatePath();
      expect(path).toHaveLength(109);
    });

    it("center slot has index 0", () => {
      const path = generatePath();
      const center = path.find((s) => s.index === 0);
      expect(center).toBeDefined();
      expect(center!.arm).toBe("center");
    });

    it("right arm slots have positive indices 1..54", () => {
      const path = generatePath();
      const rightSlots = path.filter((s) => s.arm === "right");
      expect(rightSlots).toHaveLength(54);
      const indices = rightSlots.map((s) => s.index).sort((a, b) => a - b);
      expect(indices[0]).toBe(1);
      expect(indices[indices.length - 1]).toBe(54);
    });

    it("left arm slots have negative indices -1..-54", () => {
      const path = generatePath();
      const leftSlots = path.filter((s) => s.arm === "left");
      expect(leftSlots).toHaveLength(54);
      const indices = leftSlots.map((s) => s.index).sort((a, b) => a - b);
      expect(indices[0]).toBe(-54);
      expect(indices[indices.length - 1]).toBe(-1);
    });

    it("all slot indices are unique", () => {
      const path = generatePath();
      const indices = path.map((s) => s.index);
      const unique = new Set(indices);
      expect(unique.size).toBe(109);
    });

    it("is deterministic — two calls produce identical output", () => {
      const path1 = generatePath();
      const path2 = generatePath();
      expect(path1).toEqual(path2);
    });
  });

  // ── resolveSlotIndex ──

  describe("resolveSlotIndex", () => {
    it("first right tile gets index 1", () => {
      expect(resolveSlotIndex("right", 0)).toBe(1);
    });

    it("second right tile gets index 2", () => {
      expect(resolveSlotIndex("right", 1)).toBe(2);
    });

    it("third right tile gets index 3", () => {
      expect(resolveSlotIndex("right", 2)).toBe(3);
    });

    it("first left tile gets index -1", () => {
      expect(resolveSlotIndex("left", 0)).toBe(-1);
    });

    it("second left tile gets index -2", () => {
      expect(resolveSlotIndex("left", 1)).toBe(-2);
    });

    it("third left tile gets index -3", () => {
      expect(resolveSlotIndex("left", 2)).toBe(-3);
    });
  });

  // ── resolveFlipped ──

  describe("resolveFlipped", () => {
    it("right side non-center (slotIndex>0) → flipped=true", () => {
      expect(resolveFlipped("right", 1)).toBe(true);
      expect(resolveFlipped("right", 5)).toBe(true);
      expect(resolveFlipped("right", 54)).toBe(true);
    });

    it("right side center (slotIndex=0) → flipped=false", () => {
      expect(resolveFlipped("right", 0)).toBe(false);
    });

    it("left side non-center (slotIndex<0) → flipped=false", () => {
      expect(resolveFlipped("left", -1)).toBe(false);
      expect(resolveFlipped("left", -5)).toBe(false);
      expect(resolveFlipped("left", -54)).toBe(false);
    });

    it("left side center (slotIndex=0) → flipped=false", () => {
      expect(resolveFlipped("left", 0)).toBe(false);
    });
  });
});
