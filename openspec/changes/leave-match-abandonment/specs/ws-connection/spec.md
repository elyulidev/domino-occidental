# Delta for ws-connection

## MODIFIED Requirements

### R2: Message Routing

The system MUST route incoming WS messages through `handleMessage()` then `broadcastEvents()`. The client MUST send `{ type: "leave" }` to forfeit a match, replacing the previous REST-based forfeit flow.

#### Scenario: Valid message routes to engine

- GIVEN a WS message `{"type":"pass"}` from "p1" in "match-1"
- WHEN the `message` hook processes it
- THEN `handleMessage(store, "match-1", "p1", msg)` is called
- AND `broadcastEvents(events, "match-1", "p1", sendFn)` is called with the result

#### Scenario: Malformed JSON returns game_error

- GIVEN a WS message `{invalid json`
- WHEN the `message` hook processes it
- THEN no exception is thrown
- AND a `game_error` event is sent back to the sender

#### Scenario: Client sends leave via WebSocket

- GIVEN the user confirms "Leave Match" in the confirmation modal
- WHEN the client sends `{ "type": "leave" }` via WebSocket
- THEN the server processes it through `handleMessage` → `forfeitMatch()`
- AND a `match_abandoned` event is broadcast to all connected players

## ADDED Requirements

### Requirement: Leave Message Handling (Client-Side)

The client MUST send `{ type: "leave" }` to forfeit a match and MUST NOT destroy the WebSocket engine or navigate until the server confirms via `match_abandoned`.

#### Scenario: Client waits for server confirmation

- GIVEN the client sent `{ type: "leave" }`
- WHEN the `match_abandoned` event is received
- THEN the client stores `matchAbandonedBy` (playerId) in the game store
- AND the client navigates to the lobby

#### Scenario: Client-side timeout fallback

- GIVEN the client sent `{ type: "leave" }`
- WHEN 5 seconds elapse without a `match_abandoned` event
- THEN the client navigates to the lobby
- AND `matchAbandonedBy` is NOT set (fallback to generic message)

#### Scenario: WS already closed when user confirms leave

- GIVEN the WebSocket connection is closed or disconnecting
- WHEN the user clicks "Leave Match" in the confirmation modal
- THEN the modal SHALL NOT show the "Leave Match" button (disabled/hidden)
- AND the user sees the existing disconnect overlay instead
