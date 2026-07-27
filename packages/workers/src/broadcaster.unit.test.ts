import { describe, it, expect, vi, beforeEach } from "vitest";
import { broadcastEvents, sendHand } from "./broadcaster";
import type { GameEvent, SanitizedMatchState, Tile } from "@domino/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockWs() {
  const sent: string[] = [];
  return {
    sent,
    send(data: string) {
      sent.push(data);
    },
  };
}

function createMockWebSockets(tags: string[]) {
  const sockets = tags.map((tag) => ({
    ws: createMockWs(),
    tag,
  }));
  const getWebSockets = () => sockets.map((s) => s.ws as unknown as WebSocket);
  const getTags = (_ws: WebSocket) => {
    const match = sockets.find((s) => s.ws === _ws);
    return match ? [match.tag] : [];
  };
  return { sockets, getWebSockets, getTags };
}

function parseSent<T = Record<string, unknown>>(mockWs: { sent: string[] }, index = 0): T {
  return JSON.parse(mockWs.sent[index]) as T;
}

// ---------------------------------------------------------------------------
// broadcastEvents
// ---------------------------------------------------------------------------

describe("broadcastEvents", () => {
  it("routes game_error only to acting player", () => {
    const { sockets, getWebSockets, getTags } = createMockWebSockets([
      "u1",
      "u2",
      "u3",
      "u4",
    ]);

    const errorEvent: GameEvent = {
      type: "game_error",
      code: "NOT_YOUR_TURN",
      message: "It is not your turn",
    };

    broadcastEvents([errorEvent], getWebSockets, getTags, "m1", "u2");

    // u2 (acting player) receives the error
    expect(sockets[0].ws.sent).toHaveLength(0); // u1
    expect(sockets[1].ws.sent).toHaveLength(1); // u2
    expect(sockets[2].ws.sent).toHaveLength(0); // u3
    expect(sockets[3].ws.sent).toHaveLength(0); // u4

    const msg = parseSent(sockets[1].ws);
    expect(msg.type).toBe("game_events");
    expect(msg.events).toHaveLength(1);
    expect(msg.events[0].type).toBe("game_error");
  });

  it("routes non-error events to all players", () => {
    const { sockets, getWebSockets, getTags } = createMockWebSockets([
      "u1",
      "u2",
      "u3",
      "u4",
    ]);

    const tilePlayed: GameEvent = {
      type: "tile_played",
      playerId: "u1",
      tileId: "t1",
      side: "left",
      board: { leftEnd: 5, rightEnd: null, tiles: [] },
    };

    broadcastEvents([tilePlayed], getWebSockets, getTags, "m1", "u1");

    // All4 players receive the event
    for (let i = 0; i < 4; i++) {
      expect(sockets[i].ws.sent).toHaveLength(1);
      const msg = parseSent(sockets[i].ws);
      expect(msg.events[0].type).toBe("tile_played");
    }
  });

  it("includes sanitized state when provided", () => {
    const { sockets, getWebSockets, getTags } = createMockWebSockets([
      "u1",
      "u2",
    ]);

    const event: GameEvent = {
      type: "player_passed",
      playerId: "u1",
    };

    const state: SanitizedMatchState = {
      matchId: "m1",
      players: [],
      board: { leftEnd: null, rightEnd: null, tiles: [] },
      currentTurn: 0,
      scores: [0, 0],
      roundNumber: 0,
      poolCount: 15,
      status: "in_progress",
      targetScore: 200,
      turnDeadline: null,
      consecutiveNullRounds: 0,
      lastHandWinner: null,
      avatarUrls: ["", "", "", ""],
    };

    broadcastEvents([event], getWebSockets, getTags, "m1", "u1", state);

    const msg = parseSent(sockets[1].ws);
    expect(msg.state).toBeDefined();
    expect(msg.state.matchId).toBe("m1");
  });

  it("no-ops on empty events array", () => {
    const { sockets, getWebSockets, getTags } = createMockWebSockets([
      "u1",
      "u2",
    ]);

    broadcastEvents([], getWebSockets, getTags, "m1", "u1");

    expect(sockets[0].ws.sent).toHaveLength(0);
    expect(sockets[1].ws.sent).toHaveLength(0);
  });

  it("no-ops when no sockets exist", () => {
    const getWebSockets = () => [];
    const getTags = () => [];

    // Should not throw
    broadcastEvents(
      [{ type: "player_passed", playerId: "u1" }],
      getWebSockets,
      getTags,
      "m1",
      "u1",
    );
  });
});

// ---------------------------------------------------------------------------
// sendHand
// ---------------------------------------------------------------------------

describe("sendHand", () => {
  it("sends hand tiles to the targeted player only", () => {
    const { sockets, getWebSockets, getTags } = createMockWebSockets([
      "u1",
      "u2",
      "u3",
    ]);

    const hand: Tile[] = [
      { top: 1, bottom: 2, id: "t1" },
      { top: 3, bottom: 4, id: "t2" },
    ];

    sendHand("u2", hand, getWebSockets, getTags);

    expect(sockets[0].ws.sent).toHaveLength(0);
    expect(sockets[1].ws.sent).toHaveLength(1);
    expect(sockets[2].ws.sent).toHaveLength(0);

    const msg = parseSent(sockets[1].ws);
    expect(msg.type).toBe("game_events");
    expect(msg.yourHand).toHaveLength(2);
    expect(msg.yourHand[0].id).toBe("t1");
  });

  it("no-ops when target player not connected", () => {
    const { sockets, getWebSockets, getTags } = createMockWebSockets([
      "u1",
      "u2",
    ]);

    sendHand("u99", [{ top: 0, bottom: 0, id: "t0" }], getWebSockets, getTags);

    expect(sockets[0].ws.sent).toHaveLength(0);
    expect(sockets[1].ws.sent).toHaveLength(0);
  });
});
