# Design: Scoring Module

## Technical Approach

Pure-function module (following `deck.ts`/`turn.ts` patterns) for hand scoring, blocked-hand resolution, match-end detection, and null-round tracking. The engine calls these functions — they have no side effects, no classes, no mutable state. All types live in `types.ts`; all logic in `scoring.ts`.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| `calculateTotal` vs reuse `sumHand` | Standalone `calculateTotal` | Re-export `sumHand` from player.ts | Independence — scoring module has no dependency on player.ts. Same logic, decoupled concerns. |
| Annulled cascade | `scoreHand` checks `consecutiveAnnulled` param | Engine handles the 4th-rule override | Pure function owns all scoring rules. Engine only tracks the counter; scoring decides when to force a winner. |
| Match-end timing | Called after `applyHandResult`, not before | `checkMatchEnd` reads accumulated scores | Natural flow: play hand → apply → check if match is over. Avoids stale-state bugs. |
| TARGET_SCORE | Module-level constant (200) | Config param or env var | Fixed game rule per AGENTS.md §5. Constant is simplest, no config overhead. Inline if ever configurable. |
| Blocked-hand detection | Engine sets `isBlocked` flag | scoring.ts detects dead board | Board-state knowledge belongs to engine. Scoring only resolves the result. Clear separation. |
| `getLosingPlayers` as helper | Separate exported function | Inline in `scoreHand` | Needed by both `scoreHand` (normal win sum) and potentially by engine for logging. Exported utility. |

## Data Flow

```
Engine detects hand end (empty hand or blocked board)
       │
       ▼
  scoreHand(hands, isBlocked, consecutiveAnnulled)
       │
       ├─ Normal win → sum(3 losing players' tiles)
       ├─ Blocked → compare pair totals, lower wins
       ├─ Tie → annulled, increment consecutiveAnnulled
       └─ 4th+ annulled → lowest global sum wins (override)
       │
       ▼
  HandResult { winningPair, points, isBlocked, isAnnulled }
       │
       ▼
  applyHandResult(ScoreState, HandResult)
       │
       ▼
  ScoreState { scores: [updated, ...], isTiebreaker }
       │
       ▼
  checkMatchEnd(ScoreState)
       │
       ├─ scores[p] >= 200 → { isOver: true, winner, reason }
       ├─ both >= 200 → higher wins (tie → tiebreaker)
       └─ both < 200 → { isOver: false }
```

## Types (added to types.ts)

```typescript
export type PairIndex = 0 | 1;

export interface ScoreState {
  scores: [number, number]; // [pair0, pair1]
  isTiebreaker: boolean;
}

export interface HandResult {
  winningPair: PairIndex;
  points: number;
  isBlocked: boolean;
  isAnnulled: boolean;
}

export interface MatchResult {
  isOver: boolean;
  winner: PairIndex | null;
  reason: string; // "reached_target" | "both_over_200" | "tiebreaker"
}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/types.ts` | Modify | Add `PairIndex`, `ScoreState`, `HandResult`, `MatchResult` |
| `src/game/scoring.ts` | Create | 7 pure functions (~120 LOC) |
| `src/game/__tests__/scoring.test.ts` | Create | ~20 unit tests covering all edge cases |

## Key Behaviors

- **`scoreHand`**: Normal win → sum tiles of 3 losing players via `getLosingPlayers`. Blocked → compute per-pair totals, lower sum wins. Tie → annulled unless `consecutiveAnnulled >= 3` (4th+ override).
- **`checkMatchEnd`**: Both ≥ 200 → higher wins; exact tie → `isTiebreaker: true`, match continues. Single ≥ 200 → immediate win. Tiebreaker hands: `isTiebreaker` stays true until one pair leads after a hand.
- **Immutability**: All functions return new objects/arrays. `applyHandResult` returns a new `ScoreState` — original untouched.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `getPairIndex` | 4 cases — each player index maps correctly |
| Unit | `calculateTotal` | Normal hand, empty hand, single tile |
| Unit | `scoreHand` — normal win | P1 empties → pair 0 wins, sum of P2+P3+P4 |
| Unit | `scoreHand` — blocked | Lower pair wins; tie → annulled; 4th override |
| Unit | `applyHandResult` | Points accumulate; immutability check |
| Unit | `checkMatchEnd` | Under 200, one at 200+, both over 200, tiebreaker |
| Edge | Annulled cascade | 3rd annulled → still annulled; 4th → forced winner |

## Migration / Rollout

No migration required. Scoring is a new leaf module with no consumers yet. The engine will integrate it in a later phase.

## Open Questions

None. Design is self-contained and matches spec + AGENTS.md §5 rules.
