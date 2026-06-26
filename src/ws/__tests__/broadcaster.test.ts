import { describe, expect, it, vi } from "bun:test";
import type { SanitizedMatchState } from "../../game/handler";
import type { GameEvent } from "../../game/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const MATCH_ID = "test-match";
const ALL_PLAYER_IDS = ["1", "2", "3", "4"];

function makeSanitizedState(
  overrides?: Partial<SanitizedMatchState>,
): SanitizedMatchState {
  return {
    matchId: MATCH_ID,
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

// Factory functions for each event type
function makeGameError(): GameEvent {
  return {
    type: "game_error",
    code: "INVALID_MOVE",
    message: "Cannot play here",
  };
}

function makeRoundStarted(): GameEvent {
  return { type: "round_started", firstPlayer: 0 };
}

function makeTilePlayed(playerId = "1"): GameEvent {
  return {
    type: "tile_played",
    playerId,
    tileId: "t1",
    side: "left",
    board: { leftEnd: 5, rightEnd: 3, tiles: [] },
  };
}

function makePlayerPassed(playerId = "1"): GameEvent {
  return { type: "player_passed", playerId };
}

function makeTurnTimeout(playerId = "1"): GameEvent {
  return { type: "turn_timeout", playerId, forcedPass: true };
}

function makeHandEnded(): GameEvent {
  return { type: "hand_ended", winner: 0, reason: "empty_hand" };
}

function makeHandScored(): GameEvent {
  return { type: "hand_scored", winningPair: 0, points: 30, scores: [30, 0] };
}

function makeMatchEnded(): GameEvent {
  return {
    type: "match_ended",
    winner: 0,
    finalScores: [200, 150],
    reason: "reached_target",
  };
}

function makePlayerDisconnected(playerId = "1"): GameEvent {
  return { type: "player_disconnected", playerId, reconnectWindowMs: 30_000 };
}

function makePlayerReconnected(playerId = "1"): GameEvent {
  return { type: "player_reconnected", playerId };
}

function makeReconnectionWindowExpiring(playerId = "1"): GameEvent {
  return { type: "reconnection_window_expiring", playerId, secondsLeft: 10 };
}

function makeMatchAbandoned(playerId = "1"): GameEvent {
  return {
    type: "match_abandoned",
    disconnectedPlayerId: playerId,
    reason: "abandonment",
  };
}

// ---------------------------------------------------------------------------
// Import SUT — will fail until broadcaster.ts is created
// ---------------------------------------------------------------------------

import type { WsServerMessage } from "../broadcaster";
import { broadcastEvents, sendState } from "../broadcaster";

// ---------------------------------------------------------------------------
// broadcastEvents — game_error routing (private)
// ---------------------------------------------------------------------------

describe("broadcastEvents", () => {
  describe("game_error routing (private to actingPlayerId)", () => {
    it("sends game_error only to actingPlayerId", () => {
      const sendFn = vi.fn();
      const event = makeGameError();

      broadcastEvents([event], MATCH_ID, "1", sendFn);

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith("1", {
        type: "game_events",
        events: [event],
      });
    });

    it("does not send game_error to other players", () => {
      const sendFn = vi.fn();
      const event = makeGameError();

      broadcastEvents([event], MATCH_ID, "2", sendFn);

      const calledPlayerIds = sendFn.mock.calls.map(
        (c: readonly unknown[]) => c[0],
      );
      expect(calledPlayerIds).toEqual(["2"]);
    });
  });

  // ---------------------------------------------------------------------------
  // broadcastEvents — broadcast routing (all other event types)
  // ---------------------------------------------------------------------------

  describe("broadcast routing (all 11 non-error event types)", () => {
    const broadcastCases: Array<{
      name: string;
      eventFactory: () => GameEvent;
    }> = [
      { name: "round_started", eventFactory: makeRoundStarted },
      { name: "tile_played", eventFactory: makeTilePlayed },
      { name: "player_passed", eventFactory: makePlayerPassed },
      { name: "turn_timeout", eventFactory: makeTurnTimeout },
      { name: "hand_ended", eventFactory: makeHandEnded },
      { name: "hand_scored", eventFactory: makeHandScored },
      { name: "match_ended", eventFactory: makeMatchEnded },
      { name: "player_disconnected", eventFactory: makePlayerDisconnected },
      { name: "player_reconnected", eventFactory: makePlayerReconnected },
      {
        name: "reconnection_window_expiring",
        eventFactory: makeReconnectionWindowExpiring,
      },
      { name: "match_abandoned", eventFactory: makeMatchAbandoned },
    ];

    for (const { name, eventFactory } of broadcastCases) {
      it(`${name} is sent to all 4 players`, () => {
        const sendFn = vi.fn();
        const event = eventFactory();

        broadcastEvents([event], MATCH_ID, "1", sendFn);

        expect(sendFn).toHaveBeenCalledTimes(4);
        const calledPlayerIds = sendFn.mock.calls.map(
          (c: readonly unknown[]) => c[0],
        );
        expect(calledPlayerIds).toEqual(ALL_PLAYER_IDS);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // broadcastEvents — state attachment
  // ---------------------------------------------------------------------------

  describe("state attachment", () => {
    it("includes state in envelope when provided", () => {
      const sendFn = vi.fn();
      const event = makeTilePlayed();
      const state = makeSanitizedState();

      broadcastEvents([event], MATCH_ID, "1", sendFn, undefined, state);

      expect(sendFn).toHaveBeenCalledTimes(4);
      const envelope = sendFn.mock.calls[0][1] as WsServerMessage;
      expect(envelope).toHaveProperty("state");
      expect(envelope.state).toEqual(state);
    });

    it("omits state field when undefined", () => {
      const sendFn = vi.fn();
      const event = makeTilePlayed();

      broadcastEvents([event], MATCH_ID, "1", sendFn);

      const envelope = sendFn.mock.calls[0][1] as WsServerMessage;
      expect(envelope).not.toHaveProperty("state");
    });
  });

  // ---------------------------------------------------------------------------
  // broadcastEvents — edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("empty events array calls sendFn zero times", () => {
      const sendFn = vi.fn();

      broadcastEvents([], MATCH_ID, "1", sendFn);

      expect(sendFn).not.toHaveBeenCalled();
    });

    it("multiple events in one call — each distributed independently", () => {
      const sendFn = vi.fn();
      const tileEvent = makeTilePlayed();
      const errorEvent = makeGameError();

      broadcastEvents([tileEvent, errorEvent], MATCH_ID, "1", sendFn);

      // tile_played → 4 calls, game_error → 1 call = 5 total
      expect(sendFn).toHaveBeenCalledTimes(5);
    });

    it("playerIds override limits recipients to specified IDs", () => {
      const sendFn = vi.fn();
      const event = makePlayerPassed();

      broadcastEvents([event], MATCH_ID, "1", sendFn, ["1", "3"]);

      expect(sendFn).toHaveBeenCalledTimes(2);
      const calledPlayerIds = sendFn.mock.calls.map(
        (c: readonly unknown[]) => c[0],
      );
      expect(calledPlayerIds).toEqual(["1", "3"]);
    });

    it("sendFn error is caught and doesn't crash, remaining recipients still receive", () => {
      const sendFn = vi.fn((playerId: string) => {
        if (playerId === "2") {
          throw new Error("send failed");
        }
      });
      const event = makeTilePlayed();

      broadcastEvents([event], MATCH_ID, "1", sendFn);

      // Should still call sendFn for all 4 players (error caught)
      expect(sendFn).toHaveBeenCalledTimes(4);
      const calledPlayerIds = sendFn.mock.calls.map(
        (c: readonly unknown[]) => c[0],
      );
      expect(calledPlayerIds).toEqual(ALL_PLAYER_IDS);
    });

    it("game_error with playerIds override still only sends to actingPlayerId", () => {
      const sendFn = vi.fn();
      const event = makeGameError();

      broadcastEvents([event], MATCH_ID, "1", sendFn, ["1", "2", "3", "4"]);

      // game_error always routes to actingPlayerId regardless of playerIds override
      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ type: "game_events" }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // broadcastEvents — message format
  // ---------------------------------------------------------------------------

  describe("message format", () => {
    it("each recipient receives a WsServerMessage envelope with type game_events", () => {
      const sendFn = vi.fn();
      const event = makeTilePlayed();

      broadcastEvents([event], MATCH_ID, "1", sendFn);

      for (const call of sendFn.mock.calls) {
        const envelope = call[1] as WsServerMessage;
        expect(envelope.type).toBe("game_events");
        expect(envelope.events).toContainEqual(event);
      }
    });

    it("game_error recipient receives the event in an array", () => {
      const sendFn = vi.fn();
      const event = makeGameError();

      broadcastEvents([event], MATCH_ID, "1", sendFn);

      const envelope = sendFn.mock.calls[0][1] as WsServerMessage;
      expect(envelope.events).toHaveLength(1);
      expect(envelope.events[0]).toEqual(event);
    });
  });

  // ---------------------------------------------------------------------------
  // sendState
  // ---------------------------------------------------------------------------

  describe("sendState", () => {
    it("sends to correct playerId", () => {
      const sendFn = vi.fn();
      const state = makeSanitizedState();

      sendState("2", state, sendFn);

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith("2", expect.anything());
    });

    it("message format is { type: game_events, events: [], state: SanitizedMatchState }", () => {
      const sendFn = vi.fn();
      const state = makeSanitizedState();

      sendState("p2", state, sendFn);

      const envelope = sendFn.mock.calls[0][1] as WsServerMessage;
      expect(envelope).toEqual({
        type: "game_events",
        events: [],
        state,
      });
    });

    it("does not call sendFn for other players", () => {
      const sendFn = vi.fn();
      const state = makeSanitizedState();

      sendState("1", state, sendFn);

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn.mock.calls[0][0]).toBe("1");
    });
  });
});
