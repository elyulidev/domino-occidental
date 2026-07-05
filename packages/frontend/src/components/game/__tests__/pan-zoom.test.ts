import { describe, expect, it } from "bun:test";
import {
  calculatePanDelta,
  clampPan,
  calculateZoomAtCursor,
  isClick,
  calculateTouchDistance,
  calculatePinchZoom,
} from "../pan-zoom-utils";

describe("pan-zoom-utils", () => {
  // ── calculatePanDelta ──

  describe("calculatePanDelta", () => {
    it("returns delta from start to current position", () => {
      const result = calculatePanDelta(100, 200, 150, 250);
      expect(result).toEqual({ deltaX: 50, deltaY: 50 });
    });

    it("returns negative delta when moving left/up", () => {
      const result = calculatePanDelta(150, 250, 100, 200);
      expect(result).toEqual({ deltaX: -50, deltaY: -50 });
    });

    it("returns zero delta when position unchanged", () => {
      const result = calculatePanDelta(100, 200, 100, 200);
      expect(result).toEqual({ deltaX: 0, deltaY: 0 });
    });

    it("handles fractional coordinates", () => {
      const result = calculatePanDelta(100.5, 200.3, 150.7, 250.9);
      expect(result.deltaX).toBeCloseTo(50.2);
      expect(result.deltaY).toBeCloseTo(50.6);
    });

    it("handles large coordinates", () => {
      const result = calculatePanDelta(1000, 2000, 1500, 2500);
      expect(result).toEqual({ deltaX: 500, deltaY: 500 });
    });
  });

  // ── isClick ──

  describe("isClick", () => {
    it("returns true when movement is within threshold", () => {
      expect(isClick(100, 100, 102, 103)).toBe(true);
    });

    it("returns false when movement exceeds threshold", () => {
      expect(isClick(100, 100, 106, 103)).toBe(false);
    });

    it("returns false when movement exceeds threshold in Y", () => {
      expect(isClick(100, 100, 102, 106)).toBe(false);
    });

    it("returns true at exactly 5px movement (boundary)", () => {
      expect(isClick(100, 100, 105, 100)).toBe(true);
    });

    it("returns false at 6px movement", () => {
      expect(isClick(100, 100, 106, 100)).toBe(false);
    });

    it("returns true for zero movement", () => {
      expect(isClick(100, 100, 100, 100)).toBe(true);
    });

    it("handles negative coordinates", () => {
      expect(isClick(-100, -100, -102, -103)).toBe(true);
    });

    it("respects custom threshold", () => {
      expect(isClick(100, 100, 103, 100, 3)).toBe(true);
      expect(isClick(100, 100, 104, 100, 3)).toBe(false);
    });
  });

  // ── clampPan ──

  describe("clampPan", () => {
    it("returns pan unchanged when within bounds", () => {
      const result = clampPan(50, 50, 800, 600, 1);
      expect(result).toEqual({ panX: 50, panY: 50 });
    });

    it("clamps panX to left boundary", () => {
      const result = clampPan(-500, 0, 800, 600, 1);
      expect(result.panX).toBe(-400); // -50% of 800
    });

    it("clamps panX to right boundary", () => {
      const result = clampPan(500, 0, 800, 600, 1);
      expect(result.panX).toBe(400); // 50% of 800
    });

    it("clamps panY to top boundary", () => {
      const result = clampPan(0, -400, 800, 600, 1);
      expect(result.panY).toBe(-300); // -50% of 600
    });

    it("clamps panY to bottom boundary", () => {
      const result = clampPan(0, 400, 800, 600, 1);
      expect(result.panY).toBe(300); // 50% of 600
    });

    it("scales boundaries with zoom level", () => {
      // At 2x zoom, boundaries should be halved
      const result = clampPan(500, 0, 800, 600, 2);
      expect(result.panX).toBe(200); // 50% of 800 / 2
    });

    it("handles zero container dimensions", () => {
      const result = clampPan(50, 50, 0, 0, 1);
      expect(result).toEqual({ panX: 0, panY: 0 });
    });

    it("handles negative pan values within bounds", () => {
      const result = clampPan(-50, -50, 800, 600, 1);
      expect(result).toEqual({ panX: -50, panY: -50 });
    });

    it("handles very small container dimensions", () => {
      const result = clampPan(100, 100, 10, 10, 1);
      expect(result.panX).toBe(5);
      expect(result.panY).toBe(5);
    });

    it("handles zoom less than 1 (zoomed out)", () => {
      // At zoom 0.5, boundary is (800 * 0.5) / 0.5 = 800
      const result = clampPan(700, 0, 800, 600, 0.5);
      expect(result.panX).toBe(700); // Within boundary of 800
    });
  });

  // ── calculateZoomAtCursor ──

  describe("calculateZoomAtCursor", () => {
    it("increases zoom when scrolling up (deltaY negative)", () => {
      const result = calculateZoomAtCursor(1, -100, 400, 300, 800, 600);
      expect(result).toBeGreaterThan(1);
    });

    it("decreases zoom when scrolling down (deltaY positive)", () => {
      const result = calculateZoomAtCursor(1, 100, 400, 300, 800, 600);
      expect(result).toBeLessThan(1);
    });

    it("clamps zoom to minimum 0.25", () => {
      const result = calculateZoomAtCursor(0.25, 100, 400, 300, 800, 600);
      expect(result).toBe(0.25);
    });

    it("clamps zoom to maximum 3", () => {
      const result = calculateZoomAtCursor(3, -100, 400, 300, 800, 600);
      expect(result).toBe(3);
    });

    it("returns same zoom when delta is zero", () => {
      const result = calculateZoomAtCursor(1.5, 0, 400, 300, 800, 600);
      expect(result).toBe(1.5);
    });

    it("handles cursor at top-left corner", () => {
      const result = calculateZoomAtCursor(1, -100, 0, 0, 800, 600);
      expect(result).toBeGreaterThan(1);
    });

    it("handles cursor at bottom-right corner", () => {
      const result = calculateZoomAtCursor(1, -100, 800, 600, 800, 600);
      expect(result).toBeGreaterThan(1);
    });

    it("handles large scroll delta (zoom in)", () => {
      const result = calculateZoomAtCursor(1, -1000, 400, 300, 800, 600);
      // Zoom factor = 0.1 * (-1000 / 100) = -1
      // newZoom = 1 - (-1) = 2
      expect(result).toBe(2);
    });

    it("handles large scroll delta (zoom out)", () => {
      const result = calculateZoomAtCursor(1, 1000, 400, 300, 800, 600);
      // Zoom factor = 0.1 * (1000 / 100) = 10
      // newZoom = 1 - 10 = -9, clamped to 0.25
      expect(result).toBe(0.25);
    });

    it("handles fractional zoom levels", () => {
      const result = calculateZoomAtCursor(1.375, -50, 400, 300, 800, 600);
      expect(result).toBeGreaterThan(1.375);
      expect(result).toBeLessThanOrEqual(3);
    });

    it("zoom increment is proportional to scroll delta", () => {
      const result100 = calculateZoomAtCursor(1, -100, 400, 300, 800, 600);
      const result200 = calculateZoomAtCursor(1, -200, 400, 300, 800, 600);
      // 200px scroll should produce roughly double the zoom change
      expect(result200 - 1).toBeGreaterThan((result100 - 1) * 1.5);
    });
  });

  // ── calculateTouchDistance ──

  describe("calculateTouchDistance", () => {
    it("calculates distance between two points", () => {
      const result = calculateTouchDistance(
        { clientX: 0, clientY: 0 },
        { clientX: 3, clientY: 4 },
      );
      expect(result).toBe(5); // 3-4-5 triangle
    });

    it("returns zero for same point", () => {
      const result = calculateTouchDistance(
        { clientX: 100, clientY: 200 },
        { clientX: 100, clientY: 200 },
      );
      expect(result).toBe(0);
    });

    it("handles negative coordinates", () => {
      const result = calculateTouchDistance(
        { clientX: -100, clientY: -100 },
        { clientX: -97, clientY: -96 },
      );
      expect(result).toBe(5); // 3-4-5 triangle
    });

    it("calculates horizontal distance", () => {
      const result = calculateTouchDistance(
        { clientX: 100, clientY: 200 },
        { clientX: 200, clientY: 200 },
      );
      expect(result).toBe(100);
    });

    it("calculates vertical distance", () => {
      const result = calculateTouchDistance(
        { clientX: 100, clientY: 200 },
        { clientX: 100, clientY: 300 },
      );
      expect(result).toBe(100);
    });
  });

  // ── calculatePinchZoom ──

  describe("calculatePinchZoom", () => {
    it("increases zoom when pinching outward", () => {
      const result = calculatePinchZoom(1, 100, 200);
      expect(result).toBe(2); // 200/100 = 2x scale
    });

    it("decreases zoom when pinching inward", () => {
      const result = calculatePinchZoom(1, 200, 100);
      expect(result).toBe(0.5); // 100/200 = 0.5x scale
    });

    it("clamps zoom to minimum 0.25", () => {
      const result = calculatePinchZoom(0.5, 100, 50);
      expect(result).toBe(0.25); // 0.5 * 0.5 = 0.25
    });

    it("clamps zoom to maximum 3", () => {
      const result = calculatePinchZoom(2, 100, 200);
      expect(result).toBe(3); // 2 * 2 = 4, clamped to 3
    });

    it("returns current zoom when initial distance is zero", () => {
      const result = calculatePinchZoom(1.5, 0, 100);
      expect(result).toBe(1.5);
    });

    it("handles zoom already at boundaries", () => {
      expect(calculatePinchZoom(0.25, 100, 50)).toBe(0.25);
      expect(calculatePinchZoom(3, 100, 200)).toBe(3);
    });

    it("scales proportionally to current zoom", () => {
      const result1 = calculatePinchZoom(1, 100, 150);
      const result2 = calculatePinchZoom(2, 100, 150);
      // Both should scale by 1.5x
      expect(result1).toBe(1.5);
      expect(result2).toBe(3);
    });
  });
});