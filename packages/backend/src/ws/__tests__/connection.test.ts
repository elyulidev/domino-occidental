import { describe, expect, it, vi } from "bun:test";
import type { MessageResult, SanitizedMatchState, WsClientMessage, WsServerMessage } from "@domino/shared";
import type { ConnectionManager, WsPlugin } from "../connection";
import {
  createConnectionManager,
  createWsPlugin,
  sendToPlayer,
} from "../connection";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockWs(playerId?: string, matchId?: string) {
  const pid = playerId ?? "p1";
  const mid = matchId ?? "match-1";
  return {
    send: vi.fn(),
    subscribe: vi.fn(),
    publish: vi.fn(),
    data: {
      params: { matchId: mid, playerId: pid },
      playerId: pid,
      matchId: mid,
      query: {},
    },
    close: vi.fn(),
    remoteAddress: "127.0.0.1",
  };
}

function makeSanitizedState(
  overrides?: Partial<SanitizedMatchState>,
): SanitizedMatchState {
  return {
    matchId: "test-match",
    players: [
      { id: "1", handSize: 10, isConnected: true },
      { id: "2", handSize: 10, isConnected: true },
      { id: "3", handSize: 10, isConnected: true },
      { id: "4", handSize: 10, isConnected: true },
    ],
    board: { leftEnd: null, rightEnd: null, tiles: [] },
    currentTurn: 0,
    scores: [0, 0],
    roundNumber: 0,
    poolCount: 15,
    status: "in_progress",
    targetScore: 200,
    ...overrides,
  };
}

function makeMessageResult(overrides?: Partial<MessageResult>): MessageResult {
  return {
    events: [{ type: "player_passed", playerId: "1" }],
    ...overrides,
  };
}

function makeMatch() {
  const now = new Date();
  return {
    matchId: "match-1",
    players: [
      {
        id: "p1",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: now,
      },
      {
        id: "p2",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: now,
      },
      {
        id: "p3",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: now,
      },
      {
        id: "p4",
        hand: [],
        consecutivePasses: 0,
        isConnected: true,
        lastActionAt: now,
      },
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

function makeStore(
  match: ReturnType<typeof makeMatch> | null = null,
): GameStore {
  return {
    getGame: vi.fn(() => match),
    updateGame: vi.fn(),
  };
}

function getHandler(plugin: WsPlugin, _event: "open" | "message" | "close") {
  return plugin.ws as unknown as Record<
    string,
    (...args: unknown[]) => void
  >;
}

// ---------------------------------------------------------------------------
// ConnectionMap
// ---------------------------------------------------------------------------

describe("ConnectionMap", () => {
  it("register adds connection, getConnection retrieves it", () => {
    const manager = createConnectionManager();
    const ws = createMockWs();

    manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    expect(manager.getConnection("p1")).toBe(ws);
  });

  it("unregister removes connection", () => {
    const manager = createConnectionManager();
    const ws = createMockWs();

    manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );
    manager.unregister("p1");

    expect(manager.getConnection("p1")).toBeUndefined();
  });

  it("multiple connections are independent", () => {
    const manager = createConnectionManager();
    const ws1 = createMockWs("p1");
    const ws2 = createMockWs("p2");
    const wsType = ws1 as unknown as Parameters<
      ConnectionManager["register"]
    >[2];

    manager.register("match-1", "p1", wsType);
    manager.register(
      "match-1",
      "p2",
      ws2 as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    expect(manager.getConnection("p1")).toBe(ws1);
    expect(manager.getConnection("p2")).toBe(ws2);

    manager.unregister("p1");

    expect(manager.getConnection("p1")).toBeUndefined();
    expect(manager.getConnection("p2")).toBe(ws2);
  });

  it("re-register updates existing entry (reconnect)", () => {
    const manager = createConnectionManager();
    const wsOld = createMockWs("p1");
    const wsNew = createMockWs("p1");
    const wsType = wsOld as unknown as Parameters<
      ConnectionManager["register"]
    >[2];

    manager.register("match-1", "p1", wsType);
    manager.register(
      "match-1",
      "p1",
      wsNew as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    expect(manager.getConnection("p1")).toBe(wsNew);
  });
});

// ---------------------------------------------------------------------------
// sendToPlayer
// ---------------------------------------------------------------------------

describe("sendToPlayer", () => {
  it("calls ws.send with JSON-stringified WsServerMessage", () => {
    const manager = createConnectionManager();
    const ws = createMockWs("p1");
    manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const event: WsServerMessage = {
      type: "game_events",
      events: [{ type: "player_passed", playerId: "p1" }],
    };

    sendToPlayer(manager, "p1", event);

    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(event));
  });

  it("silently no-ops for unknown playerId", () => {
    const manager = createConnectionManager();

    const event: WsServerMessage = {
      type: "game_events",
      events: [{ type: "player_passed", playerId: "unknown" }],
    };

    // Should not throw
    sendToPlayer(manager, "unknown", event);
  });

  it("sends correct envelope format with state", () => {
    const manager = createConnectionManager();
    const ws = createMockWs("p1");
    manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const state = makeSanitizedState();
    const event: WsServerMessage = {
      type: "game_events",
      events: [
        {
          type: "tile_played",
          playerId: "p1",
          tileId: "t1",
          side: "left",
          board: { leftEnd: 5, rightEnd: null, tiles: [] },
        },
      ],
      state,
    };

    sendToPlayer(manager, "p1", event);

    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe("game_events");
    expect(sent.state).toEqual(state);
    expect(sent.events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// wsPlugin — close handler
// ---------------------------------------------------------------------------

describe("wsPlugin close handler", () => {
  it("calls unregister on close", () => {
    const match = makeMatch();
    const mockDisconnectPlayer = vi.fn(() => ({
      match,
      events: [],
    }));

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: mockDisconnectPlayer,
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "close");
    handlers.close({ data: ws.data });

    expect(plugin.manager.getConnection("p1")).toBeUndefined();
  });

  it("calls disconnectPlayer on close", () => {
    const match = makeMatch();
    const mockDisconnectPlayer = vi.fn(() => ({
      match,
      events: [],
    }));

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: mockDisconnectPlayer,
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "close");
    handlers.close({ data: ws.data });

    expect(mockDisconnectPlayer).toHaveBeenCalledTimes(1);
    expect(mockDisconnectPlayer).toHaveBeenCalledWith(
      expect.anything(),
      "p1",
      expect.any(Date),
    );
  });
});

// ---------------------------------------------------------------------------
// wsPlugin — open handler
// ---------------------------------------------------------------------------

describe("wsPlugin open handler", () => {
  it("calls reconnectPlayer on open", () => {
    const match = makeMatch();
    const mockReconnectPlayer = vi.fn(() => ({
      match,
      events: [],
    }));

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: mockReconnectPlayer,
    });

    const ws = createMockWs("p1", "match-1");
    const handlers = getHandler(plugin, "open");
    handlers.open(ws as unknown as Parameters<typeof handlers.open>[0]);

    expect(plugin.manager.getConnection("p1")).toBe(ws);
    expect(mockReconnectPlayer).toHaveBeenCalledTimes(1);
  });

  it("sends sendState on first join when reconnectPlayer returns 0 events", () => {
    const match = makeMatch();
    const mockReconnectPlayer = vi.fn(() => ({
      match,
      events: [],
    }));
    const mockBroadcastEvents = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: mockReconnectPlayer,
      broadcastEvents: mockBroadcastEvents,
    });

    const ws = createMockWs("p1", "match-1");
    const handlers = getHandler(plugin, "open");
    handlers.open(ws as unknown as Parameters<typeof handlers.open>[0]);

    // sendState should be called: first join delivers full state
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe("game_events");
    expect(sent.state).toBeDefined();
    expect(sent.state.matchId).toBe(match.matchId);
  });

  it("sends sendState on reconnect as well", () => {
    const match = makeMatch();
    const mockReconnectPlayer = vi.fn(() => ({
      match,
      events: [{ type: "player_reconnected", playerId: "p1" }],
    }));
    const mockBroadcastEvents = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: mockReconnectPlayer,
      broadcastEvents: mockBroadcastEvents,
    });

    const ws = createMockWs("p1", "match-1");
    const handlers = getHandler(plugin, "open");
    handlers.open(ws as unknown as Parameters<typeof handlers.open>[0]);

    // sendState should be called even on reconnect
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe("game_events");
    expect(sent.state).toBeDefined();
  });

  it("does NOT send sendState when match is not found", () => {
    const mockReconnectPlayer = vi.fn(() => ({
      match: makeMatch(),
      events: [],
    }));

    const plugin = createWsPlugin({
      store: makeStore(null), // match not found
      disconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
      reconnectPlayer: mockReconnectPlayer,
    });

    const ws = createMockWs("p1", "match-1");
    const handlers = getHandler(plugin, "open");
    handlers.open(ws as unknown as Parameters<typeof handlers.open>[0]);

    // sendState should NOT be called when match is null
    expect(ws.send).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// wsPlugin — message handler
// ---------------------------------------------------------------------------

describe("wsPlugin message handler", () => {
  it("calls handleMessage with correct params", () => {
    const store = makeStore();
    const mockHandleMessage = vi.fn(() => makeMessageResult());

    const plugin = createWsPlugin({
      store,
      handleMessage: mockHandleMessage,
      broadcastEvents: vi.fn(),
      disconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
      reconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "message");
    const msg: WsClientMessage = { type: "pass" };
    handlers.message(ws as unknown, JSON.stringify(msg));

    expect(mockHandleMessage).toHaveBeenCalledWith(store, "match-1", "p1", msg);
  });

  it("calls broadcastEvents with result events", () => {
    const mockHandleMessage = vi.fn(() => makeMessageResult());
    const mockBroadcastEvents = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(),
      handleMessage: mockHandleMessage,
      broadcastEvents: mockBroadcastEvents,
      disconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
      reconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "message");
    handlers.message(ws as unknown, JSON.stringify({ type: "pass" }));

    expect(mockBroadcastEvents).toHaveBeenCalledTimes(1);
    const callArgs = mockBroadcastEvents.mock.calls[0];
    expect(callArgs[0]).toEqual([{ type: "player_passed", playerId: "1" }]);
    expect(callArgs[1]).toBe("match-1");
    expect(callArgs[2]).toBe("p1");
    expect(typeof callArgs[3]).toBe("function");
  });

  it("sends sanitizedState to acting player when present", () => {
    const state = makeSanitizedState();
    const mockHandleMessage = vi.fn(() =>
      makeMessageResult({ sanitizedState: state }),
    );

    const plugin = createWsPlugin({
      store: makeStore(makeMatch()),
      handleMessage: mockHandleMessage,
      disconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
      reconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "message");
    handlers.message(ws as unknown, JSON.stringify({ type: "pass" }));

    // sendToPlayer should have been called for p1 with state
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.state).toEqual(state);
  });

  it("returns game_error on JSON parse error", () => {
    const plugin = createWsPlugin({
      store: makeStore(),
      disconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
      reconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "message");
    handlers.message(ws as unknown, "{invalid json");

    expect(ws.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe("game_events");
    expect(sent.events[0].type).toBe("game_error");
    expect(sent.events[0].code).toBe("INVALID_MESSAGE");
  });
});

// ---------------------------------------------------------------------------
// Integration: play_tile → handleMessage → broadcastEvents
// ---------------------------------------------------------------------------

describe("full message routing", () => {
  it("play_tile routes through handleMessage and broadcastEvents", () => {
    const store = makeStore();
    const result = makeMessageResult({
      events: [
        {
          type: "tile_played",
          playerId: "p1",
          tileId: "t1",
          side: "left",
          board: { leftEnd: 5, rightEnd: null, tiles: [] },
        },
      ],
    });
    const mockHandleMessage = vi.fn(() => result);
    const mockBroadcastEvents = vi.fn();

    const plugin = createWsPlugin({
      store,
      handleMessage: mockHandleMessage,
      broadcastEvents: mockBroadcastEvents,
      disconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
      reconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
    });

    // Register all 4 players on the plugin's internal manager
    const ws1 = createMockWs("p1", "match-1");
    const ws2 = createMockWs("p2", "match-1");
    const ws3 = createMockWs("p3", "match-1");
    const ws4 = createMockWs("p4", "match-1");
    const wsType = ws1 as unknown as Parameters<
      ConnectionManager["register"]
    >[2];
    plugin.manager.register("match-1", "p1", wsType);
    plugin.manager.register(
      "match-1",
      "p2",
      ws2 as unknown as Parameters<ConnectionManager["register"]>[2],
    );
    plugin.manager.register(
      "match-1",
      "p3",
      ws3 as unknown as Parameters<ConnectionManager["register"]>[2],
    );
    plugin.manager.register(
      "match-1",
      "p4",
      ws4 as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "message");
    const msg: WsClientMessage = {
      type: "play_tile",
      tileId: "t1",
      side: "left",
    };
    handlers.message(ws1 as unknown, JSON.stringify(msg));

    expect(mockHandleMessage).toHaveBeenCalledWith(store, "match-1", "p1", msg);
    expect(mockBroadcastEvents).toHaveBeenCalledTimes(1);

    // Verify the sendFn passed to broadcastEvents works
    const sendFn = mockBroadcastEvents.mock.calls[0][3];
    const event: WsServerMessage = {
      type: "game_events",
      events: result.events,
    };
    sendFn("p2", event);
    expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(event));
  });
});

// ---------------------------------------------------------------------------
// wsPlugin — timerManager integration
// ---------------------------------------------------------------------------

describe("wsPlugin timerManager integration", () => {
  it("open hook calls cancelDisconnect when timerManager provided (no auth)", () => {
    const match = makeMatch();
    const mockCancelDisconnect = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
      timerManager: {
        cancelDisconnect: mockCancelDisconnect,
        registerDisconnect: vi.fn(),
        startMatch: vi.fn(),
        stopMatch: vi.fn(),
        stop: vi.fn(),
        getDisconnectRecord: vi.fn(() => null),
      },
    });

    const ws = createMockWs("p1", "match-1");
    const handlers = getHandler(plugin, "open");
    handlers.open(ws as unknown as Parameters<typeof handlers.open>[0]);

    expect(mockCancelDisconnect).toHaveBeenCalledWith("match-1", "p1");
  });

  it("open hook calls cancelDisconnect when timerManager provided (with auth)", () => {
    const match = makeMatch();
    const mockCancelDisconnect = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
      verifyToken: vi.fn(() => ({ userId: "verified-p1" })),
      timerManager: {
        cancelDisconnect: mockCancelDisconnect,
        registerDisconnect: vi.fn(),
        startMatch: vi.fn(),
        stopMatch: vi.fn(),
        stop: vi.fn(),
        getDisconnectRecord: vi.fn(() => null),
      },
    });

    const ws = {
      send: vi.fn(),
      subscribe: vi.fn(),
      publish: vi.fn(),
      data: {
        params: { matchId: "match-1" },
        matchId: "match-1",
        query: { token: "valid-token" },
      },
      close: vi.fn(),
      remoteAddress: "127.0.0.1",
    };

    const handlers = getHandler(plugin, "open");
    handlers.open(ws as unknown as Parameters<typeof handlers.open>[0]);

    expect(mockCancelDisconnect).toHaveBeenCalledWith("match-1", "verified-p1");
  });

  it("close hook calls registerDisconnect when timerManager provided", () => {
    const match = makeMatch();
    const mockRegisterDisconnect = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
      timerManager: {
        cancelDisconnect: vi.fn(),
        registerDisconnect: mockRegisterDisconnect,
        startMatch: vi.fn(),
        stopMatch: vi.fn(),
        stop: vi.fn(),
        getDisconnectRecord: vi.fn(() => null),
      },
    });

    const ws = createMockWs("p1", "match-1");
    plugin.manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "close");
    handlers.close({ data: ws.data });

    expect(mockRegisterDisconnect).toHaveBeenCalledTimes(1);
    expect(mockRegisterDisconnect).toHaveBeenCalledWith(
      "match-1",
      "p1",
      expect.any(Date),
    );
  });

  it("works without timerManager (optional dep)", () => {
    const match = makeMatch();
    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    const handlers = getHandler(plugin, "open");
    handlers.open(ws as unknown as Parameters<typeof handlers.open>[0]);

    const handlersClose = getHandler(plugin, "close");
    handlersClose.close({ data: ws.data });

    // No errors thrown — optional dep is silently ignored
    expect(plugin.manager.getConnection("p1")).toBeUndefined();
  });

  it("startMatch called when 4th player connects via auth path", () => {
    const match = makeMatch();
    const mockStartMatch = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
      verifyToken: vi.fn(() => ({ userId: "u4" })),
      timerManager: {
        cancelDisconnect: vi.fn(),
        registerDisconnect: vi.fn(),
        startMatch: mockStartMatch,
        stopMatch: vi.fn(),
        stop: vi.fn(),
        getDisconnectRecord: vi.fn(() => null),
      },
    });

    // Pre-register 3 players
    const wsType = createMockWs("u1") as unknown as Parameters<
      ConnectionManager["register"]
    >[2];
    plugin.manager.register("match-1", "u1", wsType);
    plugin.manager.register(
      "match-1",
      "u2",
      createMockWs("u2") as unknown as Parameters<
        ConnectionManager["register"]
      >[2],
    );
    plugin.manager.register(
      "match-1",
      "u3",
      createMockWs("u3") as unknown as Parameters<
        ConnectionManager["register"]
      >[2],
    );

    // 4th player connects via auth
    const ws4 = {
      send: vi.fn(),
      subscribe: vi.fn(),
      publish: vi.fn(),
      data: { params: { matchId: "match-1" }, matchId: "match-1", query: { token: "valid-token" } },
      close: vi.fn(),
      remoteAddress: "127.0.0.1",
    };
    const handlers = getHandler(plugin, "open");
    handlers.open(ws4 as unknown as Parameters<typeof handlers.open>[0]);

    expect(mockStartMatch).toHaveBeenCalledTimes(1);
    const calledPlayerIds = mockStartMatch.mock.calls[0][1];
    expect(calledPlayerIds).toHaveLength(4);
    expect(calledPlayerIds).toContain("u1");
    expect(calledPlayerIds).toContain("u2");
    expect(calledPlayerIds).toContain("u3");
    expect(calledPlayerIds).toContain("u4");
  });

  it("startMatch NOT called when only 3 players connected", () => {
    const match = makeMatch();
    const mockStartMatch = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
      verifyToken: vi.fn(() => ({ userId: "u3" })),
      timerManager: {
        cancelDisconnect: vi.fn(),
        registerDisconnect: vi.fn(),
        startMatch: mockStartMatch,
        stopMatch: vi.fn(),
        stop: vi.fn(),
        getDisconnectRecord: vi.fn(() => null),
      },
    });

    // Pre-register 2 players
    const wsType = createMockWs("u1") as unknown as Parameters<
      ConnectionManager["register"]
    >[2];
    plugin.manager.register("match-1", "u1", wsType);
    plugin.manager.register(
      "match-1",
      "u2",
      createMockWs("u2") as unknown as Parameters<
        ConnectionManager["register"]
      >[2],
    );

    // 3rd player connects
    const ws3 = {
      send: vi.fn(),
      subscribe: vi.fn(),
      publish: vi.fn(),
      data: { params: { matchId: "match-1" }, matchId: "match-1", query: { token: "valid-token" } },
      close: vi.fn(),
      remoteAddress: "127.0.0.1",
    };
    const handlers = getHandler(plugin, "open");
    handlers.open(ws3 as unknown as Parameters<typeof handlers.open>[0]);

    expect(mockStartMatch).not.toHaveBeenCalled();
  });

  it("startMatch NOT called on reconnect (already started)", () => {
    const match = makeMatch();
    const mockStartMatch = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
      verifyToken: vi.fn((token: string) => ({ userId: token })),
      timerManager: {
        cancelDisconnect: vi.fn(),
        registerDisconnect: vi.fn(),
        startMatch: mockStartMatch,
        stopMatch: vi.fn(),
        stop: vi.fn(),
        getDisconnectRecord: vi.fn(() => null),
      },
    });

    const handlers = getHandler(plugin, "open");

    // Connect all 4 players via the open handler
    for (let i = 1; i <= 4; i++) {
      const ws = {
        send: vi.fn(),
        subscribe: vi.fn(),
        publish: vi.fn(),
        data: { params: { matchId: "match-1" }, matchId: "match-1", query: { token: `u${i}` } },
        close: vi.fn(),
        remoteAddress: "127.0.0.1",
      };
      handlers.open(ws as unknown as Parameters<typeof handlers.open>[0]);
    }

    // startMatch was called on the 4th connect
    expect(mockStartMatch).toHaveBeenCalledTimes(1);

    // Reset mock to track the reconnect call
    mockStartMatch.mockClear();

    // Now u1 reconnects — should NOT call startMatch again
    const ws1New = {
      send: vi.fn(),
      subscribe: vi.fn(),
      publish: vi.fn(),
      data: { params: { matchId: "match-1" }, matchId: "match-1", query: { token: "u1" } },
      close: vi.fn(),
      remoteAddress: "127.0.0.1",
    };
    handlers.open(ws1New as unknown as Parameters<typeof handlers.open>[0]);

    // startMatch should NOT be called again since match already started
    expect(mockStartMatch).not.toHaveBeenCalled();
  });

  it("getPlayerIdsForMatch returns UUIDs of connected players for a match", () => {
    const plugin = createWsPlugin({
      store: makeStore(makeMatch()),
      disconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
      reconnectPlayer: vi.fn(() => ({ match: makeMatch(), events: [] })),
    });

    const ws1 = createMockWs("u1", "match-1");
    const ws2 = createMockWs("u2", "match-1");
    const ws3 = createMockWs("u3", "match-2");
    const wsType = ws1 as unknown as Parameters<
      ConnectionManager["register"]
    >[2];
    plugin.manager.register("match-1", "u1", wsType);
    plugin.manager.register(
      "match-1",
      "u2",
      ws2 as unknown as Parameters<ConnectionManager["register"]>[2],
    );
    plugin.manager.register(
      "match-2",
      "u3",
      ws3 as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const playerIds = plugin.manager.getPlayerIdsForMatch("match-1");
    expect(playerIds).toEqual(["u1", "u2"]);
  });

  it("broadcastEvents in message handler receives dynamic playerIds from match", () => {
    const match = makeMatch();
    const mockHandleMessage = vi.fn(() => makeMessageResult());
    const mockBroadcastEvents = vi.fn();

    const plugin = createWsPlugin({
      store: makeStore(match),
      handleMessage: mockHandleMessage,
      broadcastEvents: mockBroadcastEvents,
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      reconnectPlayer: vi.fn(() => ({ match, events: [] })),
    });

    const ws = createMockWs("p1", "match-1");
    plugin.manager.register(
      "match-1",
      "p1",
      ws as unknown as Parameters<ConnectionManager["register"]>[2],
    );

    const handlers = getHandler(plugin, "message");
    handlers.message(ws as unknown, JSON.stringify({ type: "pass" }));

    expect(mockBroadcastEvents).toHaveBeenCalledTimes(1);
    const callArgs = mockBroadcastEvents.mock.calls[0];
    // playerIds should be match.players.map(p => p.id)
    expect(callArgs[4]).toEqual(["p1", "p2", "p3", "p4"]);
  });
});
