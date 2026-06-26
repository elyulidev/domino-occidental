# Archive: WS Connection Handler — PR1 ✅

## Scope
PR1 of Module 11: Connection Manager Core (auth + rate limiter → PR2)

## Implemented
- `src/ws/connection.ts` — Connection Manager factory (`createConnectionManager`), `sendToPlayer` (implements `SendFn`), Elysia WS plugin (`createWsPlugin`)
- `src/ws/__tests__/connection.test.ts` — 15 tests covering ConnectionMap, sendToPlayer, plugin hooks, message routing, error handling
- `package.json` — added `elysia@1.4.29`

## Engine Wiring
- WS `open` → `reconnectPlayer()` from connection.ts engine
- WS `message` → JSON parse → `handleMessage(store, matchId, playerId, msg)` → `broadcastEvents(events, matchId, playerId, sendToPlayer)` → sanitizedState to acting player
- WS `close` → `unregister()` → `disconnectPlayer()` from engine
- JSON parse error → `game_error` to sender (no crash)

## Test Results
- 15 connection tests: 15/15 pass
- 294 total tests: 294/294 pass, 0 failures
- 773 expect() calls
- biome check: clean

## Verification
All spec requirements R1-R4, R7 met (R5/R6 are PR2 scope).

## Pending (PR2)
- `src/ws/auth.ts` — JWT verification with Supabase
- `src/ws/rate-limiter.ts` — Token bucket (10 msg/s)
- Integration of auth + rate limiter into connection.ts hooks
- `src/ws/__tests__/auth.test.ts`
- `src/ws/__tests__/rate-limiter.test.ts`

## Key Decisions
- Flat `playerId` → WebSocket map (not composite `matchId:playerId`)
- Functions encapsulated in `createConnectionManager()` factory
- Plugin creates its own internal manager instance
- sendToPlayer silently no-ops for unknown playerId
