# Design: Play vs CPU (Practice Mode)

## Technical Approach

Frontend-only. Port `findBotMove()` from `packages/backend/src/game/bot.ts` to `packages/frontend/src/lib/game/bot.ts`. Implement `LocalGameEngine.processBotTurns()` with `setTimeout` delays. New `/cpu` route initializes a local match via shared `createDeck`→`shuffle`→`deal`→`initializeMatch`—no WS, no DB. Zustand store gets `initCpuMatch()` action. Existing components (`GameBoard`, `PlayerHand`, `ScorePanel`, `GameStatusOverlay`) render unchanged; overlay detects CPU mode for human-centric text.

## Architecture Decisions

### Bot AI location

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Frontend-only (~40 lines, duplicated) | Duplication vs zero backend coupling | **Chosen** — isolated, small, no server load |
| Shared package (`@domino/shared`) | Single source, but bot is game-strategy not game-rules | Rejected — bot logic is application-level |
| Backend bot + WS for CPU | Reuses existing code, but adds WS overhead for "local" game | Rejected — defeats purpose of practice mode |

### Match initialization

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `initCpuMatch()` in Zustand store | Self-contained, matches existing `initEngine()` pattern | **Chosen** |
| Separate `CpuMatchProvider` context | More isolated, but adds context layer for one feature | Rejected — over-engineered |
| Reuse `/match/[id]` with mode query param | Single route, but forces WS dependency into local path | Rejected — fragile |

### Bot turn execution model

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `setTimeout` per bot turn (1–2s delay) | Visual feedback, main thread yields between turns | **Chosen** |
| Synchronous loop with `requestAnimationFrame` | Smooth but blocks UI during all 3 bot turns | Rejected — jank during rapid succession |
| Web Worker | True parallelism, but overkill for ~40 line AI | Rejected |

### Timer behavior in CPU mode

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Disable timer entirely | Simple, no visual noise | **Chosen** |
| Shortened timer (10s) | Adds pressure, but confusing for practice | Rejected |
| Keep 45s timer | Realistic, but bots play instantly — timer is meaningless | Rejected |

## Data Flow

```
Lobby ──click "Play vs CPU"──→ /cpu
                                    │
                        initCpuMatch() in store
                        createDeck → shuffle → deal
                        initializeMatch(matchId, hands, pool)
                        initEngine(match) → LocalGameEngine
                                    │
                        ┌─── Is it human's turn? ───┐
                        │ YES: render hand, wait     │ NO: setTimeout 1–2s
                        │       for tile/side pick   │       findBotMove(hand, board)
                        └───────────────────────────┘       → playTile() or pass()
                                    │                        → update store
                                    │                        → recurse (next bot?)
                                    ▼
                        hand_ended → hand_scored → redealHand() → next hand
                        match_ended (scores ≥ 200) → overlay
                                    │
                        "Ganaste" / "Perdiste" + scores
                                    │
                        click "Volver al Lobby" → reset() → /lobby
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/frontend/src/lib/game/bot.ts` | Modify | Port `findBotMove()` from backend: prefer doubles, sort by pip count, return `{ tileId, side }` or `null` |
| `packages/frontend/src/lib/game/local-engine.ts` | Modify | Implement `processBotTurns()`: loop while `currentTurn !== 0 && status === "in_progress"`, call `findBotMove()`, execute via `playTile`/`passTurn`, return after first human turn or match end. Add async wrapper with `setTimeout` delays. |
| `packages/frontend/src/app/(game)/cpu/page.tsx` | Create | `"use client"` page. On mount: calls `initCpuMatch()`, triggers `processBotTurns()`. Renders `GameBoard`, `PlayerHand`, `ScorePanel`, `GameStatusOverlay`. Skips `useWebSocket`. |
| `packages/frontend/src/app/(dashboard)/lobby/_components/play-vs-cpu-button.tsx` | Create | Button linking to `/cpu`. Matches lobby card styling. |
| `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | Modify | Add `PlayVsCpuCard` component after `QuickMatchCard`. |
| `packages/frontend/src/stores/game-store.ts` | Modify | Add `initCpuMatch()` action: creates `MatchState` via shared functions, calls `initEngine()`. |
| `packages/frontend/src/components/game/game-status-overlay.tsx` | Modify | `buildMatchResultMessage()` accepts optional `isCpuMode` flag. When true: pair 0 win → "¡Ganaste!", pair 1 win → "Perdiste". |

## Interfaces / Contracts

```typescript
// bot.ts — same signature as backend
export function findBotMove(
  hand: Tile[],
  board: BoardState,
): { tileId: string; side: Side } | null;

// local-engine.ts — async bot processing
processBotTurns(onBotPlayed?: () => void): Promise<MatchState>;

// game-store.ts — new action
initCpuMatch: () => void;
// Internally: createDeck() → shuffle() → deal() → initializeMatch()
// then initEngine(match) + syncGameState()

// game-status-overlay.ts — human-centric result
buildMatchResultMessage(
  status: GameStatus,
  scores: [number, number],
  matchAbandonedBy?: string | null,
  players?: Array<{ id: string; name?: string; handSize: number; isConnected: boolean }>,
  isCpuMode?: boolean,  // NEW optional param
): { title: string; subtitle: string };
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `findBotMove()` — empty board, valid moves, no valid moves, doubles preference | Pure function tests with seeded decks |
| Unit | `processBotTurns()` — loops until human turn, handles match end | Mock `setTimeout` via `vi.useFakeTimers()` |
| Unit | `initCpuMatch()` — creates valid MatchState with 4 players | Store action test, verify state shape |
| Unit | `buildMatchResultMessage` with `isCpuMode=true` | "Ganaste"/"Perdiste" text assertions |
| Integration | Full CPU match flow — init → play → bot turns → match end | Component test with fake timers |
| Regression | Online multiplayer unaffected | Existing test suite passes unchanged |

## Migration / Rollout

No migration required. Feature is fully isolated — no DB, no shared state with online mode. No feature flag needed since it's a new route, not a modification to existing paths.

## Open Questions

- None blocking. Bot AI is intentionally simple (Level 1: prefer doubles + pip count). Difficulty levels are explicitly out of scope.
