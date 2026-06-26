# Delta for Round-Match Flow

## MODIFIED Requirements

### Requirement: Match Types

The system MUST define `MatchStatus`, `MatchState`, `ActionResult`, and `GameEvent` in `src/game/types.ts`.
(Previously: `GameEvent` had 9 variants for play/pass/timeout/hand-end/match-end flow)

`GameEvent` MUST be extended with 4 new variants for reconnection:

```typescript
// Existing variants unchanged. ADD:
  | { type: "player_disconnected"; playerId: string; reconnectWindowMs: number }
  | { type: "player_reconnected"; playerId: string }
  | { type: "reconnection_window_expiring"; playerId: string; secondsLeft: number }
  | { type: "match_abandoned"; disconnectedPlayerId: string; reason: "abandonment" | "forfeit" }
```

Requirement table updated:

| Function | Preconditions | Postconditions | Events |
|---|---|---|---|
| `initializeMatch(id, hands, pool, target?)` | 4x10-tile hands + 15 pool | Players, board, turn, scores created; pool stored | None |
| `startHand(m)` | status `in_progress` | Board fresh, passes reset, first player set with deadline | `round_started` |
| `playTile(m, pid, tid, side)` | Correct turn, has tile, playable, connected | Tile removed, board updated, passes reset, turn + deadline advanced | `tile_played`; cascade: `hand_ended` → `hand_scored` → `match_ended` |
| `passTurn(m, pid)` | Correct turn, hand non-empty, connected | Passes incremented, turn + deadline advanced | `player_passed`; may trigger `hand_ended` if blocked |
| `checkTimeout(m, now)` | — | Forces pass if `now > turnDeadline` | `turn_timeout` + forced `player_passed` |
| `handleHandEnd(m)` | Terminal board state | Winner resolved, scores applied, null-round tracked, match-end checked | `hand_ended`, `hand_scored`; optionally `match_ended` |
| `isBlocked(board, players)` | — (pure) | Returns `true` iff no player with tiles can play | None |

Error codes table remains unchanged. No requirements removed or renamed.

## REMOVED Requirements

None.

## RENAMED Requirements

None.
