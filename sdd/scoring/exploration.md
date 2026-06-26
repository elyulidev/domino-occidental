## Exploration: scoring

### Current State

Four modules exist: `deck.ts`, `board.ts`, `player.ts`, `turn.ts`. All follow the same pattern:
- Pure functions, immutable state (return new objects, never mutate)
- Types defined in `types.ts` (shared across all modules)
- Tests in `__tests__/*.test.ts` using `bun:test`
- No scoring logic exists yet — no `ScoreState`, no hand/match scoring functions

`player.ts` already provides `sumHand(hand)` which sums tile values — a building block for scoring.

The `TurnState` tracks `consecutiveNullRounds` and `lastHandWinner`, which scoring depends on but doesn't own. Scoring needs its own state.

### Affected Areas

- `src/game/types.ts` — needs new types: `ScoreState`, `HandResult`, `MatchResult`
- `src/game/scoring.ts` — **new file**, all scoring logic
- `src/game/__tests__/scoring.test.ts` — **new file**, tests
- `src/game/turn.ts` — no changes, but scoring consumes its output (`consecutiveNullRounds`, `lastHandWinner`)

### Types Proposal

```typescript
// Pair index: 0 = P1+P3, 1 = P2+P4
export type PairIndex = 0 | 1;

// Result of scoring a single hand
export interface HandResult {
  /** Points awarded to the winning pair */
  points: number;
  /** Which pair won (0 or 1), or null if hand was annulled */
  winningPair: PairIndex | null;
  /** Whether this was a blocked hand (all 4 players passed consecutively) */
  wasBlocked: boolean;
  /** Whether the hand was annulled (tie in blocked hand, or 4th consecutive null) */
  wasAnnulled: boolean;
  /** Individual sums at end of hand [p1, p2, p3, p4] */
  individualSums: [number, number, number, number];
}

// Persistent scoring state for a match
export interface ScoreState {
  /** Running totals per pair [pair0, pair1] */
  pairScores: [number, number];
  /** Individual ELO-relevant scores [p1, p2, p3, p4] (for potential future use) */
  individualScores: [number, number, number, number];
  /** Number of consecutive annulled hands */
  consecutiveAnnulled: number;
  /** History of hand results (for replay/audit) */
  handHistory: HandResult[];
}

// Final match outcome
export interface MatchResult {
  /** Winning pair index, or null if match not finished */
  winnerPair: PairIndex | null;
  /** Whether match ended by reaching target, tiebreaker, or both-over-200 */
  endedBy: "target" | "tiebreaker" | "both_over_200" | null;
  /** Final pair scores */
  finalScores: [number, number];
}
```

### Function API Proposal

**`src/game/scoring.ts`** — all pure functions:

```typescript
// --- Constants ---
export const MATCH_TARGET = 200;
export const MAX_CONSECUTIVE_ANNULLED = 3;

// --- Pair mapping ---
/** Maps player index (0-3) to pair index (0 or 1).
 *  P1(0)+P3(2) → pair 0, P2(1)+P4(3) → pair 1 */
export function getPairIndex(playerIndex: number): PairIndex;

// --- Hand scoring ---
/** Sums tiles in a single hand (delegates to player.sumHand) */
export function sumHand(hand: Tile[]): number;

/** Scores a completed hand given the 4 player hands.
 *  Returns HandResult with points, winning pair, and annulment status. */
export function scoreHand(
  hands: [Tile[], Tile[], Tile[], Tile[]],
  consecutiveAnnulled: number,
): HandResult;

// --- Match scoring ---
/** Creates initial ScoreState */
export function createScoreState(): ScoreState;

/** Applies a HandResult to the score state, returns new state */
export function applyHandResult(state: ScoreState, result: HandResult): ScoreState;

/** Checks whether the match should end */
export function checkMatchEnd(state: ScoreState): MatchResult;

/** Full hand+match pipeline: score hand, apply to state, check end */
export function scoreHandAndCheckMatch(
  hands: [Tile[], Tile[], Tile[], Tile[]],
  state: ScoreState,
): { scoreState: ScoreState; matchResult: MatchResult };
```

### Algorithm Details

**`scoreHand` logic:**

1. Compute `individualSums` using `sumHand` for each of the 4 hands
2. Compute `pairSums`:
   - `pair0 = individualSums[0] + individualSums[2]` (P1+P3)
   - `pair1 = individualSums[1] + individualSums[3]` (P2+P4)
3. **Determine if hand is blocked:** All 4 hands have 0 tiles → "empty table" (impossible in normal play since tiles are on the board). Actually, blocked means all 4 players passed. But scoring happens AFTER the hand ends, so we check: did someone play all tiles (winner), or was it blocked?
   - **Correction:** A hand ends when one player empties their hand (winner), OR when 4 consecutive passes happen (blocked, `consecutivePasses === 4` across all players — but this info lives in turn state, not hand state).
   - **Simpler approach for scoring:** We receive the final hands. If exactly one hand is empty → normal win, score = sum of the other 3. If no hand is empty and hand is "blocked" → we need a `isBlocked` flag passed in.
   - **Decision:** `scoreHand` receives an additional parameter `isBlocked: boolean` indicating whether the hand ended by blocking (4 consecutive passes) rather than a player emptying their hand.

4. **If NOT blocked (normal win):**
   - Winner = player with empty hand
   - Winning pair = `getPairIndex(winnerIndex)`
   - Points = `sumHand(losers' hands)` = total of all non-empty hands
   - Return `HandResult`

5. **If blocked:**
   - Compute pair sums from remaining tiles
   - Pair with **lower** sum wins
   - **Exact tie** (both pair sums equal) → annul hand
   - If `consecutiveAnnulled >= MAX_CONSECUTIVE_ANNULLED` (3) → force: player with lowest individual sum wins (tie-break by lower index)
   - Return `HandResult` with `wasAnnulled` accordingly

**`checkMatchEnd` logic:**

```
if both pairs > MATCH_TARGET simultaneously:
  higher score wins → MatchResult { endedBy: "both_over_200" }
  if exact tie → not finished, play tiebreaker hands
if any pair >= MATCH_TARGET:
  → MatchResult { endedBy: "target" }
otherwise:
  → MatchResult { winnerPair: null, endedBy: null }
```

**Edge case: "both over 200 simultaneously"**
After applying a hand result, check if BOTH `pairScores[0] > 200` AND `pairScores[1] > 200`. If so, higher wins. If tied → match continues with tiebreaker hands (no target, just play until one pair leads).

**Edge case: match ends mid-hand scoring**
If pair A has 190 and scores 15 this hand → 205. Pair B has 185 and scores 20 → 205. Both exceeded 200 simultaneously → tie → tiebreaker.

### Edge Cases

| Case | Behavior |
|------|----------|
| Normal win (one player empties hand) | Points = sum of 3 losers' tiles |
| Blocked hand, pair sums differ | Lower-sum pair wins, gets points = sum of higher pair's tiles |
| Blocked hand, exact pair-sum tie | Hand annulled, `consecutiveAnnulled++`, no points awarded |
| 3 consecutive annulled hands | 4th hand uses "lowest individual sum" tiebreak instead of annulling |
| Both pairs > 200 after same hand | Higher score wins; if tied → tiebreaker hands continue |
| One pair hits 200 exactly | Match ends, that pair wins |
| Pair scores are 198 vs 201 | Match ends (201 >= 200), pair with 201 wins |
| Empty hand + blocked (impossible) | Guard: if hand is blocked, no player should have 0 tiles |
| 0 tiles across all players | Shouldn't happen — 55 tiles total, max 40 on board after deal. If it somehow does, treat as annulled |

### Pattern Alignment

| Pattern | Existing modules | Scoring follows? |
|---------|-----------------|-----------------|
| Pure functions, no mutation | board.ts, player.ts, turn.ts | ✅ Yes |
| Types in types.ts | All modules import from types.ts | ✅ New types go in types.ts |
| Factory function | `createBoard()`, `createPlayer()`, `createTurnState()` | ✅ `createScoreState()` |
| Stateless scoring functions | N/A | ✅ `scoreHand`, `checkMatchEnd` are stateless |
| Constants as named exports | `TURN_TIMEOUT_MS`, `PLAYER_COUNT` | ✅ `MATCH_TARGET`, `MAX_CONSECUTIVE_ANNULLED` |
| JSDoc on every function | All modules | ✅ Will follow |
| Test helpers at top | `tile()` helper in board.test.ts, turn.test.ts | ✅ Same pattern |
| Immutability test | turn.test.ts has `immutability` describe block | ✅ Will include |

### File Boundaries

- **New file: `src/game/scoring.ts`** — all scoring logic (hand scoring, match scoring, pair mapping)
- **Modified file: `src/game/types.ts`** — add `ScoreState`, `HandResult`, `MatchResult`, `PairIndex` types
- **New file: `src/game/__tests__/scoring.test.ts`** — comprehensive tests

Scoring does NOT belong in `turn.ts` (that's turn lifecycle), `board.ts` (that's placement validation), or `player.ts` (that's hand manipulation). It's a separate concern that consumes output from all of them.

### Recommendation

Create `scoring.ts` as a standalone module with the API above. The `scoreHand` function is the core — it encapsulates all hand-level scoring rules (normal win, blocked hand, annulment). `checkMatchEnd` handles the 200-target logic. `applyHandResult` is a simple state accumulator.

The `isBlocked` parameter for `scoreHand` is necessary because the scoring module can't determine from hands alone whether a hand ended by blocking or by a player emptying their hand — that context comes from the game engine (which observes 4 consecutive passes).

### Risks

- **Blocked hand detection ambiguity:** The scoring function needs to know if a hand was blocked. Passing `isBlocked` as a boolean is clean but couples the caller to correctly detect blocking. The game engine must pass this flag accurately.
- **Both-over-200 timing:** Must check AFTER applying the hand's points, not before. The order of scoring within a hand matters — both pairs can cross 200 in the same hand.
- **Tiebreaker hands:** After both-over-200 tie, the match continues with no target. `checkMatchEnd` needs a `isTiebreakerActive` flag or similar to know when to stop looking at the 200 target.

### Ready for Proposal

Yes. The domain rules are well-defined, the patterns are clear, and the API surface is minimal and focused. Ready to proceed to proposal phase.
