import { describe, expect, it } from "bun:test";
import type { Tile, WsServerMessage } from "../../ws";

// ---------------------------------------------------------------------------
// Tests — WsServerMessage yourHand field
// ---------------------------------------------------------------------------

describe("WsServerMessage — yourHand field", () => {
  it("accepts yourHand as optional Tile array", () => {
    const hand: Tile[] = [
      { top: 3, bottom: 4, id: "t1" },
      { top: 5, bottom: 6, id: "t2" },
    ];
    const msg: WsServerMessage = {
      type: "game_events",
      events: [],
      yourHand: hand,
    };

    expect(msg.yourHand).toHaveLength(2);
    expect(msg.yourHand?.[0].id).toBe("t1");
    expect(msg.yourHand?.[1].id).toBe("t2");
  });

  it("omits yourHand when not provided", () => {
    const msg: WsServerMessage = {
      type: "game_events",
      events: [],
    };

    expect(msg.yourHand).toBeUndefined();
  });

  it("accepts empty yourHand array", () => {
    const msg: WsServerMessage = {
      type: "game_events",
      events: [],
      yourHand: [],
    };

    expect(msg.yourHand).toEqual([]);
  });

  it("backward compatible — existing fields unchanged", () => {
    const msg: WsServerMessage = {
      type: "game_events",
      events: [{ type: "player_passed", playerId: "p1" }],
      state: {
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
      },
    };

    expect(msg.type).toBe("game_events");
    expect(msg.events).toHaveLength(1);
    expect(msg.state).toBeDefined();
  });
});
