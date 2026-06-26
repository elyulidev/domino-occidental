# Tasks: Module 10 — Event Broadcaster

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 160-200 lines |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | Single PR with work-unit commits |
| Delivery strategy | force-chained with stacked-to-main |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | src/ws/broadcaster.ts source implementation | PR 1 | Core module with TDD tests |
| 2 | src/ws/__tests__/broadcaster.test.ts test suite | PR 2 | All 12 event type routing tests |

## Phase 1: Infrastructure / Test Foundations

- [ ] 1.1 Create `src/ws/broadcaster.ts` with type definitions
- [ ] 1.2 Create `src/ws/__tests__/broadcaster.test.ts` test file
- [ ] 1.3 Implement test infrastructure and mock `SendFn`

## Phase 2: Event Routing Implementation

- [ ] 2.1 Implement `broadcastEvents` function with event routing logic
- [ ] 2.2 Add routing rules: `game_error` private, all others broadcast
- [ ] 2.3 Add support for optional `playerIds` parameter
- [ ] 2.4 Add state attachment logic for `SanitizedMatchState`

## Phase 3: Error Handling and Resilience

- [ ] 3.1 Add error handling in `broadcastEvents` for `sendFn` failures
- [ ] 3.2 Add error catching to protect remaining recipients
- [ ] 3.3 Add logging for failed `sendFn` calls

## Phase 4: State Push and Targeted Delivery

- [ ] 4.1 Implement `sendState` function
- [ ] 4.2 Add state attachment to target player
- [ ] 4.3 Verify state structure matches `WsServerMessage` envelope

## Phase 5: Comprehensive Coverage

- [ ] 5.1 Test all 12 event types with private vs broadcast routing
- [ ] 5.2 Test empty events array behavior
- [ ] 5.3 Test mixed event type batches
- [ ] 5.4 Test `playerIds` override functionality
- [ ] 5.5 Test state included/omitted scenarios
- [ ] 5.6 Test error resilience in `broadcastEvents`
- [ ] 5.7 Test `sendState` functionality
- [ ] 5.8 Validate all existing tests still pass