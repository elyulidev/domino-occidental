# Game Interface Specification

## Purpose

Real-time domino game UI for the `match/[id]` route — board rendering, tile interaction, turn-based flow, scoring, and local bot opponents. This is a client-only experience; multiplayer WS replaces the local engine in Phase 2.

## Requirements

| Req | Statement | Key Edge Cases |
|-----|-----------|----------------|
| R1 | Route `(dashboard)/match/[id]` MUST render a `"use client"` component that initializes a local game engine from URL `matchId` params | Invalid matchId, non-numeric id |
| R2 | System MUST identify the human player as `playerIndex: 0` and bots as players 1–3 | — |
| R3 | Board MUST render the domino line-of-play showing each tile's top/bottom, orientation, and player color | Empty board placeholder; single tile |
| R4 | Player hand MUST display 10 tiles at bottom; playable tiles MUST be clickable, unplayable ones SHOULD be dimmed | No playable tiles → only Pass shown |
| R5 | Player MUST click a tile then choose left/right side to place it | Tile only fits one side → auto-place |
| R6 | System MUST show a Pass button when the player has zero playable tiles | — |
| R7 | System MUST validate every play via `canPlay(tile, leftEnd, rightEnd)` before applying | Invalid play silently rejected |
| R8 | Turn indicator MUST highlight the current player (p0–p3) with a 45s countdown on human turn | Bot turns resolve in 1–2s silently |
| R9 | Bot MUST auto-play the first valid tile (or pass) 1–2s after their turn starts | No valid tile → pass; no state leak |
| R10 | Game MUST follow double-9 rules: 55 tiles, 4 players (p0+p2 vs p1+p3), pairs scoring to 200 | See flow table below |
| R11 | Score panel MUST show both pair scores, round number, target (200), and last hand points | Round 1 shows zeros; mid-match updates |
| R12 | Match end MUST display winner, final scores, and a "Return to Lobby" navigation | Tiebreaker at 200+; abandoned state |

### R10 — Game Flow Detail

| Phase | Trigger | Action |
|-------|---------|--------|
| Deal | Match load | Shuffle 55, deal 10 each + 15 pool |
| Open | First turn | Highest double (or highest sum if no double) starts |
| Play | Turn active | Play tile or pass (forced at 45s timeout) |
| Hand end | Empty hand OR all pass consecutively | Compute points from non-winners' remaining tiles |
| Blocked tie | All pass + tied sums | Hand annulled (null round) |
| 4th null round | 3 consecutive annulled hands | Forced winner by lowest global sum |
| Match end | Pair reaches ≥200 | Check if opponent also ≥200 → higher wins; tie → extra hands |

### Edge Case Scenarios

#### Scenario: All tiles played (empty hand win)

- GIVEN a player has 1 tile remaining and plays it
- WHEN the board updates
- THEN the hand ends immediately
- AND points equal the sum of the other 3 players' remaining tiles

#### Scenario: Blocked board (all pass, no empty hand)

- GIVEN all 4 players pass consecutively
- WHEN the 4th pass is recorded
- THEN the hand ends with blocked state
- AND the pair with the lower total sum of remaining tiles wins
- AND if sums are tied, the hand is annulled

#### Scenario: Consecutive null rounds reach 4

- GIVEN 3 consecutive annulled hands
- WHEN the 4th hand also results in a blocked tie
- THEN the system forces a winner by comparing total remaining sum across ALL players
- AND the pair with the lower total sum wins

#### Scenario: Both pairs over 200 simultaneously

- GIVEN both pairs have ≥200 points after a hand
- WHEN the hand is scored
- THEN the pair with the higher score wins
- AND if tied, extra hands are played until the tie breaks

#### Scenario: Single playable tile auto-highlight

- GIVEN the human player has exactly 1 tile that can be placed
- WHEN it becomes their turn
- THEN that tile MUST be visually highlighted
- AND choosing left/right side is still required (no auto-play)

#### Scenario: Match abandoned state

- GIVEN the game engine internally transitions to `abandoned`
- WHEN the component reads the status
- THEN a message "Match abandoned" MUST display
- AND a "Return to Lobby" button MUST be shown
