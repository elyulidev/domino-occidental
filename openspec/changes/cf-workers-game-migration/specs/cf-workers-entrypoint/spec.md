# CF Worker Entrypoint Specification

## Purpose

Cloudflare Worker entrypoint (`packages/workers/src/index.ts`) routing incoming WS upgrade requests to the correct Durable Object. Handles path-based dispatch, environment config via `wrangler.toml`, and request forwarding.

## Requirements

### Requirement: WS Routing

The system SHALL route WS upgrade requests based on URL path:
- `/ws/game/:matchId` → `env.GAME_DO.get(matchId)`
- `/ws/matchmaking/:userId` → singleton `env.MATCHMAKING_DO.get("matchmaking")`
- All other paths → HTTP 404

#### Scenario: Game WS routes to correct GameDO

- GIVEN a WS upgrade request to `/ws/game/abc-123?token=xxx`
- WHEN the worker processes the request
- THEN it calls `env.GAME_DO.idFromName("abc-123")` and forwards the request

#### Scenario: Matchmaking WS routes to singleton

- GIVEN a WS upgrade request to `/ws/matchmaking/u1?token=xxx`
- WHEN the worker processes the request
- THEN it calls `env.MATCHMAKING_DO.get(env.MATCHMAKING_DO.idFromName("matchmaking"))` and forwards

#### Scenario: Unknown path returns 404

- GIVEN an HTTP request to `/api/unknown`
- WHEN the worker processes it
- THEN HTTP 404 is returned

### Requirement: Environment Configuration

`wrangler.toml` SHALL define DO bindings, variable bindings, and secrets.

| Binding | Type | Name |
|---------|------|------|
| Durable Object | `durable_object` | `GAME_DO` class `GameDO` |
| Durable Object | `durable_object` | `MATCHMAKING_DO` class `MatchmakingDO` |
| Env var | `vars` | `SUPABASE_URL` |
| Env var | `vars` | `SUPABASE_ANON_KEY` |
| Secret | `secret` | `SUPABASE_SERVICE_ROLE_KEY` |
| Secret | `secret` | `SUPABASE_JWT_SECRET` |

#### Scenario: Local dev with miniflare

- GIVEN `wrangler dev` is running locally
- WHEN the worker starts
- THEN DOs are emulated in-memory by miniflare
- AND all env vars are available from `.dev.vars`

### Requirement: Request Forwarding

The system SHALL forward the original HTTP request (including headers and URL) to the DO's `fetch()` handler. The DO handles WS upgrade detection internally via the CF Hibernation API.

#### Scenario: Token reaches DO

- GIVEN a WS request with `?token=eyJ...`
- WHEN the worker forwards to the DO
- THEN the DO's `open` handler can read the token from the request URL

### Requirement: CORS for REST Fallback

The system SHALL NOT handle REST API routes — those remain on Elysia. The worker ONLY handles WS upgrade requests. Any non-WS request to the worker's domain returns 404.

#### Scenario: REST request rejected

- GIVEN a GET request to `/api/v1/match`
- WHEN the worker processes it
- THEN HTTP 404 is returned (REST lives on Elysia)
