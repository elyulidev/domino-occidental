# Proposal: Module 10 — Event Broadcaster

## Intent

Thin routing layer between `handleMessage()`'s `GameEvent[]` output and WebSocket connections. Decides who gets what: `game_error` is private (sender only), all other events go to all 4 players, and every batch includes an optional `SanitizedMatchState` snapshot so clients stay in sync.

## Scope

### In Scope
- `broadcastEvents(events, matchId, actingPlayerId, sendFn, playerIds?)` — route events per privacy rules
- `sendState(playerId, state, sendFn)` — targeted state push (reconnection, initial join)
- `SendFn` type — `(playerId: string, event: WsServerMessage) => void`
- `WsServerMessage` type — `{ type: 'game_events', events: GameEvent[], state?: SanitizedMatchState }`
- Error routing: `game_error` → sender only; all other 10 event types → all 4 players
- State included in every batch (when present from handler)
- Optional `playerIds[]` parameter for future spectator extension (defaults to all 4)
- Files: `src/ws/broadcaster.ts`, `src/ws/__tests__/broadcaster.test.ts`
- Full unit test coverage (TDD required by project config)

### Out of Scope
- WebSocket server, connection tracking, or socket lifecycle
- Rate limiting or message throttling
- Reconnection or heartbeat logic
- JWT auth or token validation
- Initial `game_state` send on join (needs WS connection context — Module 11)
- Connection map or player presence tracking

## Capabilities

### New Capabilities
- `event-broadcaster`: Routes `GameEvent[]` arrays to correct recipients with privacy filtering, attaches optional `SanitizedMatchState`, and exposes targeted state push for reconnection and initial join

### Modified Capabilities
- None

## Approach

Two pure functions + two types in `src/ws/broadcaster.ts`. `broadcastEvents()` iterates events, routes per type (`game_error` → sender, rest → all), and calls `sendFn` per recipient. `sendState()` is a one-liner wrapping state in the standard envelope. `SendFn` decouples from any WS library — Module 11+ provides the socket-write closure.

## API Design

```typescript
type SendFn = (playerId: string, event: WsServerMessage) => void;

type WsServerMessage = {
  type: 'game_events';
  events: GameEvent[];
  state?: SanitizedMatchState;
};

function broadcastEvents(
  events: GameEvent[],
  matchId: string,
  actingPlayerId: string,
  sendFn: SendFn,
  playerIds?: string[],
): void;

function sendState(
  playerId: string,
  state: SanitizedMatchState,
  sendFn: SendFn,
): void;
```

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/ws/broadcaster.ts` | New | Core broadcaster module |
| `src/ws/__tests__/broadcaster.test.ts` | New | Unit tests |
| `src/game/types.ts` | Unchanged | Reuses `GameEvent` |
| `src/game/handler.ts` | Unchanged | Reuses `SanitizedMatchState` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wrong event type routing (missed privacy rule) | Low | Enum-based routing, tested per event type |
| SendFn misuse in higher layer | Low | Type contract enforces signature; tests use mock |

## Rollback Plan

Delete `src/ws/broadcaster.ts` and its test file. No schema, config, or engine changes. Module 11+ will be the sole caller — if back-revved, they must revert alongside.

## Dependencies

- `src/game/types.ts` — `GameEvent` type
- `src/game/handler.ts` — `SanitizedMatchState` type

## Success Criteria

- [ ] `game_error` sent to `actingPlayerId` only (private routing)
- [ ] All other 10 event types broadcast to all 4 players
- [ ] Empty events array produces zero `sendFn` calls
- [ ] Multiple events with mixed types route each correctly per privacy rule
- [ ] `sendState()` wraps state in standard `WsServerMessage` envelope
- [ ] Optional `playerIds[]` overrides default all-4 routing (spectator path)
- [ ] No WebSocket, timer, or auth logic leaks into broadcaster
- [ ] All tests pass with `bun test`
