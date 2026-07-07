import { describe, expect, it, } from "bun:test";
import type { MatchState, SanitizedMatchState, Tile, WsClientMessage } from "@domino/shared";
import { WsGameEngine } from "../ws-engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLAYER_ID = "player-0";

function makeHand(count: number): Tile[] {
  return Array.from({ length: count }, (_, i) => ({
    top: i,
    bottom: i + 1,
    id: `tile-${i}`,
  }));
}

function makeSanitized(overrides?: Partial<SanitizedMatchState>): SanitizedMatchState {
  return {
    matchId: "test-match",
    players: [
      { id: PLAYER_ID, handSize: 10, isConnected: true },
      { id: "player-1", handSize: 10, isConnected: true },
      { id: "player-2", handSize: 10, isConnected: true },
      { id: "player-3", handSize: 10, isConnected: true },
    ],
    board: { leftEnd: null, rightEnd: null, tiles: [] },
    currentTurn: 0,
    scores: [0, 0],
    roundNumber: 1,
    poolCount: 15,
    status: "in_progress",
    targetScore: 200,
    turnDeadline: Date.now() + 45_000,
    consecutiveNullRounds: 0,
    lastHandWinner: null,
    ...overrides,
  };
}

function createEngine(overrides?: {
  sanitized?: SanitizedMatchState;
  hand?: Tile[];
  playerIndex?: number;
}) {
  const sanitized = overrides?.sanitized ?? makeSanitized();
  const hand = overrides?.hand ?? makeHand(10);
  const playerIndex = overrides?.playerIndex ?? 0;
  const sent: WsClientMessage[] = [];
  const send = (msg: WsClientMessage) => sent.push(msg);
  const engine = new WsGameEngine(sanitized, hand, playerIndex, send);
  return { engine, sent };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WsGameEngine", () => {
  describe("constructor and getters", () => {
    it("exposes playerIndex from constructor", () => {
      const { engine } = createEngine({ playerIndex: 2 });
      expect(engine.playerIndex).toBe(2);
    });

    it("exposes hand from constructor", () => {
      const hand = makeHand(5);
      const { engine } = createEngine({ hand });
      expect(engine.hand).toBe(hand);
      expect(engine.hand).toHaveLength(5);
    });
  });

  describe("state getter converts SanitizedMatchState → MatchState", () => {
    it("converts basic fields correctly", () => {
      const sanitized = makeSanitized({
        matchId: "conv-match",
        currentTurn: 2,
        scores: [50, 30],
        roundNumber: 3,
        poolCount: 10,
        status: "in_progress",
        targetScore: 200,
        consecutiveNullRounds: 1,
        lastHandWinner: 1,
        turnDeadline: 1234567890,
      });
      const hand = makeHand(10);
      const { engine } = createEngine({ sanitized, hand });

      const state: MatchState = engine.state;
      expect(state.matchId).toBe("conv-match");
      expect(state.turn.currentTurn).toBe(2);
      expect(state.scores.scores).toEqual([50, 30]);
      expect(state.turn.roundNumber).toBe(3);
      expect(state.poolCount).toBe(10);
      expect(state.status).toBe("in_progress");
      expect(state.targetScore).toBe(200);
      expect(state.turn.consecutiveNullRounds).toBe(1);
      expect(state.turn.lastHandWinner).toBe(1);
      expect(state.turn.turnDeadline).toBe(1234567890);
    });

    it("uses _hand for player 0's hand, empty arrays for opponents", () => {
      const hand = makeHand(8);
      const { engine } = createEngine({ hand, playerIndex: 0 });

      const state = engine.state;
      expect(state.players[0].hand).toBe(hand);
      expect(state.players[0].hand).toHaveLength(8);
      expect(state.players[1].hand).toEqual([]);
      expect(state.players[2].hand).toEqual([]);
      expect(state.players[3].hand).toEqual([]);
    });

    it("uses _hand for the configured playerIndex", () => {
      const hand = makeHand(7);
      const { engine } = createEngine({ hand, playerIndex: 2 });

      const state = engine.state;
      expect(state.players[0].hand).toEqual([]);
      expect(state.players[1].hand).toEqual([]);
      expect(state.players[2].hand).toBe(hand);
      expect(state.players[3].hand).toEqual([]);
    });

    it("converts player IDs from sanitized format", () => {
      const { engine } = createEngine();
      const state = engine.state;
      expect(state.players[0].id).toBe(PLAYER_ID);
      expect(state.players[1].id).toBe("player-1");
    });

    it("returns empty pool array (server-only)", () => {
      const { engine } = createEngine();
      const state = engine.state;
      expect(state.pool).toEqual([]);
    });

    it("converts board correctly", () => {
      const tile: Tile = { top: 3, bottom: 5, id: "t1" };
      const sanitized = makeSanitized({
        board: {
          leftEnd: 3,
          rightEnd: 5,
          tiles: [{ tile, side: "left", playerId: "player-1" }],
        },
      });
      const { engine } = createEngine({ sanitized });
      const state = engine.state;
      expect(state.board.leftEnd).toBe(3);
      expect(state.board.rightEnd).toBe(5);
      expect(state.board.tiles).toHaveLength(1);
      expect(state.board.tiles[0].tile.id).toBe("t1");
    });
  });

  describe("playTile", () => {
    it("sends play_tile WS message with tileId and side", () => {
      const { engine, sent } = createEngine();
      engine.playTile("tile-3", "right");
      expect(sent).toHaveLength(1);
      expect(sent[0]).toEqual({ type: "play_tile", tileId: "tile-3", side: "right" });
    });

    it("optimistically removes tile from hand", () => {
      const hand = makeHand(10);
      const { engine } = createEngine({ hand });
      expect(engine.hand).toHaveLength(10);

      engine.playTile("tile-0", "left");
      expect(engine.hand).toHaveLength(9);
      expect(engine.hand.some((t) => t.id === "tile-0")).toBe(false);
    });

    it("returns events array and match state", () => {
      const { engine } = createEngine();
      const result = engine.playTile("tile-0", "left");
      expect(result.events).toEqual([]);
      expect(result.match).toBeDefined();
      expect(result.match.matchId).toBe("test-match");
    });

    it("returned match reflects the updated hand", () => {
      const hand = makeHand(10);
      const { engine } = createEngine({ hand });
      const result = engine.playTile("tile-5", "right");
      expect(result.match.players[0].hand).toHaveLength(9);
    });
  });

  describe("pass", () => {
    it("sends pass WS message", () => {
      const { engine, sent } = createEngine();
      engine.pass();
      expect(sent).toHaveLength(1);
      expect(sent[0]).toEqual({ type: "pass" });
    });

    it("does not modify hand", () => {
      const hand = makeHand(10);
      const { engine } = createEngine({ hand });
      engine.pass();
      expect(engine.hand).toHaveLength(10);
    });

    it("returns events array and match state", () => {
      const { engine } = createEngine();
      const result = engine.pass();
      expect(result.events).toEqual([]);
      expect(result.match).toBeDefined();
    });
  });

  describe("processBotTurns", () => {
    it("returns current state as MatchState (no-op)", () => {
      const { engine } = createEngine();
      const stateBefore = engine.state;
      const result = engine.processBotTurns();
      expect(result.matchId).toBe(stateBefore.matchId);
      expect(result.turn.currentTurn).toBe(stateBefore.turn.currentTurn);
    });

    it("does not send any WS messages", () => {
      const { engine, sent } = createEngine();
      engine.processBotTurns();
      expect(sent).toHaveLength(0);
    });
  });

  describe("applyState", () => {
    it("updates the sanitized state", () => {
      const { engine } = createEngine();
      expect(engine.state.matchId).toBe("test-match");

      const newSanitized = makeSanitized({ matchId: "updated-match", currentTurn: 1 });
      engine.applyState(newSanitized);
      expect(engine.state.matchId).toBe("updated-match");
      expect(engine.state.turn.currentTurn).toBe(1);
    });

    it("updates hand when yourHand is provided", () => {
      const hand = makeHand(10);
      const { engine } = createEngine({ hand });
      expect(engine.hand).toHaveLength(10);

      const newHand = makeHand(5);
      engine.applyState(makeSanitized(), newHand);
      expect(engine.hand).toHaveLength(5);
      expect(engine.hand).toBe(newHand);
    });

    it("does not update hand when yourHand is omitted", () => {
      const hand = makeHand(10);
      const { engine } = createEngine({ hand });
      engine.applyState(makeSanitized());
      expect(engine.hand).toBe(hand);
      expect(engine.hand).toHaveLength(10);
    });

    it("updates playerIndex when provided", () => {
      const { engine } = createEngine();
      expect(engine.playerIndex).toBe(0);

      engine.applyState(makeSanitized(), undefined, 2);
      expect(engine.playerIndex).toBe(2);
    });

    it("does not update playerIndex when omitted", () => {
      const { engine } = createEngine();
      expect(engine.playerIndex).toBe(0);

      engine.applyState(makeSanitized());
      expect(engine.playerIndex).toBe(0);
    });
  });

  describe("destroy", () => {
    it("is a no-op (does not throw)", () => {
      const { engine } = createEngine();
      expect(() => engine.destroy()).not.toThrow();
    });
  });
});
