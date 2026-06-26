# Design: Module 10 — Event Broadcaster

## Technical Approach

Two pure routing functions that dispatch `GameEvent[]` arrays from `handleMessage()` to the correct WebSocket recipients with privacy filtering. `broadcastEvents()` iterates events, determines recipients per type (`game_error` → sender only, all other 11 types → all players or `playerIds[]` override), and calls `sendFn` per recipient. `sendState()` wraps a `SanitizedMatchState` in the standard WS envelope for targeted push (reconnection, initial join). Zero WS, timer, or persistence logic.

## Architecture Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Routing | Map<type, route> vs discriminated check | `event.type === "game_error"` check | Only 2 routing rules (private vs broadcast). A map is over-engineering for a single discriminating condition. |
| `sendFn` signature | Sync vs async | Sync `(playerId, event) => void` | Higher layers wrap async WS write. Broadcaster treats it as sync — if they want async, they pass an async-compatible closure. |
| Error handling | Propagate vs catch+log | Catch + `console.error` | Per product decision #5: a throwing `sendFn` in one call must never crash the remaining recipients. |
| State attachment | Separate `sendStateOnly` vs unified | Same `WsServerMessage` envelope | Clients receive one message per batch with state snapshot. Matches handler return shape. |

## Data Flow

```
handleMessage() → { events: GameEvent[], sanitizedState?: SanitizedMatchState }
                            │
                            ▼
                 broadcastEvents(events, matchId, actingPlayerId, sendFn, playerIds?)
                            │
                     ┌──────┴──────┐
                     ▼              ▼
             event.type ===      all other 11 types
             "game_error"              │
                     │                  ▼
                     ▼          for each recipient in
             sendFn(             (playerIds ?? all4)
             actingPlayerId,         │
             { type:                 ▼
               'game_events',        sendFn(recipientId,
               events: [e],          { type: 'game_events',
               state? })              events: [e], state? })
                            │
                            ▼
                 sendState(playerId, state, sendFn)
                            │
                            ▼
                 sendFn(playerId,
                   { type: 'game_events',
                     events: [], state })
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/ws/broadcaster.ts` | Create | Core broadcaster: `SendFn`, `WsServerMessage`, `broadcastEvents()`, `sendState()` |
| `src/ws/__tests__/broadcaster.test.ts` | Create | Unit tests covering all routing rules, edge cases, and resilience |

## Interfaces / Contracts

```typescript
import type { GameEvent } from "../game/types";
import type { SanitizedMatchState } from "../game/handler";

type SendFn = (playerId: string, event: WsServerMessage) => void;

type WsServerMessage = {
  type: "game_events";
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

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | 11 public event types routed to all 4 players | For each type, create one event, call `broadcastEvents`, assert `sendFn` called 4 times |
| Unit | `game_error` private routing | `game_error` event → `sendFn` called once with `actingPlayerId` |
| Unit | Empty events no-op | Empty array → `sendFn` never called |
| Unit | Mixed event batch | `tile_played` + `game_error` → 5 total calls (4 + 1) |
| Unit | `playerIds` override | `playerIds = ["p1","p3"]` → `sendFn` called 2 times |
| Unit | `sendFn` error resilience | Mock `sendFn` throws for one player → remaining players still receive event |
| Unit | State included in envelope | Pass `state` → message has `{ type, events, state }` |
| Unit | State omitted when absent | No `state` → message has `{ type, events }` without state |
| Unit | `sendState` format | Single call → `{ type: 'game_events', events: [], state }` |

All tests use `vi.fn()` as mock `sendFn`. Test file at `src/ws/__tests__/broadcaster.test.ts`.

## Migration / Rollout

No migration required. New module with zero dependents. Module 11 (WS transport) wires `broadcastEvents` and `sendState` when ready.

## Open Questions

None. Spec and design fully cover all 12 event types, privacy rules, error resilience, and edge cases.
