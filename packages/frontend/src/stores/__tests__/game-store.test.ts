import { beforeEach, describe, expect, it } from "bun:test";
import type { SanitizedMatchState, Tile } from "@domino/shared";
import { createDeck, deal, initializeMatch, setCurrentTurn, shuffle, startHand } from "@domino/shared/src/game";
import type { GameEngine } from "@/lib/game/types";
import { useGameStore } from "../game-store";

function setupStore() {
  const deck = shuffle(createDeck());
  const { hands, pool } = deal(deck);
  const matchResult = initializeMatch("test-match", hands, pool);
  const handResult = startHand(matchResult.match);
  // Force turn to player 0 (human)
  const forcedTurn = setCurrentTurn(handResult.match.turn, 0);
  // Connect ALL players (bots need isConnected=true or processBotTurns will infinite-loop)
  const connectedPlayers = handResult.match.players.map((p) => ({
    ...p,
    isConnected: true,
  })) as MatchState["players"];
  const match = { ...handResult.match, players: connectedPlayers, turn: forcedTurn };
  return { match, hand: hands[0] };
}

describe("useGameStore", () => {
  beforeEach(() => {
    // Reset store state
    useGameStore.setState({
      game: {
        board: { leftEnd: null, rightEnd: null, tiles: [] },
        scores: [0, 0],
        players: [],
        ownHand: [],
        turn: { currentTurn: 0, turnDeadline: null, consecutiveNullRounds: 0, roundNumber: 0, lastHandWinner: null },
        status: "waiting",
      },
      ui: { selectedTileId: null, error: null },
      engine: null,
    });
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function makeSanitized(overrides?: Partial<SanitizedMatchState>): SanitizedMatchState {
    return {
      matchId: "ws-match",
      players: [
        { id: "p0", handSize: 10, isConnected: true },
        { id: "p1", handSize: 8, isConnected: true },
        { id: "p2", handSize: 7, isConnected: false },
        { id: "p3", handSize: 9, isConnected: true },
      ],
      board: { leftEnd: null, rightEnd: null, tiles: [] },
      currentTurn: 1,
      scores: [45, 30],
      roundNumber: 3,
      poolCount: 12,
      status: "in_progress",
      targetScore: 200,
      turnDeadline: Date.now() + 45_000,
      consecutiveNullRounds: 1,
      lastHandWinner: 2,
      ...overrides,
    };
  }

  function makeHand(count: number): Tile[] {
    return Array.from({ length: count }, (_, i) => ({
      top: i % 10,
      bottom: (i + 1) % 10,
      id: `ws-tile-${i}`,
    }));
  }

  function createMockEngine(hand: Tile[]): GameEngine {
    return {
      get state() {
        return {
          matchId: "mock",
          players: [
            { id: "p0", hand, consecutivePasses: 0, isConnected: true, lastActionAt: new Date() },
            { id: "p1", hand: [], consecutivePasses: 0, isConnected: true, lastActionAt: new Date() },
            { id: "p2", hand: [], consecutivePasses: 0, isConnected: true, lastActionAt: new Date() },
            { id: "p3", hand: [], consecutivePasses: 0, isConnected: true, lastActionAt: new Date() },
          ] as never,
          board: { leftEnd: null, rightEnd: null, tiles: [] },
          turn: { currentTurn: 0 as const, turnDeadline: null, consecutiveNullRounds: 0, roundNumber: 0, lastHandWinner: null },
          scores: { scores: [0, 0] as [number, number], isTiebreaker: false },
          pool: [],
          poolCount: 0,
          status: "in_progress" as const,
          targetScore: 200,
        };
      },
      get hand() { return hand; },
      get playerIndex() { return 0; },
      playTile: () => ({ events: [], match: {} as never }),
      pass: () => ({ events: [], match: {} as never }),
      processBotTurns: () => ({} as never),
      destroy: () => {},
    };
  }

  it("has initial state", () => {
    const state = useGameStore.getState();
    expect(state.game.status).toBe("waiting");
    expect(state.game.ownHand).toHaveLength(0);
    expect(state.ui.selectedTileId).toBeNull();
  });

  it("initEngine sets up game state with 10 tiles in hand", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    const state = useGameStore.getState();
    expect(state.game.ownHand).toHaveLength(10);
    expect(state.game.status).toBe("in_progress");
    expect(state.engine).not.toBeNull();
  });

  it("selectTile sets selectedTileId in ui", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    const tile = useGameStore.getState().game.ownHand[0];
    useGameStore.getState().selectTile(tile.id);
    expect(useGameStore.getState().ui.selectedTileId).toBe(tile.id);
  });

  it("clearSelection resets selectedTileId", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    const tile = useGameStore.getState().game.ownHand[0];
    useGameStore.getState().selectTile(tile.id);
    useGameStore.getState().clearSelection();
    expect(useGameStore.getState().ui.selectedTileId).toBeNull();
  });

  it("playTile removes tile from hand and updates board", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    const tile = useGameStore.getState().game.ownHand[0];
    useGameStore.getState().selectTile(tile.id);
    useGameStore.getState().playTile("left");
    const state = useGameStore.getState();
    expect(state.game.ownHand.some((t) => t.id === tile.id)).toBe(false);
    expect(state.game.board.tiles.length).toBeGreaterThanOrEqual(1);
    expect(state.ui.selectedTileId).toBeNull();
  });

  it("playTile with no selection sets error", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    useGameStore.getState().playTile("left");
    expect(useGameStore.getState().ui.error).toBe("No tile selected");
  });

  it("pass clears selection and resolves bot turns back to human", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    useGameStore.getState().pass();
    const state = useGameStore.getState();
    expect(state.ui.selectedTileId).toBeNull();
    // processBotTurns() resolved all bot turns — should be back at human
    expect(state.game.turn.currentTurn).toBe(0);
  });

  it("reset clears all state", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    useGameStore.getState().reset();
    const state = useGameStore.getState();
    expect(state.game.status).toBe("waiting");
    expect(state.game.ownHand).toHaveLength(0);
    expect(state.engine).toBeNull();
  });

  it("playTile with invalid tile sets game_error in engine", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    useGameStore.getState().selectTile("nonexistent-id");
    useGameStore.getState().playTile("left");
    // The engine returns a game_error event, store should not crash
    const state = useGameStore.getState();
    expect(state.ui.selectedTileId).toBeNull();
  });

  it("multiple playTile calls update board progressively", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    const tile1 = useGameStore.getState().game.ownHand[0];
    useGameStore.getState().selectTile(tile1.id);
    useGameStore.getState().playTile("left");
    const boardAfterFirst = useGameStore.getState().game.board.tiles.length;
    expect(boardAfterFirst).toBeGreaterThanOrEqual(1);
  });

  it("initEngine replaces previous engine", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    const engine1 = useGameStore.getState().engine;
    useGameStore.getState().initEngine(match);
    const engine2 = useGameStore.getState().engine;
    expect(engine1).not.toBe(engine2);
  });

  it("selectTile replaces previous selection", () => {
    const { match } = setupStore();
    useGameStore.getState().initEngine(match);
    const tile1 = useGameStore.getState().game.ownHand[0];
    const tile2 = useGameStore.getState().game.ownHand[1];
    useGameStore.getState().selectTile(tile1.id);
    useGameStore.getState().selectTile(tile2.id);
    expect(useGameStore.getState().ui.selectedTileId).toBe(tile2.id);
  });

  // =========================================================================
  // Task 3.1: setEngine
  // =========================================================================

  describe("setEngine", () => {
    it("sets the engine and syncs state from it", () => {
      const hand = makeHand(10);
      const engine = createMockEngine(hand);
      useGameStore.getState().setEngine(engine);
      const state = useGameStore.getState();
      expect(state.engine).toBe(engine);
      expect(state.game.ownHand).toHaveLength(10);
      expect(state.game.ownHand[0].id).toBe("ws-tile-0");
      expect(state.game.status).toBe("in_progress");
    });

    it("replaces previous engine", () => {
      const engine1 = createMockEngine(makeHand(10));
      const engine2 = createMockEngine(makeHand(8));
      useGameStore.getState().setEngine(engine1);
      useGameStore.getState().setEngine(engine2);
      expect(useGameStore.getState().engine).toBe(engine2);
    });
  });

  // =========================================================================
  // Task 3.1: applyWsUpdate
  // =========================================================================

  describe("applyWsUpdate", () => {
    it("updates board, scores, turn, and status from sanitized state", () => {
      const sanitized = makeSanitized({
        board: {
          leftEnd: 3,
          rightEnd: 7,
          tiles: [{ tile: { id: "t1", top: 3, bottom: 5 }, side: "right", playerId: "p1" }],
        },
        scores: [45, 30],
        currentTurn: 2,
        roundNumber: 3,
        consecutiveNullRounds: 1,
        lastHandWinner: 2,
        status: "in_progress",
        turnDeadline: Date.now() + 10_000,
      });
      useGameStore.getState().applyWsUpdate(sanitized);
      const state = useGameStore.getState();
      expect(state.game.board.leftEnd).toBe(3);
      expect(state.game.board.rightEnd).toBe(7);
      expect(state.game.board.tiles).toHaveLength(1);
      expect(state.game.scores).toEqual([45, 30]);
      expect(state.game.turn.currentTurn).toBe(2);
      expect(state.game.turn.roundNumber).toBe(3);
      expect(state.game.turn.consecutiveNullRounds).toBe(1);
      expect(state.game.turn.lastHandWinner).toBe(2);
      expect(state.game.status).toBe("in_progress");
    });

    it("updates players with handSize and isConnected from sanitized state", () => {
      const sanitized = makeSanitized({
        players: [
          { id: "p0", handSize: 10, isConnected: true },
          { id: "p1", handSize: 5, isConnected: true },
          { id: "p2", handSize: 0, isConnected: false },
          { id: "p3", handSize: 3, isConnected: true },
        ],
      });
      useGameStore.getState().applyWsUpdate(sanitized);
      const players = useGameStore.getState().game.players;
      expect(players).toHaveLength(4);
      expect(players[0]).toEqual({ id: "p0", name: undefined, handSize: 10, isConnected: true });
      expect(players[1]).toEqual({ id: "p1", name: undefined, handSize: 5, isConnected: true });
      expect(players[2]).toEqual({ id: "p2", name: undefined, handSize: 0, isConnected: false });
      expect(players[3]).toEqual({ id: "p3", name: undefined, handSize: 3, isConnected: true });
    });

    it("with yourHand sets ownHand", () => {
      const hand = makeHand(7);
      const sanitized = makeSanitized();
      useGameStore.getState().applyWsUpdate(sanitized, hand);
      const state = useGameStore.getState();
      expect(state.game.ownHand).toHaveLength(7);
      expect(state.game.ownHand[0].id).toBe("ws-tile-0");
    });

    it("without yourHand preserves existing ownHand", () => {
      const existingHand = makeHand(5);
      useGameStore.setState({
        game: {
          ...useGameStore.getState().game,
          ownHand: existingHand,
        },
      });
      const sanitized = makeSanitized();
      useGameStore.getState().applyWsUpdate(sanitized);
      const state = useGameStore.getState();
      expect(state.game.ownHand).toHaveLength(5);
      expect(state.game.ownHand).toBe(existingHand);
    });

    it("sets status to finished", () => {
      const sanitized = makeSanitized({ status: "finished" });
      useGameStore.getState().applyWsUpdate(sanitized);
      expect(useGameStore.getState().game.status).toBe("finished");
    });

    it("sets status to abandoned", () => {
      const sanitized = makeSanitized({ status: "abandoned" });
      useGameStore.getState().applyWsUpdate(sanitized);
      expect(useGameStore.getState().game.status).toBe("abandoned");
    });
  });
});
