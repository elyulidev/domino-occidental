# Design: Worker Standalone — Kill Render for Game WS & Matchmaking

## Technical Approach

Update Worker routing regexes in `index.ts` to accept the WS path patterns the frontend actually sends, add a `/quick` alias in `MatchmakingDO.fetch()`, and redirect the `next.config.ts` rewrite from Render to the Worker URL. Four atomic file changes, zero new dependencies, no architecture changes.

## Architecture Decisions

### Decision: Regex — optional vs required second segment

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `/^\/ws\/game\/([^/]+)(?:\/([^/]+))?$/` | Backward-compatible (plain `/ws/game/:id` still works) | ✅ Chosen |
| `/^\/ws\/game\/([^/]+)\/([^/]+)$/` | Breaks existing clients without playerId | ❌ Rejected |
| Two separate regexes | More code, same effect | ❌ Over-engineering |

### Decision: Regex — `/ws/matchmaking/:userId` required (no legacy fallback)

The new regex `/^\/ws\/matchmaking\/([^/]+)$/` requires the userId segment. The old bare `/ws/matchmaking` is intentionally dropped — frontend always sends the segment, and the spec explicitly says legacy path returns 404.

### Decision: `/quick` is a route alias, not a separate handler

A single `|| path.endsWith("/quick")` guard in the existing `POST /enqueue` branch — zero behavioral divergence by construction. No new function, no abstraction.

### Decision: `next.config.ts` — use `NEXT_PUBLIC_WORKER_URL`, not `BACKEND_URL`

The Worker must be targetable independently of Render. The existing `BACKEND_URL` points to Render (Elysia). Adding `NEXT_PUBLIC_WORKER_URL` (fallback: `http://localhost:8787` for wrangler dev) lets us migrate matchmaking traffic without touching the REST `/api/*` rewrite.

## Data Flow

```
┌─ Frontend (Next.js) ──────────────────────────────────────┐
│                                                            │
│  POST /matchmaking/quick                                   │
│       │                                                    │
│       ▼ next.config.ts rewrite                             │
│  WORKER_URL/matchmaking/quick                              │
│       │                                                    │
│       ▼ CF Worker (index.ts)                               │
│  MATCHMAKING_HTTP_RE matches → MatchmakingDO singleton     │
│       │                                                    │
│       ▼ MatchmakingDO.fetch()                              │
│  path.endsWith("/quick") → handleEnqueue()                 │
│       │                                                    │
│       ▼ Response ← { ok: true, queueCount: N }             │
└────────────────────────────────────────────────────────────┘

WS path translation (regex only, no routing logic change):

  /ws/game/m-1          → GAME_WS_RE matches, matchId=m-1
  /ws/game/m-1/p42      → GAME_WS_RE matches, matchId=m-1
  /ws/matchmaking/u99   → MATCHMAKING_WS_RE matches
  /ws/matchmaking       → no match → 404
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/workers/src/index.ts` | Modify | Lines 10-11: new regex patterns |
| `packages/workers/src/matchmaking-do.ts` | Modify | Line 61: add `/quick` alias |
| `packages/frontend/next.config.ts` | Modify | Line 3: add `NEXT_PUBLIC_WORKER_URL`. Lines 24-25: rewrite to Worker |
| `packages/frontend/.env.production` | Modify | Add `NEXT_PUBLIC_WORKER_URL` placeholder |
| `packages/workers/src/index.unit.test.ts` | Modify | Add tests for new WS path patterns |
| `packages/workers/src/matchmaking-do.unit.test.ts` | Modify | Add `/quick` test (HTTP API section) |
| `packages/workers/src/matchmaking-do.integration.test.ts` | Modify | Add `/quick` integration test |

## Regex Changes

**Before (index.ts:10-11):**
```typescript
const GAME_WS_RE = /^\/ws\/game\/([^/]+)$/;
const MATCHMAKING_WS_RE = /^\/ws\/matchmaking$/;
```

**After:**
```typescript
const GAME_WS_RE = /^\/ws\/game\/([^/]+)(?:\/([^/]+))?$/;
const MATCHMAKING_WS_RE = /^\/ws\/matchmaking\/([^/]+)$/;
```

`GAME_WS_RE` changes: added `(?:\/([^/]+))?$` — optional non-capturing group for the extra path segment. `matchId` stays as `gameMatch[1]`; `gameMatch[2]` (playerId) is captured but unused — routing and auth use JWT.

`MATCHMAKING_WS_RE` changes: from bare `/ws/matchmaking` to `/ws/matchmaking/:userId`. The `.test()` call in the router (line 33) doesn't use capture groups so no routing logic changes needed.

## Code Snippets

**matchmaking-do.ts:61** — `/quick` alias:
```typescript
// POST /enqueue or /quick
if (request.method === "POST" && (path.endsWith("/enqueue") || path.endsWith("/quick"))) {
  return this.handleEnqueue(request);
}
```

**next.config.ts** — rewrite to Worker:
```typescript
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

// In rewrites():
{
  source: "/matchmaking/:path*",
  destination: `${WORKER_URL}/matchmaking/:path*`,
}
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Game WS: no playerId | `expect(GAME_WS_RE.test("/ws/game/m-1")).toBe(true)` — matchId=`m-1` |
| Unit | Game WS: with playerId | `expect(GAME_WS_RE.test("/ws/game/m-1/p42")).toBe(true)` — matchId=`m-1` |
| Unit | Game WS: invalid chars | `expect(GAME_WS_RE.test("/ws/game/invalid@#$")).toBe(false)` |
| Unit | MM WS: with userId | `expect(MATCHMAKING_WS_RE.test("/ws/matchmaking/u99")).toBe(true)` |
| Unit | MM WS: legacy path | `expect(MATCHMAKING_WS_RE.test("/ws/matchmaking")).toBe(false)` |
| Unit | MatchmakingDO: POST /quick → enqueue | Same response shape as POST /enqueue, OK status |
| Unit | MatchmakingDO: POST /quick → 400 on missing elo | Same validation as /enqueue |
| Integ | MatchmakingDO: POST /quick full flow | enqueue via /quick, verify via /status |

No new test files — add to existing `index.unit.test.ts`, `matchmaking-do.unit.test.ts`, and `matchmaking-do.integration.test.ts`.

## Migration / Rollout

No data migration required. Dual-run: Elysia WS still handles the old `/ws/matchmaking` and `/ws/game/:id` paths while the Worker serves the new ones. After verification, clean up Elysia WS. Rollback is `git revert` on the four modified files.

## Open Questions

None — all decisions resolved by specs and codebase reading.
