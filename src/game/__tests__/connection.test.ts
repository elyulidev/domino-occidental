import { describe, expect, it } from "bun:test";
import { disconnectPlayer, reconnectPlayer, checkReconnectWindow } from "../connection";
import { createPlayer } from "../player";
import { initializeMatch } from "../match";
import { RECONNECT_WINDOW_MS, HEARTBEAT_MS, ABANDONMENT_THRESHOLD_MS } from "../types";
import type { MatchState } from "../types";

// Helper to create a basic match for testing
function createTestMatch(): MatchState {
  const hands: [never[], never[], never[], never[]] = [[], [], [], []];
  const { match } = initializeMatch("test-match", hands, []);
  return match;
}

describe("constants", () => {
  it("HEARTBEAT_MS is 5_000", () => {
    expect(HEARTBEAT_MS).toBe(5_000);
  });

  it("RECONNECT_WINDOW_MS is 30_000", () => {
    expect(RECONNECT_WINDOW_MS).toBe(30_000);
  });

  it("ABANDONMENT_THRESHOLD_MS is 60_000", () => {
    expect(ABANDONMENT_THRESHOLD_MS).toBe(60_000);
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
    const second = disconnectPlayer(first.match, "p0", new Date(now.getTime() + 1000));

    expect(second.events).toHaveLength(0);
    expect(second.match.players[0].isConnected).toBe(false);
  });

  it("emits player_disconnected with correct reconnectWindowMs", () => {
    const match = createTestMatch();
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
    const reconnectResult = reconnectPlayer(disconnected.match, "p0", new Date(now.getTime() + 1000));

    expect(reconnectResult.match.players[0].isConnected).toBe(true);
  });

  it("reconnecting already-connected player is no-op", () => {
    const match = createTestMatch();
    const now = new Date();
    const result = reconnectPlayer(match, "p0", now);

    expect(result.events).toHaveLength(0);
    expect(result.match.players[0].isConnected).toBe(true);
  });

  it("emits player_reconnected event", () => {
    const match = createTestMatch();
    const now = new Date();
    const disconnected = disconnectPlayer(match, "p0", now);
    const reconnectResult = reconnectPlayer(disconnected.match, "p0", new Date(now.getTime() + 1000));

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
    const now = new Date(1000 + 20_000); // 20s elapsed, window is 30s
    const result = checkReconnectWindow({ disconnectedAt, playerId: "p0" }, now);

    expect(result.windowExpired).toBe(false);
    expect(result.secondsLeft).toBe(10);
  });

  it("past window returns windowExpired: true", () => {
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + 31_000); // 31s elapsed, window is 30s
    const result = checkReconnectWindow({ disconnectedAt, playerId: "p0" }, now);

    expect(result.windowExpired).toBe(true);
    expect(result.secondsLeft).toBe(0);
  });

  it("boundary test: exactly at RECONNECT_WINDOW_MS", () => {
    const disconnectedAt = new Date(1000);
    const now = new Date(1000 + RECONNECT_WINDOW_MS); // exactly 30s
    const result = checkReconnectWindow({ disconnectedAt, playerId: "p0" }, now);

    expect(result.windowExpired).toBe(true);
    expect(result.secondsLeft).toBe(0);
  });
});
