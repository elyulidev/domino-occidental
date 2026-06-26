import { describe, expect, it } from "bun:test";
import {
  computeAbandonPenalty,
  computeEloDelta,
  computeExpectedScore,
  computeInitialPairElo,
  getKFactor,
} from "../elo";

describe("computeExpectedScore", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(computeExpectedScore(1500, 1500)).toBe(0.5);
  });

  it("returns >0.5 for higher-rated player", () => {
    expect(computeExpectedScore(1600, 1400)).toBeGreaterThan(0.5);
  });

  it("returns <0.5 for lower-rated player", () => {
    expect(computeExpectedScore(1400, 1600)).toBeLessThan(0.5);
  });

  it("200-point difference gives ~0.76 expected score", () => {
    const score = computeExpectedScore(1600, 1400);
    expect(score).toBeCloseTo(0.7597, 3);
  });
});

describe("computeEloDelta", () => {
  it("positive delta for win", () => {
    const delta = computeEloDelta(32, 0.5, 1);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBe(16); // 32 * (1 - 0.5) = 16
  });

  it("negative delta for loss", () => {
    const delta = computeEloDelta(32, 0.5, 0);
    expect(delta).toBeLessThan(0);
    expect(delta).toBe(-16); // 32 * (0 - 0.5) = -16
  });

  it("favorite winning has small delta", () => {
    const delta = computeEloDelta(32, 0.9, 1);
    expect(delta).toBe(3); // 32 * (1 - 0.9) = 3.2 → rounded 3
  });
});

describe("getKFactor", () => {
  it("returns 32 for casual under 2000", () => {
    expect(getKFactor(1500, false)).toBe(32);
  });

  it("returns 48 for tournament", () => {
    expect(getKFactor(1500, true)).toBe(48);
  });

  it("returns 16 for ELO > 2000", () => {
    expect(getKFactor(2100, false)).toBe(16);
  });

  it("returns 48 for tournament even above 2000", () => {
    expect(getKFactor(2100, true)).toBe(48);
  });

  it("does NOT return 16 at exactly 2000", () => {
    expect(getKFactor(2000, false)).toBe(32); // >2000, not >=
  });
});

describe("computeInitialPairElo", () => {
  it("averages two ELOs", () => {
    expect(computeInitialPairElo(1400, 1200)).toBe(1300);
  });

  it("rounds to nearest integer", () => {
    expect(computeInitialPairElo(1401, 1200)).toBe(1301); // (1401+1200)/2 = 1300.5 → 1301
  });
});

describe("computeAbandonPenalty", () => {
  it("penalty is 50% extra on normal loss", () => {
    // Normal loss: 32 * (0 - 0.5) = -16
    // Abandon: floor(-16 * 1.5) = -24
    expect(computeAbandonPenalty(32, 0.5)).toBe(-24);
  });

  it("heavier penalty when favorite", () => {
    const penalty = computeAbandonPenalty(32, 0.9);
    expect(penalty).toBeLessThan(-3); // Normal loss would be -3
  });
});
