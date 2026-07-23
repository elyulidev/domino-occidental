import type {
  ActionResult,
  GameEvent,
  GameStore,
  MatchState,
  SanitizedMatchState,
  SendFn,
} from "@domino/shared";
import { ABANDONMENT_THRESHOLD_MS, HEARTBEAT_MS, sanitizeState } from "@domino/shared";
import { persistMatch } from "../db/matches";
import { type RoundRecord, recordRound } from "../db/rounds";
import { startedMatches } from "./started-matches";

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
    playerIds?: string[],
    state?: SanitizedMatchState,
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
  playerIds: string[];
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
  const heartbeatFailures = new Map<string, number>();
  const pausedMatches = new Set<string>();

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

            // CLOSED (3) → disconnect immediately (definitive)
            if (readyState === 3) {
              heartbeatFailures.delete(playerId);
              const match = store.getGame(matchId);
              if (match) {
                const result = disconnectPlayer(match, playerId, new Date(nowFn()));
                if (result.events.length > 0) {
                  if (result.match !== match) {
                    store.updateGame(matchId, result.match);
                  }
                  broadcastEvents(result.events, matchId, playerId, sendFn, playerIds, sanitizeState(result.match));
                }
              }
              return;
            }

            // OPEN (1) → reset failure counter
            if (readyState === 1) {
              heartbeatFailures.delete(playerId);
              return;
            }

            // CLOSING (2) or other → increment failure counter
            const prev = heartbeatFailures.get(playerId) ?? 0;
            const failures = prev + 1;
            heartbeatFailures.set(playerId, failures);

            // Disconnect after 3 consecutive failures (15s with 5s interval)
            if (failures >= 3) {
              heartbeatFailures.delete(playerId);
              const match = store.getGame(matchId);
              if (match) {
                const result = disconnectPlayer(match, playerId, new Date(nowFn()));
                if (result.events.length > 0) {
                  if (result.match !== match) {
                    store.updateGame(matchId, result.match);
                  }
                  broadcastEvents(result.events, matchId, playerId, sendFn, playerIds, sanitizeState(result.match));
                }
              }
            }
          }
        }, HEARTBEAT_MS) as unknown as number;
        heartbeatIntervals.set(playerId, id);
      }

      const turnCheckerInterval = intervalFn(() => {
        // Skip turn check if paused — the current player is disconnected
        // and we're waiting for them to reconnect or for abandonment to fire.
        if (pausedMatches.has(matchId)) return;

        const match = store.getGame(matchId);
        if (!match) return;
        const result = checkTimeout(match, nowFn());
        if (result.events.length > 0) {
          // Persist the updated match state (blocked tiles, turn advance, etc.)
          if (result.match !== match) {
            store.updateGame(matchId, result.match);
          }
          broadcastEvents(
            result.events,
            matchId,
            result.match.players[result.match.turn.currentTurn].id,
            sendFn,
            playerIds,
            sanitizeState(result.match),
          );

          // After a hand redeal via timeout: each player needs their new hand
          const matchAfterTimeout = store.getGame(matchId);
          if (matchAfterTimeout && result.events.some((e) => e.type === "round_started")) {
            for (const p of matchAfterTimeout.players) {
              sendFn(p.id, {
                type: "game_events",
                events: [],
                state: sanitizeState(matchAfterTimeout),
                yourHand: p.hand,
              });
            }
          }

          // Fire-and-forget: record round snapshot from hand_ended events (timeout-triggered)
          for (const event of result.events) {
            if (event.type === "hand_ended") {
              const boardTileCount = result.match.board.tiles.length;
              const roundData: RoundRecord = {
                matchId,
                roundId: crypto.randomUUID(),  // generated for FK reference from match_moves
                roundNumber: result.match.turn.roundNumber,
                winningPair: event.winner !== null ? (event.winner % 2 === 0 ? 0 : 1) : null,
                points: 0,
                isBlocked: event.reason === "blocked" || event.reason === "forced_winner",
                isAnnulled: event.reason === "annulled",
                reason: event.reason,
                handScores: [0, 0],
                scoresAfter: event.scoresAfter,
                boardLeftEnd: result.match.board.leftEnd,
                boardRightEnd: result.match.board.rightEnd,
                boardTileCount,
                playerHands: event.playerHands,
                firstPlayer: event.starter,
              };

              // Enrich from hand_scored event (always follows hand_ended)
              const scored = result.events.find(
                (e): e is Extract<GameEvent, { type: "hand_scored" }> =>
                  e.type === "hand_scored",
              );
              if (scored) {
                roundData.winningPair = scored.winningPair;
                roundData.points = scored.points;
                roundData.handScores = scored.scores;
              }

              void recordRound(roundData);
              break; // only one hand_ended per action
            }
          }

          // Persist terminal matches (finished/abandoned) — fire-and-forget
          // persistMatch handles round buffering + transactional flush internally
          if (result.events.some((e) => e.type === "match_ended" || e.type === "match_abandoned")) {
            startedMatches.delete(matchId);
            const finalMatch = store.getGame(matchId) ?? result.match;
            void persistMatch(finalMatch, result.events);
          }
        }
      }, 2000) as unknown as number;

      matchTimers.set(matchId, { heartbeatIntervals, turnCheckerInterval, playerIds });
    },

    registerDisconnect(
      matchId: string,
      playerId: string,
      disconnectedAt: Date,
    ): void {
      const key = `${matchId}:${playerId}`;
      disconnectRecords.set(key, { disconnectedAt, playerId });

      // Pause the turn timer if the disconnected player is currently on turn.
      // This gives them the full abandonment window (60s) to reconnect before
      // a forced pass eats their turn.
      const match = store.getGame(matchId);
      if (match) {
        const currentPlayerId = match.players[match.turn.currentTurn]?.id;
        if (currentPlayerId === playerId) {
          pausedMatches.add(matchId);
        }
      }

      const timerId = timeoutFn(() => {
        const match = store.getGame(matchId);
        if (!match) return;
        const record = disconnectRecords.get(key);
        if (!record) return;
        const result = checkAbandonment(match, record, new Date(nowFn()));
        if (result.events.length > 0) {
          if (result.match !== match) {
            store.updateGame(matchId, result.match);
          }
          const timers = matchTimers.get(matchId);
          const playerIds = timers?.playerIds ?? match.players.map((p) => p.id);
          broadcastEvents(result.events, matchId, playerId, sendFn, playerIds, sanitizeState(result.match));

          // Persist abandoned matches — fire-and-forget
          // persistMatch handles round buffering + transactional flush internally
          if (result.events.some((e) => e.type === "match_abandoned")) {
            startedMatches.delete(matchId);
            const finalMatch = store.getGame(matchId) ?? result.match;
            void persistMatch(finalMatch, result.events);
          }
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

      // Unpause the turn timer — player reconnected in time
      pausedMatches.delete(matchId);

      // Refresh the turn deadline so the reconnected player gets a fresh 45s
      const match = store.getGame(matchId);
      if (match) {
        const currentPlayerId = match.players[match.turn.currentTurn]?.id;
        if (currentPlayerId === playerId && match.turn.turnDeadline !== null) {
          match.turn.turnDeadline = nowFn() + 45_000;
          store.updateGame(matchId, match);
        }
      }
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

      // Clear heartbeat failure counters for this match's players
      if (timers) {
        for (const playerId of timers.playerIds) {
          heartbeatFailures.delete(playerId);
        }
      }
      pausedMatches.delete(matchId);
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
      heartbeatFailures.clear();
      pausedMatches.clear();
    },
  };
}
