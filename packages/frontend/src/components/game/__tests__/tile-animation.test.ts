import { describe, expect, it } from "bun:test";
import {
  calculateAvatarOrigin,
  calculateTileTarget,
} from "../tile-animation";

// DOMRect mock for Bun (no DOM available)
function mockRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

// ---------------------------------------------------------------------------
// calculateAvatarOrigin
// ---------------------------------------------------------------------------

describe("calculateAvatarOrigin", () => {
  it("returns center of avatar relative to container, adjusted for pan/zoom", () => {
    const avatarRect = mockRect(100, 200, 64, 64); // center at (132, 232)
    const containerRect = mockRect(50, 50, 800, 600);
    const pan = { x: 0, y: 0 };
    const zoom = 1;

    const origin = calculateAvatarOrigin(avatarRect, containerRect, pan, zoom);
    // (132 - 50 - 0) / 1 = 82
    // (232 - 50 - 0) / 1 = 182
    expect(origin.x).toBe(82);
    expect(origin.y).toBe(182);
  });

  it("applies pan offset correctly", () => {
    const avatarRect = mockRect(100, 200, 64, 64);
    const containerRect = mockRect(50, 50, 800, 600);
    const pan = { x: 100, y: 50 };
    const zoom = 1;

    const origin = calculateAvatarOrigin(avatarRect, containerRect, pan, zoom);
    // (132 - 50 - 100) / 1 = -18
    // (232 - 50 - 50) / 1 = 132
    expect(origin.x).toBe(-18);
    expect(origin.y).toBe(132);
  });

  it("applies zoom correctly", () => {
    const avatarRect = mockRect(100, 200, 64, 64);
    const containerRect = mockRect(50, 50, 800, 600);
    const pan = { x: 0, y: 0 };
    const zoom = 2;

    const origin = calculateAvatarOrigin(avatarRect, containerRect, pan, zoom);
    // (132 - 50 - 0) / 2 = 41
    // (232 - 50 - 0) / 2 = 91
    expect(origin.x).toBe(41);
    expect(origin.y).toBe(91);
  });

  it("combines pan and zoom", () => {
    const avatarRect = mockRect(200, 300, 40, 40);
    const containerRect = mockRect(0, 0, 1000, 800);
    const pan = { x: 50, y: 30 };
    const zoom = 1.5;

    const origin = calculateAvatarOrigin(avatarRect, containerRect, pan, zoom);
    // center of avatar: (220, 320)
    // (220 - 0 - 50) / 1.5 = 113.333...
    // (320 - 0 - 30) / 1.5 = 193.333...
    expect(origin.x).toBeCloseTo(113.333, 2);
    expect(origin.y).toBeCloseTo(193.333, 2);
  });
});

// ---------------------------------------------------------------------------
// calculateTileTarget
// ---------------------------------------------------------------------------

describe("calculateTileTarget", () => {
  it("returns tile position as-is", () => {
    const target = calculateTileTarget(150, 250);
    expect(target).toEqual({ x: 150, y: 250 });
  });

  it("handles zero coordinates", () => {
    const target = calculateTileTarget(0, 0);
    expect(target).toEqual({ x: 0, y: 0 });
  });

  it("handles negative coordinates", () => {
    const target = calculateTileTarget(-100, -200);
    expect(target).toEqual({ x: -100, y: -200 });
  });
});
