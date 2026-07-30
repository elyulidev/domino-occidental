# Tasks: Worker Standalone — Kill Render for Game WS & Matchmaking

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~80–95 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr (size-exception not needed — well under budget)
400-line budget risk: Low

## Phase 1: Source Changes (Worker + Frontend)

- [x] 1.1 `packages/workers/src/index.ts:10-11` — Update `GAME_WS_RE` to `/^\/ws\/game\/([\w-]+)(?:\/([\w-]+))?$/` (optional playerId segment). Update `MATCHMAKING_WS_RE` to `/^\/ws\/matchmaking\/([\w-]+)$/` (require userId segment).
- [x] 1.2 `packages/workers/src/matchmaking-do.ts:61` — Add `|| path.endsWith("/quick")` to the existing POST `/enqueue` guard. No new handler, no branching.
- [x] 1.3 `packages/frontend/next.config.ts:3` — Add `const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787"`. Replace the `/matchmaking` rewrite destination from `BACKEND_URL` to `WORKER_URL` (lines 24-25).
- [x] 1.4 `packages/frontend/.env.production` — Add `NEXT_PUBLIC_WORKER_URL=https://domino-occidental.elyuli-dev.workers.dev` placeholder.

## Phase 2: Test Updates (Worker)

- [x] 2.1 `packages/workers/src/index.unit.test.ts` — Add test: `GAME_WS_RE` matches `/ws/game/m-1/p42`, matchId = `m-1`. Add test: `MATCHMAKING_WS_RE` matches `/ws/matchmaking/u99`. Add test: `/ws/matchmaking` (no userId) returns 404. Update existing `/ws/matchmaking` test (line 56) to use `/ws/matchmaking/user-1`.
- [x] 2.2 `packages/workers/src/matchmaking-do.unit.test.ts` — Add test under "HTTP API": POST `/quick` returns same shape as POST `/enqueue` (200, `{ ok: true, queueCount: 1 }`). Add test: POST `/quick` rejects missing elo (400).
- [x] 2.3 `packages/workers/src/matchmaking-do.integration.test.ts` — Add test: POST `/matchmaking/quick` enqueues player, verify via GET `/status`.

## Phase 3: Verification

- [x] 3.1 Run `bun test` — all worker tests pass (unit + integration).
- [x] 3.2 Run `bun run build` — frontend builds with new env var.
- [x] 3.3 Verify `/ws/game/m-1` and `/ws/game/m-1/p42` both route to GameDO in worker logs.
- [x] 3.4 Verify `POST /matchmaking/quick` and `POST /matchmaking/enqueue` return identical responses.
