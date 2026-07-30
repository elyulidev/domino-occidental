# Proposal: Worker Standalone — Kill Render for Game WS & Matchmaking

## Intent

CF Workers already handles game logic and matchmaking via Durable Objects. But frontend WS URLs don't match Worker routing patterns, and the `/matchmaking/quick` endpoint doesn't exist in the Worker. Meanwhile, `next.config.ts` still rewrites matchmaking HTTP traffic to Render (Elysia). Close these gaps so the frontend talks directly to Workers — making Render unnecessary for these routes.

## Scope

### In Scope
- Update `index.ts` regexes to accept frontend WS path patterns
- Add `/matchmaking/quick` HTTP alias in MatchmakingDO
- Point `next.config.ts` rewrite to Worker URL
- Update tests for new patterns and endpoint
- Deploy + verify in dev

### Out of Scope
- Full REST API (`/api/v1/*`) — profile, friends, tournaments, shop (stays on Render)
- Elysia WS cleanup — keep dual-run until verified
- Removing Render entirely (REST still needs it)

## Capabilities

**New**: None — no new capabilities, only routing/aliasing.

**Modified**: None — spec-level behavior unchanged. `/quick` delegates to existing `/enqueue`.

## Approach

1. **index.ts** — `GAME_WS_RE`: `/^\/ws\/game\/([^/]+)(?:\/([^/]+))?$/` (optional playerId). `MATCHMAKING_WS_RE`: `/^\/ws\/matchmaking\/([^/]+)$/` (capture userId, ignore it — DO uses `?token=`).
2. **MatchmakingDO.fetch()** — Add `path.endsWith("/quick")` route aliasing to `handleEnqueue()`.
3. **next.config.ts** — Rewrite `/matchmaking/*` → `WORKER_URL/matchmaking/*` using `NEXT_PUBLIC_WORKER_URL`. Add same env var to `.env.production` and Vercel.
4. **Tests** — Update `index.unit.test.ts` for new WS path patterns. Add `/matchmaking/quick` test. Update WS URL mocks in frontend if needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/workers/src/index.ts` | Modified | WS regexes (`GAME_WS_RE`, `MATCHMAKING_WS_RE`) |
| `packages/workers/src/matchmaking-do.ts` | Modified | Add `/quick` → `handleEnqueue` alias |
| `packages/frontend/next.config.ts` | Modified | Rewrite target → Worker URL |
| `packages/frontend/.env.production` | Modified | Add `NEXT_PUBLIC_WORKER_URL` |
| `packages/workers/src/index.unit.test.ts` | Modified | New path patterns + `/quick` test |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| WS path change breaks active connections | Low | Dual-run: Elysia WS still up, rollback via env var |
| `/quick` alias diverges from `/enqueue` | Low | Single handler function — no divergence possible |
| Worker URL misconfigured in prod | Low | Dev fallback to `ws://localhost:3001` |

## Rollback Plan

- Revert `next.config.ts` rewrite to point back to `BACKEND_URL`
- Revert `index.ts` regex changes via `git revert`
- Elysia WS stays running during transition — zero downtime

## Dependencies

- CF Worker deployed with updated routing
- `NEXT_PUBLIC_WORKER_URL` set in Vercel + `.env.production`

## Success Criteria

- [ ] Frontend WS connects to Worker via `/ws/game/{matchId}/{playerId}` and `/ws/matchmaking/{userId}?token=`
- [ ] `POST /matchmaking/quick` returns same result as `POST /enqueue`
- [ ] All worker tests pass with updated path patterns
- [ ] Matchmaking → game flow works end-to-end through Worker
