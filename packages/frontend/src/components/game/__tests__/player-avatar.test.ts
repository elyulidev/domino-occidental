import { describe, expect, it } from "bun:test";
import { isGrayedOut, seatPositionClass, seatStyle, tooltipPositionClass } from "../player-avatar";

// ---------------------------------------------------------------------------
// seatPositionClass
// ---------------------------------------------------------------------------

describe("seatPositionClass", () => {
  it("returns 'bottom' for seat 0", () => {
    expect(seatPositionClass(0)).toBe("bottom");
  });

  it("returns 'right' for seat 1 (counter-clockwise)", () => {
    expect(seatPositionClass(1)).toBe("right");
  });

  it("returns 'top' for seat 2", () => {
    expect(seatPositionClass(2)).toBe("top");
  });

  it("returns 'left' for seat 3 (counter-clockwise)", () => {
    expect(seatPositionClass(3)).toBe("left");
  });

  it("returns 'bottom' for unknown seat index", () => {
    expect(seatPositionClass(99)).toBe("bottom");
  });
});

// ---------------------------------------------------------------------------
// seatStyle
// ---------------------------------------------------------------------------

describe("seatStyle", () => {
  it("seat 0: bottom center with translateX", () => {
    const style = seatStyle(0);
    expect(style.bottom).toBe("8px");
    expect(style.left).toBe("50%");
    expect(style.transform).toBe("translateX(-50%)");
  });

  it("seat 1: right center with translateY (counter-clockwise)", () => {
    const style = seatStyle(1);
    expect(style.right).toBe("8px");
    expect(style.top).toBe("50%");
    expect(style.transform).toBe("translateY(-50%)");
  });

  it("seat 2: top center with translateX", () => {
    const style = seatStyle(2);
    expect(style.top).toBe("8px");
    expect(style.left).toBe("50%");
    expect(style.transform).toBe("translateX(-50%)");
  });

  it("seat 3: left center with translateY (counter-clockwise)", () => {
    const style = seatStyle(3);
    expect(style.left).toBe("8px");
    expect(style.top).toBe("50%");
    expect(style.transform).toBe("translateY(-50%)");
  });
});

// ---------------------------------------------------------------------------
// tooltipPositionClass
// ---------------------------------------------------------------------------

describe("tooltipPositionClass", () => {
  it("seat 0: positions tooltip above (bottom-full)", () => {
    expect(tooltipPositionClass(0)).toContain("bottom-full");
  });

  it("seat 1: positions tooltip to the left toward center (right-full)", () => {
    expect(tooltipPositionClass(1)).toContain("right-full");
  });

  it("seat 2: positions tooltip below (top-full)", () => {
    expect(tooltipPositionClass(2)).toContain("top-full");
  });

  it("seat 3: positions tooltip to the right toward center (left-full)", () => {
    expect(tooltipPositionClass(3)).toContain("left-full");
  });

  it("unknown seat: defaults to above (bottom-full)", () => {
    expect(tooltipPositionClass(99)).toContain("bottom-full");
  });
});

// ---------------------------------------------------------------------------
// isGrayedOut
// ---------------------------------------------------------------------------

describe("isGrayedOut", () => {
  it("returns false when connected", () => {
    expect(isGrayedOut(true, null, Date.now())).toBe(false);
  });

  it("returns false when disconnected but within 30s window", () => {
    const now = Date.now();
    const disconnectedSince = now - 20_000; // 20s ago
    expect(isGrayedOut(false, disconnectedSince, now)).toBe(false);
  });

  it("returns true when disconnected and >30s elapsed", () => {
    const now = Date.now();
    const disconnectedSince = now - 31_000; // 31s ago
    expect(isGrayedOut(false, disconnectedSince, now)).toBe(true);
  });

  it("returns false when disconnectedSince is null", () => {
    expect(isGrayedOut(false, null, Date.now())).toBe(false);
  });

  it("returns true exactly at 30s boundary", () => {
    const now = Date.now();
    const disconnectedSince = now - 30_001; // just over 30s
    expect(isGrayedOut(false, disconnectedSince, now)).toBe(true);
  });
});
