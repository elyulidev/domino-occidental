import type {
  GameEvent,
  SanitizedMatchState,
  SendFn,
  WsServerMessage,
} from "@domino/shared";

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
 * Groups all events per recipient into a single message with one state
 * snapshot, instead of sending N separate messages (one per event).
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

  if (!playerIds || playerIds.length === 0) {
    console.error(
      `[broadcaster] broadcastEvents called without playerIds (match=${_matchId}, actingPlayer=${actingPlayerId}). This is a bug — all callers must pass playerIds explicitly.`,
    );
    return;
  }

  const allPlayers = playerIds;

  // Group events by recipient
  const eventsByPlayer = new Map<string, GameEvent[]>();
  for (const playerId of allPlayers) {
    eventsByPlayer.set(playerId, []);
  }

  for (const event of events) {
    const recipients =
      event.type === "game_error"
        ? [actingPlayerId]
        : allPlayers;

    for (const playerId of recipients) {
      eventsByPlayer.get(playerId)?.push(event);
    }
  }

  console.log(`[broadcaster] ${events.length} events → ${allPlayers.length} players match=${_matchId} hasState=${state !== undefined}`);

  // Send one message per recipient with all their events
  for (const [playerId, playerEvents] of eventsByPlayer) {
    if (playerEvents.length === 0) continue;
    try {
      const envelope: WsServerMessage = {
        type: "game_events",
        events: playerEvents,
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
