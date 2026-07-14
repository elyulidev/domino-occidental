# Proposal: Lobby Stats Phase 2 — Auth, Profile & Leaderboard Endpoints

## Intent

The lobby UI shows hardcoded placeholders ("JugadorDemo", ELO "1,200"). Phase 1 added `elo`/`coins` to `profiles` but there's no backend serving real data. The backend has no JWT auth middleware — `ws/auth.ts` only covers WebSocket. This phase creates authenticated REST endpoints and wires the frontend to real data.

## Scope

### In Scope
- Add `@elysiajs/jwt` to backend (`bun add @elysiajs/jwt`)
- Create JWT auth guard for Elysia — verify Supabase Bearer tokens via `@elysiajs/jwt` plugin (wraps `jose` internally)
- Create `GET /api/v1/profile/me` — returns username, elo, coins, ranking position
- Create `GET /api/v1/leaderboard/individual` — returns top N players + requester's rank
- Create frontend API client with auth headers
- Refactor lobby page to fetch real data instead of hardcoded placeholders

### Out of Scope
- Matchmaking queue wiring (Phase 3)
- `elo_history` tracking
- Real-time queue count
- Profile editing via REST (existing page uses Supabase directly)
- Admin endpoints

## Capabilities

### New Capabilities
- `backend-auth-guard`: Elysia JWT auth guard — `@elysiajs/jwt` plugin that verifies Supabase Bearer tokens, extracts `sub` (user_id) into request context, returns 401 on invalid/missing tokens
- `lobby-profile-api`: `GET /api/v1/profile/me` — authenticated endpoint returning username, elo, coins, and ranking position
- `leaderboard-api`: `GET /api/v1/leaderboard/individual` — top N players by ELO + requester's rank position

### Modified Capabilities
- `player-stats`: Requirements unchanged — this phase consumes `elo`/`coins` columns but adds query endpoints

## Approach

1. **Install `@elysiajs/jwt`** via `bun add @elysiajs/jwt` in `packages/backend`
2. **Auth guard**: Elysia JWT plugin configured with `SUPABASE_JWT_SECRET`. Decorate routes with `jwtVerify()` guard. Extract `sub` claim → inject `userId` into context. Return 401 on failure.
3. **`/api/v1/profile/me`**: Guard-protected. Query `profiles` by `userId` from JWT `sub`. Compute ranking via `SELECT COUNT(*) FROM profiles WHERE elo > my_elo + 1`.
4. **`/api/v1/leaderboard/individual`**: Guard-protected. Query `profiles ORDER BY elo DESC LIMIT :n`. Compute requester's rank in same query.
5. **Frontend API client**: `fetch('/api/v1/...')` with `Authorization` header from `supabase.auth.getSession()`.
6. **Lobby refactor**: Replace hardcoded values with API calls via React hooks.

### Why `@elysiajs/jwt` instead of raw `jose`?

The `@elysiajs/jwt` plugin wraps `jose` with Elysia-native decorators and guards. It integrates directly with Elysia's type system and request lifecycle — no manual `Authorization` header parsing, no `Context.set()` hacks. The guard reads cleaner, stays consistent with Elysia patterns, and future-proofs against Elysia version updates.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/backend/package.json` | Modified | Add `@elysiajs/jwt` dependency |
| `packages/backend/src/auth/guard.ts` | New | Elysia JWT auth guard using `@elysiajs/jwt` |
| `packages/backend/src/routes/profile.ts` | New | `GET /api/v1/profile/me` |
| `packages/backend/src/routes/leaderboard.ts` | New | `GET /api/v1/leaderboard/individual` |
| `packages/backend/src/server.ts` | Modified | Register JWT plugin + new routes |
| `packages/frontend/src/lib/api/client.ts` | New | API client with auth headers |
| `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | Modified | Fetch real data from API |
| `.env` / `.env.local` | Modified | Add `SUPABASE_JWT_SECRET` to backend env |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `SUPABASE_JWT_SECRET` not in backend `.env` | High | Guard returns clear 401 if secret missing; add to env checklist |
| RS256 vs HS256 confusion (Supabase uses HS256) | Medium | `@elysiajs/jwt` defaults to HS256; verify Supabase config |
| Frontend token expiry during long lobby session | Low | Supabase client auto-refreshes; API client handles 401 → refresh retry |
| Ranking query performance on large `profiles` | Low | `COUNT(*)` with indexed `elo`; acceptable for MVP scale |

## Rollback Plan

- Revert `server.ts` route registrations (additive only, no existing routes changed)
- Delete `auth/guard.ts`, `routes/profile.ts`, `routes/leaderboard.ts`
- Revert `lobby/page.tsx` to hardcoded values
- Remove `@elysiajs/jwt` from `package.json`
- No DB changes to revert (Phase 1 columns remain)

## Dependencies

- Phase 1 completed: `elo` and `coins` columns exist on `profiles`
- `SUPABASE_JWT_SECRET` env var available to backend (HS256 HMAC from Supabase dashboard)
- Frontend Supabase client configured (`packages/frontend/src/lib/supabase/client.ts`)

## Success Criteria

- [ ] `GET /api/v1/profile/me` returns `{ username, elo, coins, rank }` with valid Bearer token
- [ ] `GET /api/v1/profile/me` returns 401 without token or with invalid token
- [ ] `GET /api/v1/leaderboard/individual` returns `{ leaderboard: [...], myRank }` with valid token
- [ ] Lobby page displays real username, ELO, and coins from API
- [ ] `bun test` passes for auth guard and route handlers
- [ ] `bun run build` succeeds

## Proposal Question Round

1. **Leaderboard page size**: Top 10, 20, or 50? Should requester's rank always be included even outside the top N?

2. **Unauthenticated lobby**: If a user visits `/lobby` without logging in, do they see the leaderboard (public read), or is the entire page gated?

3. **Ranking tie-breaker**: Same ELO → alphabetical by username? Registration date? Or same rank is fine?

4. **Coins visibility**: Should `coins` appear on the public leaderboard, or only on the user's own profile?

5. **Backend route prefix**: Existing dev endpoint is `/api/v1/dev/create-match`. Should profile/leaderboard follow `/api/v1/`?
