import { describe, expect, it } from "bun:test";
import {
  addTile,
  createPlayer,
  hasTile,
  incrementPasses,
  removeTile,
  resetPasses,
  setConnected,
  sumHand,
  updateLastAction,
} from "@domino/shared/src/game";
import type { Tile } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTile(id: string, top = 0, bottom = 0): Tile {
  return { id, top, bottom };
}

// ---------------------------------------------------------------------------
// createPlayer
// ---------------------------------------------------------------------------

describe("createPlayer", () => {
  it("creates player with correct id and defaults", () => {
    const player = createPlayer("p1");
    expect(player.id).toBe("p1");
    expect(player.hand).toEqual([]);
    expect(player.isConnected).toBe(false);
    expect(player.consecutivePasses).toBe(0);
    expect(player.lastActionAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// removeTile
// ---------------------------------------------------------------------------

describe("removeTile", () => {
  it("removes the correct tile from the hand", () => {
    const hand = [makeTile("a"), makeTile("b"), makeTile("c")];
    const result = removeTile(hand, "b");
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("does not mutate the original hand", () => {
    const hand = [makeTile("a"), makeTile("b"), makeTile("c")];
    removeTile(hand, "b");
    expect(hand).toHaveLength(3);
    expect(hand.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("throws when tile is not found", () => {
    const hand = [makeTile("a")];
    expect(() => removeTile(hand, "missing")).toThrow("missing");
  });
});

// ---------------------------------------------------------------------------
// addTile
// ---------------------------------------------------------------------------

describe("addTile", () => {
  it("appends the tile to the hand", () => {
    const hand = [makeTile("a"), makeTile("b")];
    const newTile = makeTile("c");
    const result = addTile(hand, newTile);
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual(newTile);
  });

  it("does not mutate the original hand", () => {
    const hand = [makeTile("a"), makeTile("b")];
    addTile(hand, makeTile("c"));
    expect(hand).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// hasTile
// ---------------------------------------------------------------------------

describe("hasTile", () => {
  it("returns true for an existing tile", () => {
    const hand = [makeTile("a"), makeTile("b")];
    expect(hasTile(hand, "a")).toBe(true);
  });

  it("returns false for a missing tile", () => {
    const hand = [makeTile("a")];
    expect(hasTile(hand, "missing")).toBe(false);
  });

  it("returns false for an empty hand", () => {
    expect(hasTile([], "any")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setConnected
// ---------------------------------------------------------------------------

describe("setConnected", () => {
  it("toggles the connection flag", () => {
    const player = createPlayer("p1");
    const disconnected = setConnected(player, false);
    expect(disconnected.isConnected).toBe(false);
  });

  it("does not mutate the original player", () => {
    const player = createPlayer("p1");
    setConnected(player, true);
    expect(player.isConnected).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateLastAction
// ---------------------------------------------------------------------------

describe("updateLastAction", () => {
  it("stamps a recent date", () => {
    const player = createPlayer("p1");
    const before = new Date();
    const updated = updateLastAction(player);
    expect(updated.lastActionAt).toBeInstanceOf(Date);
    expect(updated.lastActionAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
  });

  it("does not mutate the original player", () => {
    const player = createPlayer("p1");
    const originalTime = player.lastActionAt.getTime();
    updateLastAction(player);
    expect(player.lastActionAt.getTime()).toBe(originalTime);
  });
});

// ---------------------------------------------------------------------------
// incrementPasses / resetPasses
// ---------------------------------------------------------------------------

describe("incrementPasses", () => {
  it("increments consecutive passes by 1", () => {
    const player = createPlayer("p1");
    const after1 = incrementPasses(player);
    expect(after1.consecutivePasses).toBe(1);
    const after2 = incrementPasses(after1);
    expect(after2.consecutivePasses).toBe(2);
  });

  it("does not mutate the original player", () => {
    const player = createPlayer("p1");
    incrementPasses(player);
    expect(player.consecutivePasses).toBe(0);
  });
});

describe("resetPasses", () => {
  it("resets consecutive passes to 0", () => {
    let player = createPlayer("p1");
    player = incrementPasses(player);
    player = incrementPasses(player);
    expect(player.consecutivePasses).toBe(2);
    const reset = resetPasses(player);
    expect(reset.consecutivePasses).toBe(0);
  });

  it("does not mutate the original player", () => {
    let player = createPlayer("p1");
    player = incrementPasses(player);
    player = incrementPasses(player);
    resetPasses(player);
    expect(player.consecutivePasses).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// sumHand
// ---------------------------------------------------------------------------

describe("sumHand", () => {
  it("calculates the sum of all tile values", () => {
    const hand = [makeTile("a", 3, 1), makeTile("b", 6, 6)];
    expect(sumHand(hand)).toBe(16);
  });

  it("returns 0 for an empty hand", () => {
    expect(sumHand([])).toBe(0);
  });
});
