# Design: Module 9 — Message Handler

## Technical Approach

A thin adapter between the WS transport layer and pure engine functions (playTile, passTurn, forfeitMatch). The handler receives typed client messages, routes them to the appropriate engine function via a testable GameStore interface, persists state changes, and returns sanitized state + events for broadcast. Zero WS, timer, or IO logic lives here.

## Architecture Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Store coupling | Direct import vs interface | GameStore interface | Enables mock-based unit tests without Map side-effects. The production binding wires the real store at the WS layer. |
| State sanitization location | In handler vs separate module | In handler.ts as sanitizeState() | Single responsibility — only the handler needs it. If another module needs sanitization later, extract it. |
| hand vs handSize | Full array vs count | handSize | Security: pool content + opponent hands must never reach the client. Count is sufficient for UI rendering. |
| Error routing | Thrown exceptions vs event channel | Engine errors via game_event events | Matches the existing engine convention — errors are never thrown. Structural errors (unknown type, no match) generate synthetic game_error events before the engine call. |
| flattening turn/scores | Nested vs flat | Flattened in SanitizedMatchState | Clients already read `state.currentTurn`, `state.roundNumber` — no need for `.turn.currentTurn` indirection. |

## Data Flow

```
WS client message
       │
       ▼
handleMessage(store, matchId, playerId, message)
       │
       ├── store.getGame(matchId)  ── null ──► MATCH_NOT_FOUND error
       │
       ├── message.type unknown  ───────────► INVALID_MESSAGE error
       │
       ├── "play_tile" ──► playTile(match, playerId, tileId, side) ──► ActionResult
       ├── "pass"      ──► passTurn(match, playerId)                ──► ActionResult
       └── "leave"     ──► forfeitMatch(match, playerId, new Date())─► ActionResult
                              │
                              ▼
                    store.updateGame(matchId, result.match)
                              │
                              ▼
                    sanitizeState(result.match)
                              │
                              ▼
                    { events: result.events, sanitizedState }
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/handler.ts` | Create | Core handleMessage(), GameStore interface, SanitizedMatchState, WsClientMessage types, sanitizeState() |
| `src/game/__tests__/handler.test.ts` | Create | Unit tests covering all message types, error paths, and sanitization |
| `src/game/types.ts` | No change | Reuses existing GameEvent, MatchState, ActionResult, Side, BoardState, PlayerState |

## Interfaces / Contracts

```typescript
interface GameStore {
  getGame(matchId: string): MatchState | null;
  updateGame(matchId: string, state: MatchState): void;
}

type WsClientMessage =
  | { type: "play_tile"; tileId: string; side: "left" | "right" }
  | { type: "pass" }
  | { type: "leave" };

interface MessageResult {
  events: GameEvent[];
  sanitizedState?: SanitizedMatchState;
}

interface SanitizedMatchState {
  matchId: string;
  players: Array<{
    id: string;
    handSize: number;
    isConnected: boolean;
  }>;
  board: BoardState;
  currentTurn: number;
  scores: [number, number];
  roundNumber: number;
  poolCount: number;
  status: string;
  targetScore: number;
}
```

## Sanitization Rules

| Source | Target | Notes |
|--------|--------|-------|
| `match.pool` | removed | Never expose pool tiles |
| `player.hand` | `handSize = hand.length` | Count only, security |
| `player.isConnected` | preserved | Clients need connection status |
| `player.consecutivePasses` | removed | Internal counter |
| `player.lastActionAt` | removed | Timestamp, no client value |
| `turn.currentTurn` | flattened to `currentTurn` | Top-level for ergonomics |
| `turn.roundNumber` | flattened to `roundNumber` | Top-level for ergonomics |
| `turn.*` (remaining) | removed | Internal: deadline, nullRounds, lastHandWinner |
| `scores.scores` | flattened to `scores` | `[number, number]` |
| `scores.isTiebreaker` | removed | Internal |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | play_tile routes to playTile | Mock GameStore returning in-progress match; verify updateGame called with engine result |
| Unit | pass routes to passTurn | Same pattern — verify engine function effects |
| Unit | leave routes to forfeitMatch | Verify forfeitMatch is called with new Date() |
| Unit | Unknown matchId → MATCH_NOT_FOUND | Mock getGame returns null; verify no engine call, no updateGame |
| Unit | Unknown message type → INVALID_MESSAGE | Send `{ type: "bogus" }`; verify no engine call, game_error in events |
| Unit | Engine game_error passed through | Out-of-turn playTile; verify NOT_YOUR_TURN event surfaces as-is |
| Unit | match_ended → status: finished | Engine emits match_ended; sanitizedState.status is "finished" |
| Unit | Sanitization correctness | MatchState with known values → verify pool stripped, handSize matches, all internal fields removed |

Pattern: use makeMatch() (from store.test.ts pattern) for test fixtures, GameStore mock via `{ getGame: vi.fn(), updateGame: vi.fn() }`.

## Migration / Rollout

No migration required. This is a new module — no existing code depends on it yet. The WS layer integration will wire handleMessage when ready.

## Open Questions

None. Spec and design are complete. The only unknown (how the WS layer calls handleMessage) is out of scope of this module.
