# Tasks: Module 11 — WS Connection Handler

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700 lines total (250 in PR1, 420 in PR2) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 (stacked-to-main) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add elysia dependency in `package.json` | PR 1 | Base branch: main |
| 2 | Create `src/ws/connection.ts` with core infrastructure | PR 1 | Base branch: main |
| 3 | Implement Auth + Rate Limiter utilities | PR 1 | Base branch: main |
| 4 | Integrate Auth + Rate Limiter into connection.ts | PR 1 | Base branch: PR 1 merged |
| 5 | Create tests for connection manager | PR 1 | Base branch: PR 1 merged |
| 6 | Create tests for Auth and Rate Limiter | PR 1 | Base branch: PR 1 merged |
| 7 | Full integration: wire to game engine (handleMessage/broadcastEvents) | PR 2 | Base branch: PR 1 merged |

## Phase 1: Infrastructure / Foundation

- [x] 1.1 Add `elysia@^1.4.x` to `package.json`
- [x] 1.2 Create `src/ws/connection.ts` with module setup and imports
- [x] 1.3 Create connection map CRUD operations (`joinMatch`, `leaveMatch`, `getConnection`)
- [x] 1.4 Create `SendFn` factory function in `src/ws/connection.ts`
- [x] 1.5 Create Elysia WS plugin in `src/ws/connection.ts` with basic `open`/`message`/`close` hooks
- [x] 1.6 Create `src/ws/__tests__/connection.test.ts` with unit tests for connection map CRUD
- [ ] 1.7 Create `src/ws/auth.ts` with `verifyToken(token)` function (→ PR2)
- [ ] 1.8 Create `src/ws/rate-limiter.ts` with `createRateLimiter()` implementation (→ PR2)

## Phase 2: Core Implementation

- [ ] 2.1 Update `src/ws/connection.ts` to integrate JWT verification in `open` hook (→ PR2)
- [ ] 2.2 Update `src/ws/connection.ts` to integrate rate limiter in `message` hook (→ PR2)
- [x] 2.3 Update `src/ws/connection.ts` to wire `handleMessage()` and `broadcastEvents()` with spec R2-R4
- [x] 2.4 Wire `disconnectPlayer()` call in `close` hook (spec R3)
- [x] 2.5 Wire `reconnectPlayer()` call in `open` hook (spec R3)
- [x] 2.6 Create integration tests for full round-trip (spec R7)
- [ ] 2.7 Create `src/ws/__tests__/auth.test.ts` with token validation tests (→ PR2)
- [ ] 2.8 Create `src/ws/__tests__/rate-limiter.test.ts` with rate limiting tests (→ PR2)

## Phase 3: Testing / Verification

- [x] 3.1 Create `sendToPlayer` implementation for connection map lookup
- [x] 3.2 Run `bun test` to ensure unit tests for connection manager pass
- [ ] 3.3 Run `bun test` to ensure unit tests for auth pass (→ PR2)
- [ ] 3.4 Run `bun test` to ensure unit tests for rate-limiter pass (→ PR2)
- [x] 3.5 Verify all spec requirements R1-R7 are satisfied

## Phase 4: Cleanup / Documentation

- [ ] 4.1 Update project docs with WS connection module details
- [ ] 4.2 Remove temporary code from test files
- [ ] 4.3 Ensure error cases are covered in tests
- [ ] 4.4 Update changelog with WS connection features