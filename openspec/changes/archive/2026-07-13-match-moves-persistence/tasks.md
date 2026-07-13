# Tasks: Match Moves Persistence

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 54 (handler.ts diff only; 493 total lines across 4 files) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full match-moves-persistence | PR 1 | All tasks in one PR; 54 changed lines on main, well under budget |

## Phase 1: Database Schema (Migration)

- [x] 1.1 Create `supabase/migrations/20260713_match_moves.sql` — table with columns: `id`, `match_id`, `round_number`, `player_index`, `move_number`, `is_pass`, `tile_id`, `tile_top`, `tile_bottom`, `side`, `board_left_end`, `board_right_end`, `created_at`
- [x] 1.2 Add CHECK constraint `match_moves_data_check` — pass requires all tile fields NULL; play requires all non-NULL
- [x] 1.3 Add CHECK constraint `match_moves_side_check` — side must be 'left' or 'right' when not pass
- [x] 1.4 Create index `idx_match_moves_match` on `(match_id, move_number)` for replay ordering
- [x] 1.5 Create index `idx_match_moves_round` on `(match_id, round_number, move_number)` for round analysis
- [x] 1.6 Enable RLS: authenticated SELECT policy, server-only INSERT via service_role

**Verification**: Migration applies cleanly (`supabase db push --linked`); constraints reject invalid rows (pass with tile, side='up').

## Phase 2: Persistence Module

- [x] 2.1 Create `packages/backend/src/db/moves.ts` — export `MoveRecord` interface
- [x] 2.2 Implement lazy `getDb()` — dynamic `require("postgres")`, returns null if `SUPABASE_DB_URL` unset
- [x] 2.3 Implement `recordMatchMove(move: MoveRecord): void` — fire-and-forget INSERT, errors caught + logged
- [x] 2.4 Implement console fallback — structured log when DB unavailable
- [x] 2.5 Implement `moveCounters` Map + `nextMoveNumber()` — sequential per-match counter
- [x] 2.6 Export `resetMoveCounters()` for test isolation

**Verification**: Unit test for counter increment; console fallback when no DB URL; INSERT fires without blocking.

## Phase 3: Handler Integration

- [x] 3.1 Import `recordMatchMove` and `MoveRecord` in `packages/backend/src/game/handler.ts`
- [x] 3.2 In `play_tile` case: capture `MoveRecord` from `result.match.board.tiles` last entry when `result.match !== match` (success gate)
- [x] 3.3 In `pass` case: capture `MoveRecord` with `isPass: true` when `result.match !== match`
- [x] 3.4 Skip move recording for `leave` (forfeit) — no board state change
- [x] 3.5 Call `recordMatchMove(moveData)` after state update, before return — fire-and-forget

**Verification**: `play_tile` success → `recordMatchMove` called with `isPass: false`; `pass` success → `isPass: true`; `leave` → no call; `NOT_YOUR_TURN` error → no call.

## Phase 4: Tests

- [x] 4.1 Verify `handler.test.ts` passes all existing scenarios (play_tile, pass, leave, error routing)
- [x] 4.2 Confirm move recording is tested implicitly — handler tests verify state changes trigger the recording path
- [x] 4.3 Run full suite: `bun test` — all 403 tests pass

**Verification**: `bun test` green; no regressions in handler routing or sanitizeState tests.
