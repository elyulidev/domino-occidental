# Tasks: Lobby Stats Phase 2 — Profile & Leaderboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | JWT auth guard + profile/me endpoint + tests | PR 1 | base: feature/lobby-stats-phase2; ~120 lines |
| 2 | Leaderboard endpoint + tests | PR 2 | base: PR 1 branch; ~100 lines |
| 3 | Frontend API client + lobby refactor | PR 3 | base: PR 2 branch; ~150 lines |

## Phase 1: Auth Infrastructure

- [x] 1.1 Add `@elysiajs/jwt` dependency to `packages/backend/package.json` and run `bun install`
- [x] 1.2 Add `country` column (CHAR(2), nullable) to Drizzle schema in `packages/backend/src/db/schema/profiles.ts`
- [x] 1.3 Create `packages/backend/src/auth/guard.ts` — Elysia guard plugin using `@elysiajs/jwt` with `SUPABASE_JWT_SECRET` (HS256). Reads `Authorization: Bearer <token>`, verifies JWT, injects `userId` from `sub` claim. Returns 401 on missing/invalid token.
- [x] 1.4 Create `packages/backend/src/auth/__tests__/guard.test.ts` — Test: valid token injects userId; missing token returns 401; invalid token returns 401

## Phase 2: Profile Endpoint

- [x] 2.1 Create `packages/backend/src/routes/profile.ts` — `GET /api/v1/profile/me` behind JWT guard. Query `profiles` table for user's id, username, avatar_url, elo, coins, country. Compute rank as `COUNT(*) + 1 WHERE elo > my_elo`. Return typed response.
- [x] 2.2 Create `packages/backend/src/routes/__tests__/profile.test.ts` — Test: authenticated user gets profile with rank; rank reflects ELO position; same ELO yields same rank
- [x] 2.3 Mount profile routes in `packages/backend/src/server.ts` with JWT guard applied

## Phase 3: Leaderboard Endpoint

- [x] 3.1 Create `packages/backend/src/routes/leaderboard.ts` — `GET /api/v1/leaderboard/individual?page=1&limit=10` behind JWT guard. Query profiles ordered by `elo DESC, created_at ASC`. Paginate with `total`, `page`, `totalPages`. Same ELO = same rank (dense rank by elo group).
- [x] 3.2 Create `packages/backend/src/routes/__tests__/leaderboard.test.ts` — Test: first page returns ≤10 entries; pagination works (25 users, page=2 returns 11–20, totalPages=3); same ELO share rank
- [x] 3.3 Mount leaderboard routes in `packages/backend/src/server.ts`

## Phase 4: Frontend API Client

- [x] 4.1 Create `packages/frontend/src/lib/api/client.ts` — `apiFetch(path, options)` helper that gets Supabase session token via `createBrowserClient().auth.getSession()` and attaches `Authorization: Bearer <token>`. Uses Next.js rewrite (`/api/v1/...` → backend).
- [x] 4.2 Create `packages/frontend/src/lib/api/types.ts` — TypeScript types for `ProfileResponse` and `LeaderboardResponse` matching backend shapes

## Phase 5: Lobby Refactor

- [x] 5.1 Convert `packages/frontend/src/app/(dashboard)/lobby/page.tsx` from server component to client component (`"use client"`)
- [x] 5.2 Replace hardcoded profile badges (username, elo, coins, rank) with data from `GET /api/v1/profile/me` via `apiFetch`. Show loading skeleton, handle 401 with login redirect.
- [x] 5.3 Replace hardcoded leaderboard section with data from `GET /api/v1/leaderboard/individual`. Add basic table/list with rank, username, elo, avatar. Handle empty/error states.

## Phase 6: Verification

- [x] 6.1 Run `bun test` in `packages/backend` — all tests pass
- [x] 6.2 Run `bun run biome:check` from root — no lint/format errors
- [ ] 6.3 Manual smoke test: start backend + frontend, log in, verify lobby shows real data
