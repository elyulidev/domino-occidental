import { describe, expect, it, vi } from "bun:test";
import type { GameStore, MatchState, PlayerState } from "@domino/shared";
import { createWsPlugin } from "../connection";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePlayer(id: string, hand: Array<{ id: string; top: number; bottom: number }>): PlayerState {
  return {
    id,
    hand,
    consecutivePasses: 0,
    isConnected: true,
    lastActionAt: new Date(),
  };
}

function makeMatch(): MatchState {
  return {
    matchId: "match-1",
    players: [
      makePlayer("p1", [
        { id: "t1", top: 3, bottom: 4 },
        { id: "t2", top: 5, bottom: 6 },
      ]),
      makePlayer("p2", [{ id: "t3", top: 1, bottom: 2 }]),
      makePlayer("p3", []),
      makePlayer("p4", [
        { id: "t4", top: 7, bottom: 8 },
        { id: "t5", top: 9, bottom: 9 },
        { id: "t6", top: 0, bottom: 1 },
      ]),
    ],
    board: { leftEnd: null, rightEnd: null, tiles: [] },
    turn: {
      currentTurn: 0,
      turnDeadline: null,
      consecutiveNullRounds: 0,
      roundNumber: 0,
      lastHandWinner: null,
    },
    scores: { scores: [0, 0], isTiebreaker: false },
    pool: [],
    poolCount: 0,
    status: "in_progress",
    targetScore: 200,
  };
}

function makeStore(match: MatchState | null = null): GameStore {
  return {
    getGame: vi.fn(() => match),
    updateGame: vi.fn(),
  };
}

function createMockWs(playerId?: string, matchId?: string) {
  return {
    send: vi.fn(),
    subscribe: vi.fn(),
    publish: vi.fn(),
    data: {
      params: {
        matchId: matchId ?? "match-1",
        playerId: playerId ?? "p1",
      },
      playerId: playerId ?? "p1",
      matchId: matchId ?? "match-1",
    },
    close: vi.fn(),
    remoteAddress: "127.0.0.1",
  };
}

// ---------------------------------------------------------------------------
// Tests — open handler populates yourHand
// ---------------------------------------------------------------------------

describe("open handler — yourHand population", () => {
  it("includes yourHand with player's hand tiles on first join (no auth)", () => {
    const match = makeMatch();
    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.ws.open(ws as unknown as Parameters<typeof plugin.ws.open>[0]);

    // The open handler should have sent a message with yourHand
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe("game_events");
    expect(sent.yourHand).toBeDefined();
    expect(sent.yourHand).toHaveLength(2);
    expect(sent.yourHand[0].id).toBe("t1");
    expect(sent.yourHand[1].id).toBe("t2");
  });

  it("includes yourHand with correct tiles for p2", () => {
    const match = makeMatch();
    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p2", "match-1");
    plugin.ws.open(ws as unknown as Parameters<typeof plugin.ws.open>[0]);

    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.yourHand).toHaveLength(1);
    expect(sent.yourHand[0].id).toBe("t3");
  });

  it("includes yourHand as empty array for p3 (no tiles)", () => {
    const match = makeMatch();
    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p3", "match-1");
    plugin.ws.open(ws as unknown as Parameters<typeof plugin.ws.open>[0]);

    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.yourHand).toEqual([]);
  });

  it("includes yourHand with 3 tiles for p4", () => {
    const match = makeMatch();
    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p4", "match-1");
    plugin.ws.open(ws as unknown as Parameters<typeof plugin.ws.open>[0]);

    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.yourHand).toHaveLength(3);
    expect(sent.yourHand.map((t: { id: string }) => t.id)).toEqual(["t4", "t5", "t6"]);
  });

  it("does NOT send yourHand when match is not found", () => {
    const plugin = createWsPlugin({
      store: makeStore(null),
      disconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
      reconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.ws.open(ws as unknown as Parameters<typeof plugin.ws.open>[0]);

    // No message should be sent when match is null
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("includes state along with yourHand", () => {
    const match = makeMatch();
    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.ws.open(ws as unknown as Parameters<typeof plugin.ws.open>[0]);

    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.state).toBeDefined();
    expect(sent.state.matchId).toBe("match-1");
    expect(sent.yourHand).toHaveLength(2);
  });

  it("includes yourHand on reconnect as well", () => {
    const match = makeMatch();
    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({
        match,
        events: [{ type: "player_reconnected", playerId: "p1" }],
      })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.ws.open(ws as unknown as Parameters<typeof plugin.ws.open>[0]);

    // Should still send yourHand even on reconnect
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.yourHand).toHaveLength(2);
    expect(sent.yourHand[0].id).toBe("t1");
  });

  it("includes yourHand with auth path", () => {
    const match = makeMatch();
    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
      verifyToken: vi.fn(() => ({ userId: "p1" })),
    });

    const ws = {
      send: vi.fn(),
      subscribe: vi.fn(),
      publish: vi.fn(),
      data: { params: { matchId: "match-1" }, matchId: "match-1", query: { token: "valid-token" } },
      close: vi.fn(),
      remoteAddress: "127.0.0.1",
    };

    plugin.ws.open(ws as unknown as Parameters<typeof plugin.ws.open>[0]);

    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.yourHand).toHaveLength(2);
    expect(sent.yourHand[0].id).toBe("t1");
  });
});
