import type {
  ActionResult,
  GameEvent,
  GameStore,
  MatchState,
  SendFn,
} from "@domino/shared";
import { ABANDONMENT_THRESHOLD_MS, HEARTBEAT_MS } from "@domino/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DisconnectRecord {
  disconnectedAt: Date;
  playerId: string;
}

export interface TimerManagerDeps {
  store: GameStore;
  broadcastEvents: (
    events: GameEvent[],
    matchId: string,
    actingPlayerId: string,
    sendFn: SendFn,
  ) => void;
  sendFn: SendFn;
  checkTimeout: (match: MatchState, now: number) => ActionResult;
  disconnectPlayer: (
    match: MatchState,
    playerId: string,
    now: Date,
  ) => ActionResult;
  checkAbandonment: (
    match: MatchState,
    record: DisconnectRecord,
    now: Date,
  ) => ActionResult;
  /** Returns ws.readyState (1=OPEN) or -1 if unknown. */
  getConnectionReadyState?: (playerId: string) => number;
  now?: () => number;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}

export interface TimerManager {
  startMatch(matchId: string, playerIds: string[]): void;
  registerDisconnect(
    matchId: string,
    playerId: string,
    disconnectedAt: Date,
  ): void;
  cancelDisconnect(matchId: string, playerId: string): void;
  getDisconnectRecord(
    matchId: string,
    playerId: string,
  ): DisconnectRecord | null;
  stopMatch(matchId: string): void;
  stop(): void;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

interface MatchTimers {
  heartbeatIntervals: Map<string, number>;
  turnCheckerInterval: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a TimerManager that orchestrates heartbeat checks, turn timeout
 * polling, and disconnect abandonment timers for all active matches.
 *
 * All timer primitives (setInterval, clearInterval, setTimeout, clearTimeout)
 * and the clock (now) are injectable for deterministic testing.
 */
export function createTimerManager(deps: TimerManagerDeps): TimerManager {
  const {
    store,
    broadcastEvents,
    sendFn,
    checkTimeout,
    disconnectPlayer,
    checkAbandonment,
  } = deps;

  const intervalFn = deps.setInterval ?? setInterval.bind(globalThis);
  const clearIntervalFn = deps.clearInterval ?? clearInterval.bind(globalThis);
  const timeoutFn = deps.setTimeout ?? setTimeout.bind(globalThis);
  const clearTimeoutFn = deps.clearTimeout ?? clearTimeout.bind(globalThis);
  const nowFn = deps.now ?? (() => Date.now());

  const matchTimers = new Map<string, MatchTimers>();
  const disconnectTimers = new Map<string, number>();
  const disconnectRecords = new Map<string, DisconnectRecord>();

  function clearDisconnectTimer(key: string): void {
    const timerId = disconnectTimers.get(key);
    if (timerId !== undefined) {
      clearTimeoutFn(timerId);
      disconnectTimers.delete(key);
    }
  }

  return {
    startMatch(matchId: string, playerIds: string[]): void {
      const heartbeatIntervals = new Map<string, number>();

      for (const playerId of playerIds) {
        const id = intervalFn(() => {
          if (deps.getConnectionReadyState) {
            const readyState = deps.getConnectionReadyState(playerId);
            if (readyState !== 1) {
              const match = store.getGame(matchId);
              if (match) {
                const result = disconnectPlayer(
                  match,
                  playerId,
                  new Date(nowFn()),
                );
                if (result.events.length > 0) {
                  broadcastEvents(result.events, matchId, playerId, sendFn);
                }
              }
            }
          }
        }, HEARTBEAT_MS) as unknown as number;
        heartbeatIntervals.set(playerId, id);
      }

      const turnCheckerInterval = intervalFn(() => {
        const match = store.getGame(matchId);
        if (!match) return;
        const result = checkTimeout(match, nowFn());
        if (result.events.length > 0) {
          broadcastEvents(
            result.events,
            matchId,
            result.match.players[result.match.turn.currentTurn].id,
            sendFn,
          );
        }
      }, 2000) as unknown as number;

      matchTimers.set(matchId, { heartbeatIntervals, turnCheckerInterval });
    },

    registerDisconnect(
      matchId: string,
      playerId: string,
      disconnectedAt: Date,
    ): void {
      const key = `${matchId}:${playerId}`;
      disconnectRecords.set(key, { disconnectedAt, playerId });

      const timerId = timeoutFn(() => {
        const match = store.getGame(matchId);
        if (!match) return;
        const record = disconnectRecords.get(key);
        if (!record) return;
        const result = checkAbandonment(match, record, new Date(nowFn()));
        if (result.events.length > 0) {
          broadcastEvents(result.events, matchId, playerId, sendFn);
        }
        // Clean up the record after timeout fires
        disconnectRecords.delete(key);
        disconnectTimers.delete(key);
      }, ABANDONMENT_THRESHOLD_MS) as unknown as number;

      disconnectTimers.set(key, timerId);
    },

    cancelDisconnect(matchId: string, playerId: string): void {
      const key = `${matchId}:${playerId}`;
      clearDisconnectTimer(key);
      disconnectRecords.delete(key);
    },

    getDisconnectRecord(
      matchId: string,
      playerId: string,
    ): DisconnectRecord | null {
      const key = `${matchId}:${playerId}`;
      return disconnectRecords.get(key) ?? null;
    },

    stopMatch(matchId: string): void {
      const timers = matchTimers.get(matchId);
      if (timers) {
        for (const [, id] of timers.heartbeatIntervals) {
          clearIntervalFn(id);
        }
        clearIntervalFn(timers.turnCheckerInterval);
        matchTimers.delete(matchId);
      }

      // Clear disconnect timeouts for any player in this match
      // Collect keys first to avoid mutating the Map during iteration
      const keysToRemove: string[] = [];
      for (const [key] of disconnectTimers) {
        if (key.startsWith(`${matchId}:`)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        clearDisconnectTimer(key);
        disconnectRecords.delete(key);
      }
    },

    stop(): void {
      // Clear all match timers
      for (const [, timers] of matchTimers) {
        for (const [, id] of timers.heartbeatIntervals) {
          clearIntervalFn(id);
        }
        clearIntervalFn(timers.turnCheckerInterval);
      }
      matchTimers.clear();

      // Clear all disconnect timeouts
      for (const [key] of disconnectTimers) {
        clearDisconnectTimer(key);
      }
      disconnectTimers.clear();
      disconnectRecords.clear();
    },
  };
}
