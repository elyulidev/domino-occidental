# Design: Turn Manager

## Technical Approach

Pure-function module (10 functions) for turn ordering, timeout enforcement, first-player selection, and null-round tracking. Follows the immutable pattern from `deck.ts` — every mutation returns a new `TurnState` via spread, no classes, no side effects. Types in `types.ts`, functions in `turn.ts`, tests in `__tests__/turn.test.ts`.

## Architecture Decisions

### Decision: turnDeadline as number (Unix ms) not Date

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `Date \| null` | Object comparison, needs `.getTime()`, harder to mock | ❌ |
| `number \| null` | Direct `<`/`>=` comparison, `Date.now()` injection | ✅ |

**Rationale**: The spec originally defined `Date | null` but `number` avoids Date-object pitfalls. Engine only compares timestamps; raw numbers are simpler and more testable. **Spec corrected to match.**

### Decision: Result object for timeout (not throw)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Throw on timeout | Exception for expected game flow, awkward catch | ❌ |
| Return `{ timedOut, playerIndex }` | Explicit result, engine checks boolean | ✅ |

### Decision: Injected `now` for deadline functions

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `Date.now()` internally | Untestable without mocking globals | ❌ |
| Optional `now` param | Pure function, injectable for tests | ✅ |

### Decision: Null-deadline guard in checkTurnTimeout (CRITICAL)

**Guard**: `checkTurnTimeout` MUST return `{ timedOut: false, playerIndex: state.currentTurn }` when `turnDeadline === null`. Without this guard, `now >= null` evaluates as `now >= 0` — always `true` — causing a false timeout on the very first check before any deadline is set.

### Decision: setCurrentTurn throws on invalid index

**Rationale**: Consistent with `deal()` in `deck.ts`. Indices < 0 or > 3 are programmer errors, not runtime game events.

### Decision: getFirstPlayer tie-breaking

**Rationale**: When two players have equal sum and no doubles, the lower-indexed player wins by default. Engine can override with custom tie-breaking if needed later.

### Decision: isNewRound narrow scope

**Rationale**: Returns true only when `roundNumber === 0`, `turnDeadline === null`, and `currentTurn === 0` (initial fresh state). After any turn advancement, `currentTurn` is no longer 0, so `isNewRound` returns false. Engine provides explicit reset mechanism between subsequent rounds.

### Decision: Constants as named exports

| Constant | Value | Purpose |
|----------|-------|---------|
| `TURN_TIMEOUT_MS` | `45_000` | Timeout window in ms |
| `PLAYER_COUNT` | `4` | Number of players |

## Data Flow

```
createTurnState()
    ↓
TurnState { currentTurn: 0, turnDeadline: null, ... }
    ↓
calculateDeadline(state, now?)    ← sets deadline = now + 45s
    ↓
[engine polls on 2s interval]
    ↓
checkTurnTimeout(state, now)      → { timedOut: true/false, playerIndex }
    ↓ (if timedOut)
advanceTurn(state)                → (current + 1) % 4

Round start flow:
  getFirstPlayer(hands, lastHandWinner?)
    → setCurrentTurn(playerIndex)
      → calculateDeadline()
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/types.ts` | Modify | Add `TurnState`, `TimeoutResult` |
| `src/game/turn.ts` | Create | 10 pure functions |
| `src/game/__tests__/turn.test.ts` | Create | ~22–25 unit tests |

## Interfaces / Contracts

```typescript
// added to types.ts
export interface TurnState {
  currentTurn: 0 | 1 | 2 | 3;
  turnDeadline: number | null;          // Unix ms timestamp
  consecutiveNullRounds: number;
  roundNumber: number;
  lastHandWinner: 0 | 1 | 2 | 3 | null;
}

export interface TimeoutResult {
  timedOut: boolean;
  playerIndex: 0 | 1 | 2 | 3;
}

// exported from turn.ts
export const TURN_TIMEOUT_MS = 45_000;
export const PLAYER_COUNT = 4;
```

## Testing Strategy

| Test | Focus | Cases |
|------|-------|-------|
| createTurnState | Defaults | currentTurn=0, deadline=null, nullRounds=0, round=0, winner=null |
| advanceTurn | Cycling | 0→1, 1→2, 2→3, 3→0; immutability check |
| setCurrentTurn | Validation | Valid (0..3); invalid (<0, >3) throws |
| getNextPlayer | Preview | Correct index; state not mutated |
| calculateDeadline | Deadline | Injected now → deadline = now + 45_000; overwrite idempotency |
| **checkTurnTimeout** | **Null guard** | **turnDeadline=null → timedOut=false** |
| checkTurnTimeout | Timing | Before → false; after → true |
| getFirstPlayer | Selection | Highest double; sum fallback; **sum tie → lowest index wins**; **empty hands**; lastHandWinner shortcut |
| incrementNullRounds / resetNullRounds | Counter | +1 then reset to 0 |
| isNewRound | Detection | Fresh → true; after advance → false; immutability |

~22–25 tests total. All pure-function tests with no mocks.

## Migration / Rollout

No migration required. New module with no existing consumers.

## Open Questions

- None
