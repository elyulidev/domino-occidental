import type { GameEvent, SanitizedMatchState } from "@domino/shared";
import type { Tile } from "@domino/shared/types";
import type { WsServerMessage } from "@domino/shared/ws";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GetWebSockets = () => WebSocket[];
export type GetTags = (ws: WebSocket) => string[];

// ---------------------------------------------------------------------------
// broadcastEvents
// ---------------------------------------------------------------------------

/**
 * Routes a batch of GameEvent[] to the correct WebSocket recipients
 * via Hibernation API tags.
 *
 * Routing rules:
 * - `game_error` events → only `actingPlayerId` (private)
 * - All other event types → all connected players
 *
 * Groups all events per recipient into a single message.
 */
export function broadcastEvents(
  events: GameEvent[],
  getWebSockets: GetWebSockets,
  getTags: GetTags,
  matchId: string,
  actingPlayerId: string,
  state?: SanitizedMatchState,
): void {
  if (events.length === 0) return;

  const sockets = getWebSockets();
  if (sockets.length === 0) return;

  // Build a tag → socket map
  const tagToSocket = new Map<string, WebSocket>();
  for (const ws of sockets) {
    const tags = getTags(ws);
    if (tags.length > 0) {
      tagToSocket.set(tags[0], ws);
    }
  }

  if (tagToSocket.size === 0) return;

  // Group events by recipient tag
  const eventsByTag = new Map<string, GameEvent[]>();
  for (const tag of tagToSocket.keys()) {
    eventsByTag.set(tag, []);
  }

  for (const event of events) {
    const recipients =
      event.type === "game_error"
        ? [actingPlayerId]
        : [...tagToSocket.keys()];

    for (const tag of recipients) {
      eventsByTag.get(tag)?.push(event);
    }
  }

  // Send one message per recipient
  for (const [tag, playerEvents] of eventsByTag) {
    if (playerEvents.length === 0) continue;
    const ws = tagToSocket.get(tag);
    if (!ws) continue;

    try {
      const envelope: WsServerMessage = {
        type: "game_events",
        events: playerEvents,
      };
      if (state !== undefined) {
        envelope.state = state;
      }
      ws.send(JSON.stringify(envelope));
    } catch (err) {
      console.error(
        `[broadcaster] send failed for tag=${tag} (match=${matchId}):`,
        err,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// sendHand
// ---------------------------------------------------------------------------

/**
 * Sends a player's private hand tiles via targeted WebSocket message.
 *
 * Finds the socket by tag (userId) and sends a game_events envelope
 * with the yourHand field populated.
 */
export function sendHand(
  playerId: string,
  hand: Tile[],
  getWebSockets: GetWebSockets,
  getTags: GetTags,
): void {
  const sockets = getWebSockets();
  for (const ws of sockets) {
    const tags = getTags(ws);
    if (tags.includes(playerId)) {
      try {
        const envelope: WsServerMessage = {
          type: "game_events",
          events: [],
          yourHand: hand,
        };
        ws.send(JSON.stringify(envelope));
      } catch (err) {
        console.error(
          `[broadcaster] sendHand failed for player=${playerId}:`,
          err,
        );
      }
      return;
    }
  }
}
