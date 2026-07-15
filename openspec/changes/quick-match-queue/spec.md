# Delta for quick-match-queue

## matchmaking-queue (New Capability)

### Purpose

Matchmaking queue system that pairs players by ELO with sliding window expansion, supports pair-priority matching, and notifies players via dedicated WebSocket channels.

### Requirements

#### R1: Queue Join (POST /api/v1/matchmaking/quick)

The system SHALL allow authenticated users to join the matchmaking queue.

- **Auth**: JWT required.
- **Duplicate check**: Reject if user already in queue (HTTP 409).
- **Partner priority**: Query `pairs` table for registered partners (ordered by priority 1→2→3). If any partner is already in queue, form a pair and add to pair queue.
- **Solo queue**: If no partner found, add to individual queue.
- **Response**: `{ queuePosition, queueType: 'individual' | 'pair', estimatedWait }`.

**Scenarios**:

1. **Happy path (solo)**
   - GIVEN user not in queue
   - WHEN POST /quick with valid JWT
   - THEN user added to individual queue
   - AND response contains queuePosition, queueType='individual', estimatedWait

2. **Partner in queue**
   - GIVEN user A in queue, partner B joins
   - WHEN B's partner priority matches A
   - THEN both form a pair and move to pair queue
   - AND both receive queueType='pair'

3. **Already in queue**
   - GIVEN user already in queue
   - WHEN POST /quick again
   - THEN HTTP 409 with error 'already_in_queue'

#### R2: Queue Leave (POST /api/v1/matchmaking/leave)

The system SHALL allow authenticated users to leave the queue.

- **Auth**: JWT required.
- **Removal**: Remove user from whichever queue (individual or pair).
- **Pair dissolution**: If user was in pair queue, dissolve pair back to individual queue (partner remains in individual queue).
- **Response**: `{ success: true }`.

**Scenarios**:

1. **Leave solo queue**
   - GIVEN user in individual queue
   - WHEN POST /leave
   - THEN user removed from queue
   - AND response success=true

2. **Leave pair queue**
   - GIVEN user in pair queue with partner
   - WHEN POST /leave
   - THEN pair dissolved, partner moved to individual queue
   - AND both removed from pair queue

#### R3: Queue Status (GET /api/v1/matchmaking/status)

The system SHALL return current queue status for authenticated user.

- **Auth**: JWT required.
- **Response**: `{ inQueue, queueType, position, estimatedWait, queueCount }`.

**Scenarios**:

1. **User not in queue**
   - GIVEN user not in any queue
   - WHEN GET /status
   - THEN inQueue=false, queueCount reflects total players waiting

2. **User in queue**
   - GIVEN user in individual queue at position 3
   - WHEN GET /status
   - THEN inQueue=true, queueType='individual', position=3, estimatedWait calculated

#### R4: Matchmaker Loop

The system SHALL run a matchmaker loop every 2 seconds.

- **Step A (pair formation)**: Scan individual queue for players whose registered partner is also in queue; move matched pairs to pair queue.
- **Step B (match creation)**: For each pending pair/solo, find 2 other pairs/solos within sliding ELO window (±200→±400→±600 over 0→10→30s).
- **Match creation**: When 4 players (2 pairs or 4 solos) are matched, create match via game engine, remove from queue, notify via UserChannelManager.
- **Stale cleanup**: Remove entries older than 60s.

**Scenarios**:

1. **Four solos matched**
   - GIVEN 4 solos in queue with ELOs within ±200
   - WHEN matchmaker runs
   - THEN match created, all 4 removed from queue
   - AND match_found sent to each player

2. **Two pairs matched**
   - GIVEN 2 pairs in queue with pair ELOs within ±200
   - WHEN matchmaker runs
   - THEN match created with players from both pairs

3. **Sliding window expansion**
   - GIVEN 2 solos waiting 15s (range ±400)
   - WHEN matchmaker runs
   - THEN includes players within ±400

4. **Stale entries cleaned**
   - GIVEN user in queue for 61s
   - WHEN cleanup scheduler runs
   - THEN user removed from queue

#### R5: Match Notification (WS /ws/matchmaking/:userId)

The system SHALL provide a dedicated WebSocket channel per user for matchmaking events.

- **Auth**: JWT required (same as R5 in ws-connection).
- **Events**:
  - `queue_joined`: user entered queue
  - `queue_position_update`: position changed (when others join/leave)
  - `match_found`: includes `{ matchId, team: 'A' | 'B' }`
  - `queue_error`: error occurred

**Scenarios**:

1. **Queue join notification**
   - GIVEN user connects to WS
   - WHEN POST /quick succeeds
   - THEN queue_joined event sent

2. **Match found notification**
   - GIVEN user in queue
   - WHEN matchmaker creates match
   - THEN match_found event sent with matchId and team assignment

#### R6: Frontend useMatchmaking Hook

The system SHALL provide a React hook managing matchmaking lifecycle.

- **Actions**: `joinQueue()`, `leaveQueue()`
- **State**: `isInQueue`, `queuePosition`, `matchFound`
- **WS listener**: Listens for match_found, redirects to `/match/:id`
- **Cleanup**: Calls leaveQueue on unmount.

**Scenarios**:

1. **Join and listen**
   - GIVEN component mounts
   - WHEN joinQueue() called
   - THEN POST /quick, WS connected
   - AND on match_found, redirect to match page

2. **Leave on unmount**
   - GIVEN component unmounts while in queue
   - WHEN cleanup runs
   - THEN POST /leave called

#### R7: QuickMatchButton Update

The system SHALL replace dev endpoint with real matchmaking API.

- **Button click**: Calls joinQueue() from hook.
- **Queue status**: Shows position and estimated wait when in queue.
- **Cancel**: Shows cancel button that calls leaveQueue().

**Scenarios**:

1. **Button shows queue status**
   - GIVEN user in queue
   - WHEN lobby renders
   - THEN button shows "Position 3 · ~10s" and cancel icon

---

## ws-connection (Modified Capability)

### ADDED Requirements

#### R8: User Channel Manager Integration

The system SHALL integrate UserChannelManager for matchmaking notifications.

- **Register**: When user connects to `/ws/matchmaking/:userId`, call `userChannelManager.register(userId, ws)`.
- **Disconnect**: When WS closes, call `userChannelManager.disconnect(userId)`.
- **Push**: Matchmaking loop uses `pushToUser()` to send events.

**Scenarios**:

1. **Register on connect**
   - GIVEN user connects to matchmaking WS
   - WHEN JWT verified
   - THEN userChannelManager.register called with userId and ws

2. **Disconnect cleanup**
   - GIVEN user connected to matchmaking WS
   - WHEN WS closes
   - THEN userChannelManager.disconnect called

3. **Push event delivery**
   - GIVEN user registered in userChannelManager
   - WHEN match_found event pushed
   - THEN ws.send called with JSON payload

### MODIFIED Requirements

#### R5: JWT Authentication (Previously: JWT verification for match WS)

The system SHALL verify JWT tokens from WS query param `?token=xxx` using Supabase secret for both match and matchmaking routes.

(Previously: Only applied to match WS connections)

**Scenarios**:

1. **Valid token on matchmaking route**
   - GIVEN valid JWT in `?token=`
   - WHEN connecting to `/ws/matchmaking/:userId`
   - THEN connection accepted

2. **Invalid token on matchmaking route**
   - GIVEN invalid JWT
   - WHEN connecting to `/ws/matchmaking/:userId`
   - THEN connection rejected (closed immediately)