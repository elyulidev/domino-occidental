# Profile & Leaderboard Specification

## Purpose

Serve authenticated user profile data and leaderboard rankings via REST endpoints, and wire the frontend lobby to display real data. Covers JWT auth guard, profile/me endpoint, and paginated leaderboard.

---

## Requirements

### Requirement: JWT Auth Guard

The system MUST verify Supabase Bearer tokens on protected Elysia routes using `@elysiajs/jwt` configured with `SUPABASE_JWT_SECRET` (HS256). On success, the guard MUST inject `userId` (from JWT `sub` claim) into the request context. On failure, the guard MUST return HTTP 401.

#### Scenario: Request with valid token

- GIVEN a request includes `Authorization: Bearer <valid-supabase-jwt>`
- WHEN the request reaches a guarded route
- THEN the guard extracts `sub` from the JWT payload
- AND injects `userId` into the request context
- AND the route handler executes

#### Scenario: Request without token

- GIVEN a request has no `Authorization` header
- WHEN the request reaches a guarded route
- THEN the guard returns HTTP 401 with `{ error: "unauthorized" }`
- AND the route handler does NOT execute

#### Scenario: Request with invalid or expired token

- GIVEN a request includes `Authorization: Bearer <invalid-or-expired-token>`
- WHEN the request reaches a guarded route
- THEN the guard returns HTTP 401 with `{ error: "unauthorized" }`

---

### Requirement: Profile Me Endpoint

The system MUST expose `GET /api/v1/profile/me` behind the JWT auth guard. The endpoint MUST return the authenticated user's `id`, `username`, `avatar_url`, `elo`, `coins`, `country`, and `rank`. The `rank` MUST be computed as `COUNT(*) + 1` from `profiles WHERE elo > my_elo` (same ELO = same rank via `>` operator).

#### Scenario: Authenticated user fetches own profile

- GIVEN a user is authenticated with a valid JWT
- WHEN the user requests `GET /api/v1/profile/me`
- THEN the endpoint returns HTTP 200
- AND the response contains `{ id, username, avatar_url, elo, coins, country, rank }`

#### Scenario: Rank reflects ELO position

- GIVEN user A has `elo = 1500` and 3 users have `elo > 1500`
- WHEN user A requests `GET /api/v1/profile/me`
- THEN `rank` equals `4`

#### Scenario: Same ELO yields same rank

- GIVEN users A and B both have `elo = 1400`
- WHEN user A requests `GET /api/v1/profile/me`
- THEN `rank` equals the count of users with `elo > 1400` plus 1
- AND user B would receive the same `rank`

---

### Requirement: Leaderboard Endpoint

The system MUST expose `GET /api/v1/leaderboard/individual` behind the JWT auth guard. The endpoint MUST return a paginated list ordered by `elo DESC, created_at ASC`. Default page size is 10. Same ELO = same rank position. Response MUST include `data`, `total`, `page`, and `totalPages`.

#### Scenario: First page of leaderboard

- GIVEN a user is authenticated
- WHEN the user requests `GET /api/v1/leaderboard/individual?page=1&limit=10`
- THEN the response contains `{ data: [...], total, page: 1, totalPages }`
- AND `data` has at most 10 entries
- AND each entry contains `{ rank, username, elo, avatar_url }`
- AND entries are ordered by `elo DESC, created_at ASC`

#### Scenario: Pagination works

- GIVEN 25 registered users
- WHEN the user requests `GET /api/v1/leaderboard/individual?page=2&limit=10`
- THEN `data` contains entries 11–20
- AND `totalPages` equals 3

#### Scenario: Same ELO players share rank

- GIVEN users A (`elo=1400`), B (`elo=1400`), C (`elo=1300`)
- WHEN the leaderboard is returned
- THEN A and B both have `rank = 1`
- AND C has `rank = 3` (not 2)

---

### Requirement: Frontend Lobby Real Data

The lobby page MUST replace hardcoded profile and leaderboard placeholders with API calls to `/api/v1/profile/me` and `/api/v1/leaderboard/individual`. The API client MUST attach the Supabase session token as `Authorization: Bearer <token>`.

#### Scenario: Lobby displays real user data

- GIVEN a user is logged in
- WHEN the lobby page loads
- THEN the profile section shows the user's real `username`, `elo`, `coins`, and `rank`
- AND the leaderboard section shows real player rankings

#### Scenario: Unauthenticated lobby access

- GIVEN a user is NOT logged in
- WHEN the lobby page loads
- THEN API calls return 401
- AND the UI shows a login prompt or fallback state (no crash)

---

## Out of Scope

- `player-stats` spec unchanged — this phase consumes `elo`/`coins` columns added in Phase 1
- Matchmaking queue (Phase 3)
- `elo_history` tracking
- Coins visibility on leaderboard (coins shown in profile only)
- Friends list, tournaments (stay hardcoded)
