import { describe, expect, it } from "bun:test";
import { initializeMatch, setConnected, setCurrentTurn } from "@domino/shared/src/game";
import {
  checkAbandonment,
  checkReconnectWindow,
  disconnectPlayer,
  forcePassForDisconnected,
  forfeitMatch,
  reconnectPlayer,
} from "../connection";
import type { BoardState, MatchState, Tile } from "../types";
import {
  ABANDONMENT_THRESHOLD_MS,
  HEARTBEAT_MS,
  RECONNECT_WINDOW_MS,
  TURN_TIMEOUT_MS,
} from "../types";

// Helper to create a basic match for testing
function createTestMatch(): MatchState {
  const hands: [never[], never[], never[], never[]] = [[], [], [], []];
  const { match } = initializeMatch("test-match", hands, []);
  return match;
}

/** Connects all players in a match for tests that need connected players. */
function connectAllPlayers(match: MatchState): MatchState {
  const newPlayers = match.players.map((p) => setConnected(p, true)) as MatchState["players"];
  return { ...match, players: newPlayers };
}

// Helper to create a match with specific hands and turn state
function createMatchWithHands(
  hands: [Tile[], Tile[], Tile[], Tile[]],
  overrides?: { turn?: Partial<MatchState["turn"]>; board?: BoardState },
): MatchState {
  const { match } = initializeMatch("test-match", hands, [], 200);
  let modified = match;
  if (overrides?.board) {
    modified = { ...modified, board: overrides.board };
  }
  if (overrides?.turn) {
    const newTurn = { ...modified.turn, ...overrides.turn };
    modified = { ...modified, turn: newTurn };
  }
  return modified;
}

describe("constants", () => {
  it("HEARTBEAT_MS is 5_000", () => {
    expect(HEARTBEAT_MS).toBe(5_000);
  });

  it("RECONNECT_WINDOW_MS is 10_000", () => {
    expect(RECONNECT_WINDOW_MS).toBe(10_000);
  });

  it("ABANDONMENT_THRESHOLD_MS is 15_000", () => {
    expect(ABANDONMENT_THRESHOLD_MS).toBe(15_000);
  });
});

describe("disconnectPlayer", () => {
  it("disconnects a valid player", () => {
    const match = createTestMatch();
    const now = new Date();
    const result = disconnectPlayer(match, "p0", now);

    expect(result.match.players[0].isConnected).toBe(false);
  });

  it("disconnecting already-disconnected player is no-op", () => {
    const match = createTestMatch();
    const now = new Date();
    const first = disconnectPlayer(match, "p0", now);
    const second = disconnectPlayer(
      first.match,
      "p0",
      new Date(now.getTime() + 1000),
    );

    expect(second.events).toHaveLength(0);
    expect(second.match.players[0].isConnected).toBe(false);
  });

  it("emits player_disconnected with correct reconnectWindowMs", () => {
    const match = connectAllPlayers(createTestMatch());
    const now = new Date();
    const result = disconnectPlayer(match, "p0", now);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "player_disconnected",
      playerId: "p0",
      reconnectWindowMs: RECONNECT_WINDOW_MS,
    });
  });

  it("returns game_error for invalid playerId", () => {
    const match = createTestMatch();
    const now = new Date();
    const result = disconnectPlayer(match, "invalid", now);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "game_error",
      code: "PLAYER_NOT_FOUND",
      message: "Player not found in match",
    });
  });
});

describe("reconnectPlayer", () => {
  it("reconnects a disconnected player", () => {
    const match = createTestMatch();
    const now = new Date();
    const disconnected = disconnectPlayer(match, "p0", now);
    const reconnectResult = reconnectPlayer(
      disconnected.match,
      "p0",
      new Date(now.getTime() + 1000),
    );

    expect(reconnectResult.match.players[0].isConnected).toBe(true);
  });

  it("reconnecting already-connected player is no-op", () => {
    const match = connectAllPlayers(createTestMatch());
    const now = new Date();
    const result = reconnectPlayer(match, "p0", now);

    expect(result.events).toHaveLength(0);
    expect(result.match.players[0].isConnected).toBe(true);
  });

  it("emits player_reconnected event", () => {
    const match = createTestMatch();
    const now = new Date();
    const disconnected = disconnectPlayer(match, "p0", now);
    const reconnectResult = reconnectPlayer(
      disconnected.match,
      "p0",
      new Date(now.getTime() + 1000),
    );

    expect(reconnectResult.events).toHaveLength(1);
    expect(reconnectResult.events[0]).toEqual({
      type: "player_reconnected",
      playerId: "p0",
    });
  });

  it("returns game_error for invalid playerId", () => {
    const match = createTestMatch();
    const now = new Date();
    const result = reconnectPlayer(match, "invalid", now);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "game_error",
      code: "PLAYER_NOT_FOUND",
      message: "Player not found in match",
    });
  });
});

describe("checkReconnectWindow", () => {
  it("within window returns windowExpired: false", () => {
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + 5_000); // 5s elapsed, window is 10s
    const result = checkReconnectWindow(
      { disconnectedAt, playerId: "p0" },
      now,
    );

    expect(result.windowExpired).toBe(false);
    expect(result.secondsLeft).toBe(5);
  });

  it("past window returns windowExpired: true", () => {
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + 11_000); // 11s elapsed, window is 10s
    const result = checkReconnectWindow(
      { disconnectedAt, playerId: "p0" },
      now,
    );

    expect(result.windowExpired).toBe(true);
    expect(result.secondsLeft).toBe(0);
  });

  it("boundary test: exactly at RECONNECT_WINDOW_MS", () => {
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + RECONNECT_WINDOW_MS); // exactly 10s
    const result = checkReconnectWindow(
      { disconnectedAt, playerId: "p0" },
      now,
    );

    expect(result.windowExpired).toBe(true);
    expect(result.secondsLeft).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T5: forcePassForDisconnected
// ---------------------------------------------------------------------------
describe("forcePassForDisconnected", () => {
  it("returns game_error for invalid playerIndex below range", () => {
    const match = createTestMatch();
    const now = new Date();
    // biome-ignore lint/suspicious/noExplicitAny: intentional invalid boundary test
    const result = forcePassForDisconnected(match, -1 as any, now);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "game_error",
      code: "INVALID_PLAYER_INDEX",
      message: "Player index must be 0-3",
    });
  });

  it("returns game_error for invalid playerIndex above range", () => {
    const match = createTestMatch();
    const now = new Date();
    // biome-ignore lint/suspicious/noExplicitAny: intentional invalid boundary test
    const result = forcePassForDisconnected(match, 5 as any, now);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "game_error",
      code: "INVALID_PLAYER_INDEX",
      message: "Player index must be 0-3",
    });
  });

  it("no-op when it is not the player's turn", () => {
    const match = createTestMatch();
    // currentTurn defaults to 0, try to force pass for player 2
    const now = new Date();
    const result = forcePassForDisconnected(match, 2, now);

    expect(result.events).toHaveLength(0);
    expect(result.match).toBe(match); // same reference — no-op
  });

  it("increments passes and advances turn on forced pass", () => {
    // Use hands with tiles so the board is NOT blocked (empty board → any tile playable)
    const tile: Tile = { top: 0, bottom: 1, id: "t1" };
    const hands: [Tile[], Tile[], Tile[], Tile[]] = [
      [tile],
      [{ ...tile, id: "t2" }],
      [{ ...tile, id: "t3" }],
      [{ ...tile, id: "t4" }],
    ];
    const match = createMatchWithHands(hands, {
      turn: { currentTurn: 1, turnDeadline: 100_000 },
    });
    const now = new Date();
    const result = forcePassForDisconnected(match, 1, now);

    // Player 1's passes should be incremented
    expect(result.match.players[1].consecutivePasses).toBe(1);
    // Turn should advance to player 2
    expect(result.match.turn.currentTurn).toBe(2);
    // Should emit only turn_timeout (not blocked)
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "turn_timeout",
      playerId: "p1",
      forcedPass: true,
    });
  });

  it("sets a new turn deadline after advancing", () => {
    const match = createTestMatch();
    const withTurn = {
      ...match,
      turn: setCurrentTurn(match.turn, 0),
    };
    const now = new Date(1000);
    const result = forcePassForDisconnected(withTurn, 0, now);

    expect(result.match.turn.turnDeadline).toBe(1000 + TURN_TIMEOUT_MS);
  });

  it("updates lastActionAt on the forced player", () => {
    const match = createTestMatch();
    const withTurn = {
      ...match,
      turn: setCurrentTurn(match.turn, 0),
    };
    const now = new Date(5000);
    const result = forcePassForDisconnected(withTurn, 0, now);

    expect(result.match.players[0].lastActionAt).toEqual(now);
  });

  it("emits turn_timeout as first event when board is blocked", () => {
    // Set up a board where no one can play after forced pass
    const tile: Tile = { top: 1, bottom: 2, id: "unplayable" };
    const board: BoardState = {
      leftEnd: 5,
      rightEnd: 7,
      tiles: [],
    };
    const hands: [Tile[], Tile[], Tile[], Tile[]] = [
      [tile],
      [{ ...tile, id: "t2" }],
      [{ ...tile, id: "t3" }],
      [{ ...tile, id: "t4" }],
    ];
    const match = createMatchWithHands(hands, {
      board,
      turn: { currentTurn: 0, turnDeadline: 100_000 },
    });

    const now = new Date(2000);
    const result = forcePassForDisconnected(match, 0, now);

    // First event must be turn_timeout
    expect(result.events[0]).toEqual({
      type: "turn_timeout",
      playerId: "p0",
      forcedPass: true,
    });
    // Subsequent events are from handleHandEnd (blocked → hand_ended, hand_scored)
    expect(result.events.length).toBeGreaterThan(1);
    expect(result.events[1].type).toBe("hand_ended");
  });

  it("does not mutate the original match", () => {
    const match = createTestMatch();
    const withTurn = {
      ...match,
      turn: setCurrentTurn(match.turn, 0),
    };
    const originalPasses = withTurn.players[0].consecutivePasses;
    const originalTurn = withTurn.turn.currentTurn;

    forcePassForDisconnected(withTurn, 0, new Date());

    expect(withTurn.players[0].consecutivePasses).toBe(originalPasses);
    expect(withTurn.turn.currentTurn).toBe(originalTurn);
  });
});

// ---------------------------------------------------------------------------
// T6: checkAbandonment
// ---------------------------------------------------------------------------
describe("checkAbandonment", () => {
  it("no-op when match status is not in_progress", () => {
    const match = createTestMatch();
    const finishedMatch = { ...match, status: "finished" as const };
    const result = checkAbandonment(
      finishedMatch,
      { disconnectedAt: new Date(0), playerId: "p0" },
      new Date(100_000),
    );

    expect(result.events).toHaveLength(0);
    expect(result.match.status).toBe("finished");
  });

  it("no-op when elapsed is less than RECONNECT_WINDOW_MS", () => {
    const match = createTestMatch();
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + 5_000); // 5s — within 10s window
    const result = checkAbandonment(
      match,
      { disconnectedAt, playerId: "p0" },
      now,
    );

    expect(result.events).toHaveLength(0);
    expect(result.match).toBe(match);
  });

  it("emits reconnection_window_expiring when past reconnect window but below abandonment threshold", () => {
    const match = createTestMatch();
    const disconnectedAt = new Date(1000);
    // elapsed = 12s → past 10s window, below 15s threshold
    const now = new Date(1000 + 12_000);
    const result = checkAbandonment(
      match,
      { disconnectedAt, playerId: "p0" },
      now,
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "reconnection_window_expiring",
      playerId: "p0",
      secondsLeft: 3, // (15_000 - 12_000) / 1000 = 3
    });
  });

  it("emits reconnection_window_expiring with 0 seconds at boundary just before abandonment", () => {
    const match = createTestMatch();
    const disconnectedAt = new Date(1000);
    // elapsed = 14_999 → just below threshold
    const now = new Date(1000 + 14_999);
    const result = checkAbandonment(
      match,
      { disconnectedAt, playerId: "p0" },
      now,
    );

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "reconnection_window_expiring",
      playerId: "p0",
      secondsLeft: 0,
    });
  });

  it("abandons match when elapsed >= ABANDONMENT_THRESHOLD_MS", () => {
    const match = createTestMatch();
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + 20_000); // 20s — past threshold
    const result = checkAbandonment(
      match,
      { disconnectedAt, playerId: "p0" },
      now,
    );

    expect(result.match.status).toBe("abandoned");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "match_abandoned",
      disconnectedPlayerId: "p0",
      disconnectedPlayerName: undefined,
      reason: "abandonment",
    });
  });

  it("abandons match exactly at ABANDONMENT_THRESHOLD_MS", () => {
    const match = createTestMatch();
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + ABANDONMENT_THRESHOLD_MS);
    const result = checkAbandonment(
      match,
      { disconnectedAt, playerId: "p0" },
      now,
    );

    expect(result.match.status).toBe("abandoned");
    expect(result.events[0]).toEqual({
      type: "match_abandoned",
      disconnectedPlayerId: "p0",
      disconnectedPlayerName: undefined,
      reason: "abandonment",
    });
  });

  it("does not mutate the original match on abandonment", () => {
    const match = createTestMatch();
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + 20_000);
    const originalStatus = match.status;

    checkAbandonment(match, { disconnectedAt, playerId: "p0" }, now);

    expect(match.status).toBe(originalStatus);
  });
});

// ---------------------------------------------------------------------------
// T7: forfeitMatch
// ---------------------------------------------------------------------------
describe("forfeitMatch", () => {
  it("no-op when match status is already finished", () => {
    const match = createTestMatch();
    const finishedMatch = { ...match, status: "finished" as const };
    const result = forfeitMatch(finishedMatch, "p0", new Date());

    expect(result.events).toHaveLength(0);
    expect(result.match).toBe(finishedMatch);
  });

  it("no-op when match status is already abandoned", () => {
    const match = createTestMatch();
    const abandonedMatch = { ...match, status: "abandoned" as const };
    const result = forfeitMatch(abandonedMatch, "p0", new Date());

    expect(result.events).toHaveLength(0);
    expect(result.match).toBe(abandonedMatch);
  });

  it("returns PLAYER_NOT_FOUND for invalid playerId", () => {
    const match = createTestMatch();
    const result = forfeitMatch(match, "invalid", new Date());

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "game_error",
      code: "PLAYER_NOT_FOUND",
      message: "Player not found in match",
    });
  });

  it("sets match to abandoned and emits match_abandoned with reason forfeit", () => {
    const match = createTestMatch();
    const now = new Date();
    const result = forfeitMatch(match, "p2", now);

    expect(result.match.status).toBe("abandoned");
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual({
      type: "match_abandoned",
      disconnectedPlayerId: "p2",
      disconnectedPlayerName: undefined,
      reason: "forfeit",
    });
  });

  it("disconnects the forfeiting player", () => {
    const match = createTestMatch();
    const now = new Date();
    const result = forfeitMatch(match, "p1", now);

    expect(result.match.players[1].isConnected).toBe(false);
  });

  it("updates lastActionAt on the forfeiting player", () => {
    const match = createTestMatch();
    const now = new Date(9999);
    const result = forfeitMatch(match, "p0", now);

    expect(result.match.players[0].lastActionAt).toEqual(now);
  });

  it("does not mutate the original match", () => {
    const match = createTestMatch();
    const originalStatus = match.status;

    forfeitMatch(match, "p0", new Date());

    expect(match.status).toBe(originalStatus);
  });
});

// ---------------------------------------------------------------------------
// T8: Integration tests — full connection lifecycle
// ---------------------------------------------------------------------------
describe("integration: connection lifecycle", () => {
  it("full disconnect → force-pass cycle", () => {
    // 1. Start a match, turn = player 1
    const match = createTestMatch();
    const withTurn = {
      ...match,
      turn: setCurrentTurn(match.turn, 1),
    };

    // 2. Disconnect player 1
    const disconnectTime = new Date(1000);
    const disconnected = disconnectPlayer(withTurn, "p1", disconnectTime);
    expect(disconnected.match.players[1].isConnected).toBe(false);

    // 3. Force pass for player 1 (simulating WS timeout)
    const forcePassTime = new Date(2000);
    const forced = forcePassForDisconnected(
      disconnected.match,
      1,
      forcePassTime,
    );

    // 4. Verify forced pass applied
    expect(forced.match.players[1].consecutivePasses).toBe(1);
    expect(forced.match.players[1].isConnected).toBe(false); // still disconnected
    expect(forced.match.turn.currentTurn).toBe(2); // advanced
    expect(forced.events[0]).toEqual({
      type: "turn_timeout",
      playerId: "p1",
      forcedPass: true,
    });
  });

  it("full disconnect → abandonment flow", () => {
    // 1. Create match in progress
    const match = createTestMatch();

    // 2. Disconnect player 0
    const disconnectTime = new Date(1000);
    const disconnected = disconnectPlayer(match, "p0", disconnectTime);
    expect(disconnected.match.players[0].isConnected).toBe(false);

    // 3. Check abandonment before threshold → expiring warning
    const warningTime = new Date(1000 + 12_000); // 12s → past 10s window, below 15s threshold
    const warning = checkAbandonment(
      disconnected.match,
      { disconnectedAt: disconnectTime, playerId: "p0" },
      warningTime,
    );
    expect(warning.events).toHaveLength(1);
    expect(warning.events[0].type).toBe("reconnection_window_expiring");
    expect(warning.match.status).toBe("in_progress"); // still active

    // 4. Check abandonment past threshold → abandoned
    const abandonTime = new Date(1000 + 20_000); // 20s → past 15s threshold
    const abandoned = checkAbandonment(
      disconnected.match,
      { disconnectedAt: disconnectTime, playerId: "p0" },
      abandonTime,
    );
    expect(abandoned.match.status).toBe("abandoned");
    expect(abandoned.events[0]).toEqual({
      type: "match_abandoned",
      disconnectedPlayerId: "p0",
      disconnectedPlayerName: undefined,
      reason: "abandonment",
    });
  });

  it("forfeit from valid player emits match_abandoned with reason forfeit", () => {
    const match = createTestMatch();
    const now = new Date();
    const result = forfeitMatch(match, "p3", now);

    expect(result.match.status).toBe("abandoned");
    expect(result.events).toEqual([
      {
        type: "match_abandoned",
        disconnectedPlayerId: "p3",
        disconnectedPlayerName: undefined,
        reason: "forfeit",
      },
    ]);
    expect(result.match.players[3].isConnected).toBe(false);
  });

  it("forfeit after match already finished is no-op", () => {
    const match = createTestMatch();
    const finishedMatch = { ...match, status: "finished" as const };
    const result = forfeitMatch(finishedMatch, "p0", new Date());

    expect(result.events).toHaveLength(0);
    expect(result.match.status).toBe("finished");
  });
});
