# cf-workers-matchmaking-do Specification

## Purpose

Singleton Durable Object managing the matchmaking queue, ELO sliding-window matching via `alarm()`, and user-tagged WS connections for `match_found` push notifications. Replaces the in-memory queue + `setInterval` loop from Elysia/Bun.

## Requirements

### Requirement: Queue Operations

The system SHALL maintain a queue of `{ userId, elo, joinedAt, priority }` entries in `this.ctx.storage`. Operations: `enqueue`, `dequeue`, `findMatch` (ELO sliding window with ±200/±400/±600 expansion over 0–60s).

#### Scenario: Enqueue player

- GIVEN an authenticated user with `elo_individual: 1400`
- WHEN the `enqueue` handler processes their request
- THEN their entry is added to the queue array in storage
- AND a `queue_position_update` is pushed to their tagged WS connection

#### Scenario: Stale entries cleaned up

- GIVEN a queue entry with `joinedAt` older than 60s
- WHEN `alarm()` fires
- THEN the entry is removed and a `match_cancelled` event is pushed to their WS

#### Scenario: Already-queued user rejected

- GIVEN user "u1" is already in the queue
- WHEN "u1" attempts to enqueue again
- THEN the request returns HTTP 409 Conflict

### Requirement: alarm() Matching Loop

The system SHALL run a 2s matching cycle via `alarm()`. On each fire: (1) read queue from storage, (2) run `findMatch()` reusing pure functions from `matchmaking.ts`, (3) create GameDO if match found, (4) cleanup stale entries, (5) reschedule alarm to `now + 2000`.

#### Scenario: Two pairs matched

- GIVEN queue has 4 players forming 2 pairs within ELO range
- WHEN `alarm()` fires and `findMatch()` returns matches
- THEN a GameDO is created via `env.GAME_DO.get(matchId)`
- AND `match_found { matchId, team }` is pushed to each matched player's tagged WS
- AND matched entries are removed from queue

#### Scenario: Single player — no match

- GIVEN queue has 1 player
- WHEN `alarm()` fires
- THEN no GameDO is created
- AND alarm reschedules for `now + 2000`

#### Scenario: Pair entry matches as unit

- GIVEN user "u1" enqueued with a partner "u2" (pair ELO mode)
- WHEN matching runs
- THEN "u1" and "u2" are matched together as a pair unit, not individually

### Requirement: User-Tagged Connections

The system SHALL accept WS connections at `/ws/matchmaking/:userId` with JWT auth. Connections SHALL be tagged with `userId` via `acceptWebSocket(ws, [userId])`.

#### Scenario: match_found push to correct socket

- GIVEN user "u1" connected with tag "u1"
- WHEN the matching loop pairs "u1" into a match
- THEN the DO iterates `getWebSockets()`, finds tag "u1", sends `{ type: "match_found", matchId }` on that socket

#### Scenario: Disconnect auto-dequeues

- GIVEN user "u1" in queue and connected
- WHEN "u1"'s WS closes
- THEN on next `alarm()` cycle, "u1" is found in queue but not in `getWebSockets()`
- AND "u1" is removed from queue

### Requirement: Queue Count Broadcast

The system SHALL broadcast `queue_position_update { position, queueCount }` to ALL connected users whenever the queue changes (enqueue, dequeue, cleanup).

#### Scenario: Position updates on enqueue

- GIVEN 2 players in queue
- WHEN a 3rd player enqueues
- THEN all 3 receive `queue_position_update` with their respective positions

### Requirement: State Schema

| Field | Type | Description |
|-------|------|-------------|
| `queue` | `QueueEntry[]` | `{ userId, elo, joinedAt, priority }` |
| `alarmScheduled` | `boolean` | Whether an alarm is currently pending |

#### Scenario: Queue persists across hibernation

- GIVEN 3 players in queue
- WHEN DO hibernates between alarm cycles
- WHEN alarm fires
- THEN queue is read from storage — all entries intact
