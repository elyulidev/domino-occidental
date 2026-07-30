# CF Workers Testing Specification

## Purpose

Testing strategy for the CF Workers migration: unit tests for DO logic, integration tests via miniflare for game flows, and test infrastructure configuration.

## Requirements

### Requirement: Unit Tests — alarm() Dispatch

The system SHALL have unit tests verifying correct dispatch of the single-alarm state machine based on stored deadlines.

#### Scenario: Processes multiple due timers in one fire

- GIVEN `heartbeatDue = 1000`, `turnCheckDue = 1000`, `abandonmentDue = null`
- WHEN `alarm()` fires at `Date.now() = 1500`
- THEN heartbeat check runs AND turn timeout check runs in the same pass

#### Scenario: Skips future timers

- GIVEN `heartbeatDue = 5000`, `turnCheckDue = 1000`
- WHEN `alarm()` fires at `Date.now() = 2000`
- THEN only turn check executes; heartbeat is skipped

#### Scenario: Reschedules to next deadline

- GIVEN `heartbeatDue = 3000`, `turnCheckDue = 5000`
- WHEN `alarm()` fires at `Date.now() = 4000`
- THEN heartbeat runs, then alarm reschedules to `turnCheckDue = 5000`

### Requirement: Unit Tests — State Transitions

The system SHALL test match lifecycle: `waiting` -> `in_progress` (4 players), `in_progress` -> `finished` (target score), `in_progress` -> `abandoned` (60s disconnect).

#### Scenario: Double-start prevention

- GIVEN `started = true` in storage
- WHEN a 4th player connects and `getWebSockets().length >= 4`
- THEN `started` remains `true`, no duplicate `round_started` emitted

#### Scenario: Abandonment on 60s disconnect

- GIVEN `abandonmentDue = Date.now() - 1000`
- WHEN `alarm()` fires
- THEN `match_abandoned` event is generated
- AND `storage.deleteAlarm()` is called

### Requirement: Unit Tests — JWT Auth

The system SHALL test `jose.jwtVerify` integration: valid token, expired token, wrong secret, missing token.

#### Scenario: Token extraction from URL search params

- GIVEN URL `?token=eyJ...&extra=1`
- WHEN `new URL(request.url).searchParams.get("token")` is called
- THEN `eyJ...` is returned (extra params ignored)

### Requirement: Integration Tests — Full Game Flow

The system SHALL have miniflare-based tests using `unstable_dev` API covering: 4 players connect -> match starts -> play tiles -> hand ends -> score.

#### Scenario: 4-player game via miniflare

- GIVEN a miniflare instance with `GameDO` binding
- WHEN 4 WS clients connect with valid JWTs
- THEN all 4 receive `game_events` with `round_started`
- AND player on turn can send `play_tile` successfully

### Requirement: Integration Tests — Disconnect/Reconnect

The system SHALL test: player disconnects -> abandonment timer starts -> player reconnects -> timer cancelled -> game continues.

#### Scenario: Reconnect within window saves match

- GIVEN 4 players connected, P2 disconnects
- WHEN P2 reconnects before 60s
- THEN `player_reconnected` broadcast, match continues

### Requirement: Integration Tests — Matchmaking

The system SHALL test: 4 players enqueue -> alarm fires -> `findMatch` succeeds -> GameDO created -> `match_found` pushed.

#### Scenario: Queue to match creation

- GIVEN 4 players enqueued in MatchmakingDO
- WHEN the alarm matching loop fires
- THEN a GameDO ID is created
- AND each matched player receives `match_found { matchId }`

### Requirement: Test Infrastructure

The system SHALL use `vitest` with `@cloudflare/vitest-pool-workers` for DO tests. Unit tests: `*.unit.test.ts`. Integration tests: `*.integration.test.ts`. Test files co-located with source in `packages/workers/src/`.

#### Scenario: Run all worker tests

- GIVEN `packages/workers` configured with vitest pool
- WHEN `bun test` is executed from `packages/workers`
- THEN unit tests pass (no miniflare needed)
- AND integration tests pass (miniflare starts DOs in-memory)

#### Scenario: Coverage threshold

- GIVEN `vitest.config.ts` with coverage enabled
- WHEN tests complete
- THEN coverage for `packages/workers/src/` is reported
- AND threshold is >= 80% line coverage
