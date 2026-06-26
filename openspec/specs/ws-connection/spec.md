# ws-connection Specification

## Purpose

Transport layer that connects WebSocket clients to the game engine. Manages connection lifecycle, JWT authentication, rate limiting, and message routing from wire to `handleMessage()`/`broadcastEvents()`.

## Requirements

### R1: Connection Map

The system MUST maintain a `Map<string, WebSocket>` mapping playerId to active connection.

#### Scenario: Register and unregister connection

- GIVEN a match with player "p1"
- WHEN `joinMatch("match-1", "p1", ws)` is called
- THEN the connection map contains "p1" → ws
- WHEN `leaveMatch("match-1", "p1")` is called
- THEN the map entry for "p1" is removed

#### Scenario: Reconnect replaces existing entry

- GIVEN "p1" is already in the connection map with `wsOld`
- WHEN `joinMatch("match-1", "p1", wsNew)` is called
- THEN the map entry for "p1" now points to `wsNew`

#### Scenario: Cleanup on close and error

- GIVEN "p1" has an active connection
- WHEN the WS `close` or `error` hook fires
- THEN `leaveMatch` is called and the entry is removed

### R2: Message Routing

The system MUST route incoming WS messages through `handleMessage()` then `broadcastEvents()`.

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

### R3: Player Connection State

The system MUST call `disconnectPlayer()` on WS close and `reconnectPlayer()` on WS open for reconnecting players.

#### Scenario: Disconnect propagates to engine

- GIVEN "p1" is connected in "match-1"
- WHEN the WS `close` hook fires
- THEN `disconnectPlayer(match, "p1", now)` is called
- AND resulting events are broadcast

#### Scenario: Reconnect propagates to engine

- GIVEN "p1" was disconnected from "match-1"
- WHEN their WebSocket connects again with the same playerId
- THEN `reconnectPlayer(match, "p1", now)` is called
- AND `sendState()` delivers the current match state

### R4: SendFn Implementation

The system MUST implement `SendFn` compatible with `broadcaster.ts`.

#### Scenario: sendToPlayer delivers message

- GIVEN "p1" is in the connection map with an open WebSocket
- WHEN `sendToPlayer("p1", { type: "game_events", events: [] })` is called
- THEN the message is serialized to JSON and sent via `ws.send()`
- AND `broadcastEvents` can use this function transparently

### R5: JWT Authentication

The system MUST verify JWT tokens from WS query param `?token=xxx` using Supabase secret.

#### Scenario: Valid token is accepted

- GIVEN a valid Supabase JWT signed with SUPABASE_JWT_SECRET
- WHEN `verifyToken(jwt)` is called
- THEN it returns `{ userId: "u1" }`

#### Scenario: Invalid signature is rejected

- GIVEN a JWT signed with a different secret
- WHEN `verifyToken(jwt)` is called
- THEN it returns `null`

#### Scenario: Expired token is rejected

- GIVEN an expired JWT (exp < now)
- WHEN `verifyToken(jwt)` is called
- THEN it returns `null`

#### Scenario: Missing token on open

- GIVEN a WS connection without `?token=` in the URL
- WHEN the `open` hook fires
- THEN the connection is rejected (closed immediately)

### R6: Rate Limiting

The system MUST enforce 10 messages/second per connection using a token bucket.

#### Scenario: Under limit passes

- GIVEN a token bucket with 10 tokens
- WHEN `tryConsume("conn-1")` is called 10 times
- THEN each call returns `true`

#### Scenario: Over limit blocks

- GIVEN a token bucket with 0 tokens remaining
- WHEN `tryConsume("conn-1")` is called
- THEN it returns `false`

#### Scenario: Tokens refill over time

- GIVEN a bucket with 0 tokens
- WHEN 1 second elapses
- THEN `tryConsume("conn-1")` returns `true` (1 token refilled)

#### Scenario: Isolated buckets

- GIVEN "conn-1" has 0 tokens and "conn-2" has 10 tokens
- WHEN `tryConsume("conn-2")` is called
- THEN it returns `true`

#### Scenario: Stale buckets are cleaned up

- GIVEN idle buckets older than 5 minutes
- WHEN the cleanup routine runs
- THEN those buckets are removed from memory

### R7: Integration — Full Round-Trip

#### Scenario: Play tile reaches all players

- GIVEN 4 players connected to "match-1" with valid tokens
- WHEN "p2" sends `{"type":"play_tile","tileId":"t1","side":"right"}`
- THEN all 4 players receive a `tile_played` event via their WebSocket
- AND the connection map remains unchanged
