import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { ActionResult, MatchState } from "../../game/types";
import { ABANDONMENT_THRESHOLD_MS } from "../../game/types";
import type { SendFn } from "../broadcaster";
import type { TimerManager, TimerManagerDeps } from "../timer-manager";
import { createTimerManager } from "../timer-manager";

// ---------------------------------------------------------------------------
// Test helpers — injectable timers (no fake timers needed)
// ---------------------------------------------------------------------------

/** Captures setInterval/setTimeout callbacks for manual invocation. */
function createTimerSpies() {
  const intervalCallbacks = new Map<number, () => void>();
  const timeoutCallbacks = new Map<number, () => void>();
  let nextId = 1;

  return {
    intervalCallbacks,
    timeoutCallbacks,
    setInterval: vi.fn((cb: () => void, _ms?: number) => {
      const id = nextId++;
      intervalCallbacks.set(id, cb);
      return id;
    }) as unknown as typeof setInterval,
    clearInterval: vi.fn((id: number) => {
      intervalCallbacks.delete(id);
    }) as unknown as typeof clearInterval,
    setTimeout: vi.fn((cb: () => void, _ms?: number) => {
      const id = nextId++;
      timeoutCallbacks.set(id, cb);
      return id;
    }) as unknown as typeof setTimeout,
    clearTimeout: vi.fn((id: number) => {
      timeoutCallbacks.delete(id);
    }) as unknown as typeof clearTimeout,
  };
}

function makeMatch(overrides?: Partial<MatchState>): MatchState {
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
    ...overrides,
  };
}

function makeTimeoutEvent(): ActionResult {
  const match = makeMatch();
  return {
    match,
    events: [
      { type: "turn_timeout" as const, playerId: "p1", forcedPass: true },
    ],
  };
}

function makeAbandonmentEvent(): ActionResult {
  const match = makeMatch({ status: "abandoned" });
  return {
    match,
    events: [
      {
        type: "match_abandoned" as const,
        disconnectedPlayerId: "p1",
        reason: "abandonment" as const,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// TimerManager
// ---------------------------------------------------------------------------

describe("TimerManager", () => {
  let timerManager: TimerManager;
  let deps: TimerManagerDeps;
  let timers: ReturnType<typeof createTimerSpies>;

  beforeEach(() => {
    timers = createTimerSpies();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildDeps(overrides?: Partial<TimerManagerDeps>): TimerManagerDeps {
    const match = makeMatch();
    return {
      store: {
        getGame: vi.fn(() => match),
        updateGame: vi.fn(),
      },
      broadcastEvents: vi.fn(),
      sendFn: vi.fn() as unknown as SendFn,
      checkTimeout: vi.fn(() => ({ match, events: [] })),
      disconnectPlayer: vi.fn(() => ({ match, events: [] })),
      checkAbandonment: vi.fn(() => ({ match, events: [] })),
      getConnectionReadyState: vi.fn(() => 1),
      now: vi.fn(() => Date.now()),
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      ...overrides,
    };
  }

  // --- Turn timeout ---

  describe("turn timeout", () => {
    it("fires checkTimeout at 2s interval and broadcasts events", () => {
      const timeoutResult = makeTimeoutEvent();
      deps = buildDeps({ checkTimeout: vi.fn(() => timeoutResult) });
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1", "p2", "p3", "p4"]);

      // Manually trigger the turn checker callback
      const _turnChecker = [...timers.intervalCallbacks.values()].find((cb) => {
        // The turn checker is the one that calls checkTimeout
        return (
          cb.toString().includes("checkTimeout") ||
          cb.toString().includes("turnChecker")
        );
      });

      // Simpler: just fire all interval callbacks
      for (const cb of timers.intervalCallbacks.values()) {
        cb();
      }

      expect(deps.checkTimeout).toHaveBeenCalled();
      expect(deps.broadcastEvents).toHaveBeenCalledWith(
        timeoutResult.events,
        "match-1",
        expect.any(String),
        deps.sendFn,
        ["p1", "p2", "p3", "p4"],
        expect.any(Object),
      );
    });

    it("does not broadcast when no timeout events returned", () => {
      deps = buildDeps({
        checkTimeout: vi.fn(() => ({ match: makeMatch(), events: [] })),
      });
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1", "p2", "p3", "p4"]);

      for (const cb of timers.intervalCallbacks.values()) {
        cb();
      }

      expect(deps.checkTimeout).toHaveBeenCalled();
      expect(deps.broadcastEvents).not.toHaveBeenCalled();
    });

    it("does not broadcast when match not found", () => {
      deps = buildDeps({
        store: { getGame: vi.fn(() => null), updateGame: vi.fn() },
      });
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1", "p2", "p3", "p4"]);

      for (const cb of timers.intervalCallbacks.values()) {
        cb();
      }

      expect(deps.checkTimeout).not.toHaveBeenCalled();
      expect(deps.broadcastEvents).not.toHaveBeenCalled();
    });
  });

  // --- Heartbeat ---

  describe("heartbeat", () => {
    it("checks ready state and calls disconnectPlayer when not OPEN", () => {
      const disconnectResult = {
        match: makeMatch(),
        events: [
          {
            type: "player_disconnected" as const,
            playerId: "p1",
            reconnectWindowMs: 30000,
          },
        ],
      };
      deps = buildDeps({
        getConnectionReadyState: vi.fn(() => -1),
        disconnectPlayer: vi.fn(() => disconnectResult),
      });
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1"]);

      // Trigger heartbeat callbacks
      for (const cb of timers.intervalCallbacks.values()) {
        cb();
      }

      expect(deps.disconnectPlayer).toHaveBeenCalledTimes(1);
      expect(deps.broadcastEvents).toHaveBeenCalledWith(
        disconnectResult.events,
        "match-1",
        "p1",
        deps.sendFn,
        ["p1"],
        expect.any(Object),
      );
    });

    it("does not disconnect when readyState is OPEN", () => {
      deps = buildDeps({ getConnectionReadyState: vi.fn(() => 1) });
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1"]);

      for (const cb of timers.intervalCallbacks.values()) {
        cb();
      }

      expect(deps.disconnectPlayer).not.toHaveBeenCalled();
    });

    it("skips ready state check when getConnectionReadyState not provided", () => {
      deps = buildDeps({ getConnectionReadyState: undefined });
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1"]);

      for (const cb of timers.intervalCallbacks.values()) {
        cb();
      }

      expect(deps.disconnectPlayer).not.toHaveBeenCalled();
    });

    it("does not disconnect when match not found during heartbeat", () => {
      deps = buildDeps({
        store: { getGame: vi.fn(() => null), updateGame: vi.fn() },
        getConnectionReadyState: vi.fn(() => -1),
      });
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1"]);

      for (const cb of timers.intervalCallbacks.values()) {
        cb();
      }

      expect(deps.disconnectPlayer).not.toHaveBeenCalled();
    });
  });

  // --- registerDisconnect / cancelDisconnect ---

  describe("registerDisconnect", () => {
    it("schedules abandonment check via setTimeout", () => {
      const abandonResult = makeAbandonmentEvent();
      deps = buildDeps({ checkAbandonment: vi.fn(() => abandonResult) });
      timerManager = createTimerManager(deps);

      const disconnectAt = new Date(1000);
      timerManager.registerDisconnect("match-1", "p1", disconnectAt);

      expect(timers.setTimeout).toHaveBeenCalledTimes(1);
      expect(timers.setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        ABANDONMENT_THRESHOLD_MS,
      );

      // Fire the timeout callback
      for (const cb of timers.timeoutCallbacks.values()) {
        cb();
      }

      expect(deps.checkAbandonment).toHaveBeenCalledTimes(1);
      expect(deps.broadcastEvents).toHaveBeenCalledWith(
        abandonResult.events,
        "match-1",
        "p1",
        deps.sendFn,
        ["p1", "p2", "p3", "p4"],
        expect.any(Object),
      );
    });

    it("returns the disconnect record", () => {
      deps = buildDeps();
      timerManager = createTimerManager(deps);

      const disconnectAt = new Date(1000);
      timerManager.registerDisconnect("match-1", "p1", disconnectAt);

      const record = timerManager.getDisconnectRecord("match-1", "p1");
      expect(record).toEqual({ disconnectedAt: disconnectAt, playerId: "p1" });
    });

    it("returns null for unknown disconnect record", () => {
      deps = buildDeps();
      timerManager = createTimerManager(deps);

      expect(timerManager.getDisconnectRecord("match-1", "unknown")).toBeNull();
    });

    it("does not call checkAbandonment when match not found", () => {
      deps = buildDeps({
        store: { getGame: vi.fn(() => null), updateGame: vi.fn() },
      });
      timerManager = createTimerManager(deps);

      timerManager.registerDisconnect("match-1", "p1", new Date(1000));

      for (const cb of timers.timeoutCallbacks.values()) {
        cb();
      }

      expect(deps.checkAbandonment).not.toHaveBeenCalled();
    });

    it("does not broadcast when no events returned from checkAbandonment", () => {
      deps = buildDeps({
        checkAbandonment: vi.fn(() => ({ match: makeMatch(), events: [] })),
      });
      timerManager = createTimerManager(deps);

      timerManager.registerDisconnect("match-1", "p1", new Date(1000));

      for (const cb of timers.timeoutCallbacks.values()) {
        cb();
      }

      expect(deps.broadcastEvents).not.toHaveBeenCalled();
    });
  });

  describe("cancelDisconnect", () => {
    it("prevents abandonment timer from firing", () => {
      deps = buildDeps({
        checkAbandonment: vi.fn(() => makeAbandonmentEvent()),
      });
      timerManager = createTimerManager(deps);

      timerManager.registerDisconnect("match-1", "p1", new Date(1000));
      timerManager.cancelDisconnect("match-1", "p1");

      // Timer was cleared — callbacks map should be empty
      expect(timers.timeoutCallbacks.size).toBe(0);
      expect(timerManager.getDisconnectRecord("match-1", "p1")).toBeNull();
    });

    it("only cancels the specified player", () => {
      deps = buildDeps({
        checkAbandonment: vi.fn(() => makeAbandonmentEvent()),
      });
      timerManager = createTimerManager(deps);

      timerManager.registerDisconnect("match-1", "p1", new Date(1000));
      timerManager.registerDisconnect("match-1", "p2", new Date(1000));

      expect(timers.timeoutCallbacks.size).toBe(2);

      timerManager.cancelDisconnect("match-1", "p1");

      // p1 cleared, p2 still there
      expect(timers.timeoutCallbacks.size).toBe(1);
      expect(timerManager.getDisconnectRecord("match-1", "p1")).toBeNull();
      expect(timerManager.getDisconnectRecord("match-1", "p2")).not.toBeNull();
    });
  });

  // --- stopMatch ---

  describe("stopMatch", () => {
    it("clears all heartbeat intervals and turn checker", () => {
      deps = buildDeps();
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1", "p2", "p3", "p4"]);
      const countBefore = timers.intervalCallbacks.size;
      expect(countBefore).toBeGreaterThan(0);

      timerManager.stopMatch("match-1");

      expect(timers.intervalCallbacks.size).toBe(0);
      expect(timers.clearInterval).toHaveBeenCalled();
    });

    it("clears disconnect timeouts for players in the match", () => {
      deps = buildDeps({
        checkAbandonment: vi.fn(() => makeAbandonmentEvent()),
      });
      timerManager = createTimerManager(deps);

      timerManager.registerDisconnect("match-1", "p1", new Date(1000));
      expect(timers.timeoutCallbacks.size).toBe(1);

      timerManager.stopMatch("match-1");

      expect(timers.timeoutCallbacks.size).toBe(0);
      expect(timerManager.getDisconnectRecord("match-1", "p1")).toBeNull();
    });

    it("does not affect other matches", () => {
      deps = buildDeps({ checkTimeout: vi.fn(() => makeTimeoutEvent()) });
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1", "p2"]);
      timerManager.startMatch("match-2", ["p1", "p2"]);

      // match-1: 2 heartbeats + 1 turn checker = 3 intervals
      // match-2: 2 heartbeats + 1 turn checker = 3 intervals
      const countBefore = timers.intervalCallbacks.size;
      timerManager.stopMatch("match-1");

      // match-2 intervals should still be in the callbacks map (3 remain)
      expect(timers.intervalCallbacks.size).toBe(countBefore - 3);
    });
  });

  // --- stop ---

  describe("stop", () => {
    it("clears all intervals and timeouts", () => {
      deps = buildDeps();
      timerManager = createTimerManager(deps);

      timerManager.startMatch("match-1", ["p1", "p2"]);
      timerManager.registerDisconnect("match-1", "p1", new Date(1000));

      expect(timers.intervalCallbacks.size).toBeGreaterThan(0);
      expect(timers.timeoutCallbacks.size).toBe(1);

      timerManager.stop();

      expect(timers.intervalCallbacks.size).toBe(0);
      expect(timers.timeoutCallbacks.size).toBe(0);
      expect(timers.clearInterval).toHaveBeenCalled();
      expect(timers.clearTimeout).toHaveBeenCalled();
    });

    it("clears disconnect records", () => {
      deps = buildDeps();
      timerManager = createTimerManager(deps);

      timerManager.registerDisconnect("match-1", "p1", new Date(1000));
      expect(timerManager.getDisconnectRecord("match-1", "p1")).not.toBeNull();

      timerManager.stop();

      expect(timerManager.getDisconnectRecord("match-1", "p1")).toBeNull();
    });
  });
});
