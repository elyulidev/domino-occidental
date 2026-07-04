# Delta for ws-connection

## MODIFIED Requirements

### R3: Player Connection State

The system MUST call `disconnectPlayer()` on WS close and `reconnectPlayer()` on WS open for reconnecting players. All disconnect/abandonment broadcasts MUST include sanitized match state so clients can update `isConnected` and other player-visible fields.
(Previously: disconnect events were broadcast without state; clients could not update `isConnected` because `use-websocket.ts` gates store updates on `msg.state`)

#### Scenario: Disconnect propagates to engine (unchanged)

- GIVEN "p1" is connected in "match-1"
- WHEN the WS `close` hook fires
- THEN `disconnectPlayer(match, "p1", now)` is called
- AND resulting events are broadcast

#### Scenario: B-1 — Disconnection state delivered to all players

- GIVEN a 4-player game is in progress
- WHEN Player 1's WebSocket closes
- THEN `broadcastEvents` at connection.ts:432 receives `sanitizeState(result.match)` as the 6th argument
- AND within 5 seconds all other players receive a WS message with `state.players[1].isConnected === false`
- AND the opponent indicator shows Player 1 as offline (red dot)

#### Scenario: B-2 — Reconnection updates isConnected

- GIVEN Player 1 was disconnected (shown as offline)
- WHEN Player 1 reconnects
- THEN `broadcastEvents` at connection.ts:229/300 receives `sanitizeState(result.match)` as the 6th argument (already working — not part of this fix)
- AND within 5 seconds all other players see Player 1 as online (green dot)
- AND this scenario continues to pass after fixing the disconnect path

#### Scenario: B-3 — Timer-manager heartbeat disconnection delivers state

- GIVEN a player's WebSocket is detected closed by the heartbeat check
- WHEN `broadcastEvents` at timer-manager.ts:137 fires with `player_disconnected`
- THEN `sanitizeState(result.match)` MUST be passed as the 6th argument

#### Scenario: B-4 — Timer-manager abandonment delivers state

- GIVEN a player has been disconnected past the abandonment threshold
- WHEN `broadcastEvents` at timer-manager.ts:189 fires with `match_abandoned`
- THEN `sanitizeState(result.match)` MUST be passed as the 6th argument
