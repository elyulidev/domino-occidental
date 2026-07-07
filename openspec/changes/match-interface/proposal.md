# Proposal: Match Interface

## Intent

Build the real-time domino game UI for the `match/[id]` route — the core gameplay experience. Currently no game interface exists; users see a lobby but can't play. This delivers a playable local-bot game with full board visualization, tile interaction, and scoring.

## Scope

### In Scope
- Route `(dashboard)/match/[id]/page.tsx` — client component
- Zustand game store: board, scores, players, own hand, turn, status
- Local engine adapter wrapping pure backend game functions + bot auto-play
- Visual board: rendered domino tiles in the line of play with orientation
- Player hand: tiles at bottom, click tile + choose side to play
- Opponent indicators: card backs + handSize + isConnected status
- Score panel: pair scores, round number, target (200)
- Turn indicator and 45s timer
- Full game flow: deal → play/pass → hand scored → next hand → match ends

### Out of Scope
- WS real-time multiplayer (Phase 2)
- Reconnection overlay (deferred)
- Game chat, animations, replay, match history

## Capabilities

### New Capabilities
- `game-interface`: real-time domino game UI — board rendering, tile interaction, score display, turn-based flow with local bot opponents

### Modified Capabilities
- None

## Approach

**Phase 1 (now):** Local bot engine using `@domino/shared` pure game functions imported client-side → Zustand store (engine-agnostic interface) → visual UI components. Bots play first valid tile or pass (simple strategy). Store structure pre-fields a personalized hand slot for WS migration.

**Phase 2 (future):** Replace `local-engine.ts` with WS adapter. Components and store stay identical.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/app/(dashboard)/match/[id]/page.tsx` | New | Client route page |
| `frontend/src/stores/game-store.ts` | New | Zustand store |
| `frontend/src/hooks/use-game-engine.ts` | New | Engine consumer hook |
| `frontend/src/lib/game/local-engine.ts` | New | Local engine adapter |
| `frontend/src/components/game/` | New | Board, hand, scores, turn indicator components |
| `frontend/package.json` | Modified | Add `zustand` dependency |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| React Compiler compat with game store | Med | Memoized selectors, no mutations outside actions |
| Bot AI too simple for playtesting | Low | Acceptable for Phase 1; iterative later |
| Store/engine interface wrong for WS swap | Med | Abstract behind `GameEngine` interface before building |

## Rollback Plan

Additive change — no existing code modified. Rollback: `git restore packages/frontend/package.json && rm -rf packages/frontend/src/app/(dashboard)/match packages/frontend/src/stores packages/frontend/src/hooks/use-game-engine.ts packages/frontend/src/lib/game packages/frontend/src/components/game`.

## Dependencies

- `@domino/shared` (workspace) — types and game logic
- `zustand` — state management

## Success Criteria

- [ ] Open `match/[id]` with valid matchId → sees board, tiles, scores
- [ ] Play a tile: click tile → choose side → tile appears on board
- [ ] Pass button when no valid moves
- [ ] Hand ends on empty hand or blocked board (scoring shown)
- [ ] Match ends at 200 points with final score display
- [ ] All 181 existing backend tests still pass
