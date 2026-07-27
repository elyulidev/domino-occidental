# Delta for ws-connection

## MODIFIED Requirements

### Requirement: R1 — Connection Map

The system SHALL track connections via CF Hibernation API's `getWebSockets()` with tagged connections, replacing the in-memory `Map<string, WebSocket>`. Each connection is tagged with `playerId` (userId) at accept time. No separate connection map is maintained — `getWebSockets()` IS the connection map.

(Previously: Manual `Map<string, ElysiaWS>` maintained by `ConnectionManager`)

#### Scenario: Register connection via tag

- GIVEN a WS `open` event with valid JWT (userId = "u1")
- WHEN `acceptWebSocket(ws, ["u1"])` is called
- THEN `getWebSockets()` includes this socket with tag "u1"

#### Scenario: Reconnect closes old connection

- GIVEN "u1" already has a connection in `getWebSockets()` via tag
- WHEN a new WS `open` arrives for "u1"
- THEN the old connection is found via tag iteration, closed
- AND the new connection is accepted

### Requirement: R3 — Player Connection State

The system SHALL call `disconnectPlayer()` when a WS close event fires and `reconnectPlayer()` when a WS open arrives for a previously disconnected player. Disconnect/reconnect propagate via `alarm()` rescheduling (abandonment timer management), not via `setInterval`.

(Previously: `TimerManager.registerDisconnect()` / `cancelDisconnect()` with `setTimeout`)

#### Scenario: Disconnect sets abandonment timer

- GIVEN P2 disconnects from an active match
- WHEN the `close` handler fires
- THEN `player.isConnected = false`, `abandonmentDue = now + 60_000`
- AND alarm is rescheduled to fire at the new `abandonmentDue`

#### Scenario: Reconnect cancels abandonment

- GIVEN P2 was disconnected, `abandonmentDue` is set
- WHEN P2 reconnects via new WS open
- THEN `abandonmentDue = null`
- AND alarm is rescheduled to `min(heartbeatDue, turnCheckDue)` (no abandonment pending)

### Requirement: R5 — JWT Authentication

The system SHALL verify JWT tokens from WS query param `?token=xxx` using `jose.jwtVerify()` with `SUPABASE_JWT_SECRET`. The `userId` is extracted from the token's `sub` claim. Verification occurs inside each DO's `open` handler, not at the entrypoint.

(Previously: `Bun.CryptoHasher`-based verification at the WS plugin level)

#### Scenario: Token in URL query param

- GIVEN a WS URL `ws://game/m1?token=eyJ...`
- WHEN the GameDO `open` handler runs
- THEN the token is extracted from `new URL(request.url).searchParams.get("token")`

## ADDED Requirements

### Requirement: WS URL Base Configuration

The system SHALL use `NEXT_PUBLIC_WS_URL` env var as the base for all WS connections in the frontend. Default: `ws://localhost:8787` (CF Workers dev port).

#### Scenario: Production URL

- GIVEN `NEXT_PUBLIC_WS_URL=wss://ws.domino-occidental.com`
- WHEN `use-websocket` constructs a connection URL
- THEN the URL is `wss://ws.domino-occidental.com/ws/game/:matchId?token=...`

### Requirement: Token-Only Game URL

The system SHALL pass JWT as `?token=` query param in game WS URLs. The `playerId` is no longer in the URL path — the DO extracts `userId` from the JWT and maps to a player slot server-side.

#### Scenario: New URL format

- GIVEN matchId `m1`, JWT `eyJ...`
- WHEN `use-websocket` connects
- THEN URL is `${WS_BASE_URL}/ws/game/m1?token=eyJ...`
- AND no `playerId` segment in the path

### Requirement: Matchmaking URL Base Change

The system SHALL construct matchmaking WS URLs as `${WS_BASE_URL}/ws/matchmaking/${userId}?token=${token}`. The path structure is identical to Elysia; only the base URL changes.

#### Scenario: Matchmaking URL with new base

- GIVEN `NEXT_PUBLIC_WS_URL=wss://ws.domino-occidental.com`
- WHEN `use-matchmaking` connects
- THEN URL is `wss://ws.domino-occidental.com/ws/matchmaking/u1?token=...`
