# Player-Hand Visual Specification

## Purpose

Visual feedback for timeout-blocked tiles in the player's hand. When a turn timeout forces a pass on playable tiles, those tiles show a red border + ✕ overlay so the player understands why they skipped their turn.

## Requirements

### Requirement: R1 — Blocked Tile Visual Feedback

When a tile is blocked by timeout, the UI MUST display a red border (`border-red-700/60`), reduced opacity (`opacity-55`), and a centered ✕ overlay. The tile MUST NOT be clickable.

#### Scenario: A-1 — Own blocked tiles show after timeout

- GIVEN Player 0 is in their turn with playable tiles
- WHEN 45s timeout fires and Player 0's playable tiles become blocked
- AND the turn advances to Player 1
- THEN Player 0's tile with `id` in `blockedTileIds` SHOWS the blocked visual (red border + ✕)
- AND the tile MUST NOT respond to click events

#### Scenario: A-2 — Interaction gating independent of `isMyTurn`

- GIVEN Player 0's tiles are blocked by timeout (turn already advanced to Player 1)
- WHEN Player 0 clicks on a blocked tile
- THEN no action is dispatched (the `canInteract` guard returns `false`)
- AND no client-side side effects occur

### Requirement: R2 — Block Reset Between Hands

Blocked tiles MUST reset at the start of each new hand. Server clears `blockedTileIds` on redeal; client re-renders after receiving updated state.

#### Scenario: A-3 — Blocked tiles don't carry to next hand

- GIVEN Player 0 has blocked tiles from a timeout in the previous hand
- WHEN a new hand is dealt (`round_started` event received)
- THEN `blockedTileIds` is empty in the store
- AND all tiles show normal appearance (no blocked visual)

#### Scenario: A-4 — Unblocked tiles remain playable

- GIVEN Player 0 has blocked tiles AND unblocked playable tiles
- WHEN it's Player 0's turn again (next round)
- THEN only the tiles in `blockedTileIds` show the blocked visual
- AND unblocked tiles can be played normally (clickable, no red border)

### Technical Enforcement

The `blocked` variable in `player-hand.tsx` SHALL be `blockedTileIds.includes(tile.id)` — NOT gated on `isMyTurn`. The `canInteract` guard (`playable && !blocked && isMyTurn`) SHALL remain the sole gate for interaction. The `blocked` prop SHALL be passed to `DominoTile` which renders the visual regardless of turn ownership.
