import { describe, expect, it, vi } from "bun:test";
import type { UserWsConnection } from "../user-channel";
import { createUserChannelManager } from "../user-channel";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockWs(): UserWsConnection {
  return {
    send: vi.fn(),
    close: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// UserChannelManager
// ---------------------------------------------------------------------------

describe("UserChannelManager", () => {
  it("register → getChannel returns the ws", () => {
    const manager = createUserChannelManager();
    const ws = createMockWs();

    manager.register("user-1", ws);

    expect(manager.getChannel("user-1")).toBe(ws);
  });

  it("disconnect → getChannel returns undefined", () => {
    const manager = createUserChannelManager();
    const ws = createMockWs();

    manager.register("user-1", ws);
    manager.disconnect("user-1");

    expect(manager.getChannel("user-1")).toBeUndefined();
  });

  it("pushToUser when connected → ws.send called with JSON", () => {
    const manager = createUserChannelManager();
    const ws = createMockWs();

    manager.register("user-1", ws);

    const event = { type: "match_found", matchId: "m1" };
    const result = manager.pushToUser("user-1", event);

    expect(result).toBe(true);
    expect(ws.send).toHaveBeenCalledTimes(1);
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(event));
  });

  it("pushToUser when not connected → returns false", () => {
    const manager = createUserChannelManager();

    const event = { type: "match_found", matchId: "m1" };
    const result = manager.pushToUser("unknown-user", event);

    expect(result).toBe(false);
  });

  it("register replaces existing connection", () => {
    const manager = createUserChannelManager();
    const wsOld = createMockWs();
    const wsNew = createMockWs();

    manager.register("user-1", wsOld);
    manager.register("user-1", wsNew);

    expect(manager.getChannel("user-1")).toBe(wsNew);
  });

  it("multiple users are independent", () => {
    const manager = createUserChannelManager();
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    manager.register("user-1", ws1);
    manager.register("user-2", ws2);

    expect(manager.getChannel("user-1")).toBe(ws1);
    expect(manager.getChannel("user-2")).toBe(ws2);

    manager.disconnect("user-1");

    expect(manager.getChannel("user-1")).toBeUndefined();
    expect(manager.getChannel("user-2")).toBe(ws2);
  });

  it("pushToUser returns true when event is sent successfully", () => {
    const manager = createUserChannelManager();
    const ws = createMockWs();

    manager.register("user-1", ws);

    const result = manager.pushToUser("user-1", {
      type: "match_found",
      matchId: "m1",
      players: [{ id: "u1" }, { id: "u2" }],
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    expect(result).toBe(true);
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe("match_found");
    expect(sent.matchId).toBe("m1");
  });

  it("pushToUser handles send errors gracefully", () => {
    const manager = createUserChannelManager();
    const ws: UserWsConnection = {
      send: vi.fn(() => {
        throw new Error("Connection closed");
      }),
      close: vi.fn(),
    };

    manager.register("user-1", ws);

    // Should not throw
    const result = manager.pushToUser("user-1", { type: "test" });
    expect(result).toBe(true);
  });
});
