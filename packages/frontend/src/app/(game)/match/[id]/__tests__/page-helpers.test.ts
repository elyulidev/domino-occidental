import { describe, expect, it } from "bun:test";
import { resolvePageView, resolveMatchMode } from "../page-helpers";
import type { GameStatus } from "@/lib/game/types";

// ---------------------------------------------------------------------------
// Tests for page-helpers
// ---------------------------------------------------------------------------

describe("resolvePageView", () => {
  it("returns 'loading' when status is undefined", () => {
    expect(resolvePageView(undefined)).toBe("loading");
  });

  it("returns 'loading' when status is 'waiting'", () => {
    expect(resolvePageView("waiting")).toBe("loading");
  });

  it("returns 'abandoned' when status is 'abandoned'", () => {
    expect(resolvePageView("abandoned")).toBe("abandoned");
  });

  it("returns 'ready' when status is 'in_progress'", () => {
    expect(resolvePageView("in_progress")).toBe("ready");
  });

  it("returns 'ready' when status is 'finished'", () => {
    expect(resolvePageView("finished")).toBe("ready");
  });
});

describe("resolveMatchMode", () => {
  it("returns 'online' when mode is 'online'", () => {
    expect(resolveMatchMode("online")).toBe("online");
  });

  it("returns 'local' when mode is null", () => {
    expect(resolveMatchMode(null)).toBe("local");
  });

  it("returns 'local' when mode is undefined", () => {
    expect(resolveMatchMode(undefined)).toBe("local");
  });

  it("returns 'local' for any other mode value", () => {
    expect(resolveMatchMode("local")).toBe("local");
    expect(resolveMatchMode("something")).toBe("local");
  });
});

// ---------------------------------------------------------------------------
// Tests for match page store integration (unit-level)
// ---------------------------------------------------------------------------

import { useGameStore } from "@/stores/game-store";
import type { MatchState, PlayerState, Tile } from "@domino/shared";

/** Build a minimal valid MatchState for testing. */
function buildTestMatch(matchId: string): MatchState {
  let tileCounter = 0;
  const makeTile = (top: number, bottom: number): Tile => ({
    top,
    bottom,
    id: `tile-${++tileCounter}`,
  });

  const makePlayer = (id: string): PlayerState => ({
    id,
    hand: Array.from({ length: 10 }, (_, i) => makeTile(i % 10, (i + 1) % 10)),
    consecutivePasses: 0,
    isConnected: true,
    lastActionAt: new Date(),
  });

  const pool: Tile[] = Array.from({ length: 15 }, (_, i) =>
    makeTile(i % 10, (i + 2) % 10),
  );

  return {
    matchId,
    players: [makePlayer("p0"), makePlayer("p1"), makePlayer("p2"), makePlayer("p3")],
    board: { leftEnd: null, rightEnd: null, tiles: [] },
    turn: {
      currentTurn: 0,
      turnDeadline: Date.now() + 45_000,
      consecutiveNullRounds: 0,
      roundNumber: 0,
      lastHandWinner: null,
    },
    scores: { scores: [0, 0], isTiebreaker: false },
    pool,
    status: "in_progress",
    poolCount: 15,
    targetScore: 200,
  };
}

describe("match page store integration", () => {
  // Reset store before each test
  const resetStore = () => {
    const { engine } = useGameStore.getState();
    if (engine) engine.destroy();
    useGameStore.setState({
      game: {
        board: { leftEnd: null, rightEnd: null, tiles: [] },
        scores: [0, 0],
        players: [],
        ownHand: [],
        turn: {
          currentTurn: 0,
          turnDeadline: null,
          consecutiveNullRounds: 0,
          roundNumber: 0,
          lastHandWinner: null,
        },
        status: "waiting",
      },
      ui: { selectedTileId: null, error: null },
      engine: null,
    });
  };

  it("initEngine sets status to in_progress and populates players", () => {
    resetStore();
    const match = buildTestMatch("test-match-1");

    useGameStore.getState().initEngine(match);

    const state = useGameStore.getState();
    expect(state.game.status).toBe("in_progress");
    expect(state.game.players).toHaveLength(4);
    expect(state.game.players[0].id).toBe("p0");
    expect(state.engine).not.toBeNull();
  });

  it("initEngine populates ownHand with 10 tiles", () => {
    resetStore();
    const match = buildTestMatch("test-match-2");

    useGameStore.getState().initEngine(match);

    const state = useGameStore.getState();
    expect(state.game.ownHand).toHaveLength(10);
    expect(state.game.ownHand[0]).toHaveProperty("top");
    expect(state.game.ownHand[0]).toHaveProperty("bottom");
  });

  it("reset clears engine and resets status to waiting", () => {
    resetStore();
    const match = buildTestMatch("test-match-3");
    useGameStore.getState().initEngine(match);

    // Verify engine is set
    expect(useGameStore.getState().engine).not.toBeNull();

    // Reset
    useGameStore.getState().reset();

    const state = useGameStore.getState();
    expect(state.engine).toBeNull();
    expect(state.game.status).toBe("waiting");
    expect(state.game.players).toHaveLength(0);
    expect(state.game.ownHand).toHaveLength(0);
  });

  it("initEngine then reset is a clean lifecycle", () => {
    resetStore();
    const match = buildTestMatch("test-match-lifecycle");

    // Init
    useGameStore.getState().initEngine(match);
    expect(useGameStore.getState().game.status).toBe("in_progress");
    expect(useGameStore.getState().engine).not.toBeNull();

    // Reset (simulates unmount cleanup)
    useGameStore.getState().reset();
    expect(useGameStore.getState().engine).toBeNull();
    expect(useGameStore.getState().game.status).toBe("waiting");

    // Re-init (simulates navigating to a new match)
    const match2 = buildTestMatch("test-match-lifecycle-2");
    useGameStore.getState().initEngine(match2);
    expect(useGameStore.getState().game.status).toBe("in_progress");
    expect(useGameStore.getState().engine).not.toBeNull();

    // Final cleanup
    useGameStore.getState().reset();
  });
});
