# Delta for worker-routing

## ADDED Requirements

### Requirement: Game WS Route with Optional PlayerId

The Worker router SHALL accept WebSocket connections at `/ws/game/:matchId` AND `/ws/game/:matchId/:playerId`. The extra path segment SHALL be ignored for routing — identity SHALL come from JWT `?token=` query param.

#### Scenario: Connection with playerId path

- GIVEN a WS URL `/ws/game/m-1/p42?token=xxx`
- WHEN the router matches `GAME_WS_RE`
- THEN the matchId `"m-1"` is extracted
- AND the request is forwarded to the Game DO for `matchId`
- AND `playerId` from the path is not used for auth

#### Scenario: Connection without playerId path

- GIVEN a WS URL `/ws/game/m-1?token=xxx`
- WHEN the router matches `GAME_WS_RE`
- THEN the matchId `"m-1"` is extracted
- AND the request is forwarded to the Game DO as before

#### Scenario: Invalid matchId format rejected

- GIVEN a WS URL `/ws/game/invalid@#$?token=xxx`
- WHEN the router evaluates `GAME_WS_RE`
- THEN no match is found
- AND the request returns HTTP 404

### Requirement: Matchmaking WS Route with UserId

The Worker router SHALL accept WebSocket connections at `/ws/matchmaking/:userId`. The `userId` path segment SHALL be captured but not used for identity — identity SHALL come from JWT `?token=` query param.

#### Scenario: Connection with userId path

- GIVEN a WS URL `/ws/matchmaking/u99?token=xxx`
- WHEN the router matches `MATCHMAKING_WS_RE`
- THEN the request is forwarded to the Matchmaking DO
- AND `userId` from the path is not used for auth
- AND the DO tags the connection with the `sub` claim from JWT

#### Scenario: Connection without userId path (legacy)

- GIVEN a WS URL `/ws/matchmaking?token=xxx`
- WHEN the router evaluates `MATCHMAKING_WS_RE`
- THEN no match is found (legacy pattern not supported by this router)
- AND the request falls through to the default handler

### Requirement: Matchmaking Quick Endpoint Alias

The MatchmakingDO SHALL accept `POST /matchmaking/quick` as an alias for `POST /matchmaking/enqueue`. Both paths SHALL execute the same handler function — no behavioral divergence.

#### Scenario: Quick alias returns same result as enqueue

- GIVEN an authenticated user not in queue
- WHEN `POST /matchmaking/quick` is sent
- THEN the handler calls `handleEnqueue()`
- AND the response is identical to `POST /matchmaking/enqueue`
- AND the user is added to the queue

#### Scenario: Already-queued user rejected via quick

- GIVEN a user already in the queue
- WHEN `POST /matchmaking/quick` is sent
- THEN the response is HTTP 409 Conflict
- AND the behavior matches `POST /matchmaking/enqueue`

### Requirement: Frontend Rewrite to Worker

The frontend `next.config.ts` SHALL rewrite `/matchmaking/*` HTTP requests to `WORKER_URL/matchmaking/*`. The `NEXT_PUBLIC_WORKER_URL` env var SHALL be set in `.env.production` and Vercel.

#### Scenario: Matchmaking request routed to Worker

- GIVEN the frontend at `NEXT_PUBLIC_API_URL`
- WHEN the browser sends `POST /matchmaking/quick`
- THEN Next.js rewrites it to `WORKER_URL/matchmaking/quick`
- AND the Worker receives the request instead of Render

#### Scenario: Worker URL fallback in dev

- GIVEN `NEXT_PUBLIC_WORKER_URL` is not set in local dev
- WHEN the frontend starts dev server
- THEN the rewrite falls back to `ws://localhost:3001`
- AND matchmaking still works locally

### Requirement: Routing Test Coverage

The Worker tests SHALL cover the new path patterns for WS routes and the `/quick` HTTP alias.

#### Scenario: Game WS regex matches both patterns

- GIVEN the `GAME_WS_RE` regex
- WHEN tested against `/ws/game/m-1` and `/ws/game/m-1/p42`
- THEN both match with correct matchId capture

#### Scenario: Matchmaking WS regex captures userId

- GIVEN the `MATCHMAKING_WS_RE` regex
- WHEN tested against `/ws/matchmaking/u99`
- THEN it matches and `"u99"` is captured
- AND `/ws/matchmaking` (without userId) does NOT match

#### Scenario: Quick endpoint integration test

- GIVEN the MatchmakingDO is running
- WHEN a test sends `POST /matchmaking/quick` with valid auth
- THEN the response status and body match `POST /matchmaking/enqueue`
