import type { SanitizedMatchState } from "../game/handler";
import type { GameEvent } from "../game/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Synchronous send function that delivers a WsServerMessage to a specific player.
 *
 * Higher layers may wrap async WebSocket writes; the broadcaster treats this
 * as synchronous. Errors are caught per-recipient to protect remaining deliveries.
 */
export type SendFn = (playerId: string, event: WsServerMessage) => void;

/**
 * Server→client envelope for game events.
 *
 * Discriminated union root — `'game_events'` is the initial variant.
 * Future variants (e.g. `'presence_update'`) can extend this union.
 */
export type WsServerMessage = {
  type: "game_events";
  events: GameEvent[];
  state?: SanitizedMatchState;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_PLAYER_IDS = ["1", "2", "3", "4"];

// ---------------------------------------------------------------------------
// broadcastEvents
// ---------------------------------------------------------------------------

/**
 * Routes a batch of GameEvent[] to the correct WebSocket recipients
 * with privacy filtering.
 *
 * Routing rules:
 * - `game_error` events → only `actingPlayerId` (private)
 * - All other 11 event types → all 4 players (or `playerIds` override)
 *
 * Each event is wrapped in a `WsServerMessage` envelope per recipient.
 * Optional `state` is attached to every envelope when provided.
 *
 * Errors thrown by `sendFn` are caught and logged per-recipient;
 * remaining recipients still receive their events.
 */
export function broadcastEvents(
  events: GameEvent[],
  _matchId: string,
  actingPlayerId: string,
  sendFn: SendFn,
  playerIds?: string[],
  state?: SanitizedMatchState,
): void {
  if (events.length === 0) return;

  for (const event of events) {
    const recipients =
      event.type === "game_error"
        ? [actingPlayerId]
        : (playerIds ?? ALL_PLAYER_IDS);

    for (const playerId of recipients) {
      try {
        const envelope: WsServerMessage = {
          type: "game_events",
          events: [event],
        };

        if (state !== undefined) {
          envelope.state = state;
        }

        sendFn(playerId, envelope);
      } catch (err) {
        console.error(
          `[broadcaster] sendFn failed for player ${playerId} (match=${_matchId}):`,
          err,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// sendState
// ---------------------------------------------------------------------------

/**
 * Pushes a sanitized state snapshot to a single targeted player.
 *
 * Used for reconnection and initial join — wraps the state in the standard
 * `WsServerMessage` envelope with an empty events array.
 */
export function sendState(
  playerId: string,
  state: SanitizedMatchState,
  sendFn: SendFn,
): void {
  sendFn(playerId, {
    type: "game_events",
    events: [],
    state,
  });
}
