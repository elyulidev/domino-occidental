# Module 9 — Message Handler Tasks

**What**: Implement message handler adapter for WebSocket client messages
**Why**: Need to route WS messages (play_tile, pass, leave) to engine functions with proper sanitization
**Where**: src/game/handler.ts, src/game/__tests__/handler.test.ts
**Learned**: Handler is pure adapter - no WS/timer logic, just routing and sanitization

## Task Breakdown

### T1: Define types (WsClientMessage, MessageResult, SanitizedMatchState, GameStore)

- WsClientMessage union (play_tile, pass, leave)
- MessageResult { events, state? }
- SanitizedMatchState (flattened client-safe version of MatchState)
- GameStore interface

### T2: Implement sanitizeState

- Strip pool
- Replace player hand with handSize
- Keep isConnected, id
- Return SanitizedMatchState

### T3: Implement handleMessage — routing

- getGame from store → null = error
- switch on message.type → engine function
- updateGame store
- Build MessageResult with events + sanitized state

### T4: Write tests

- Each message type → correct engine call + sanitized state returned
- Unknown matchId → game_error MATCH_NOT_FOUND
- Unknown message type → game_error INVALID_MESSAGE
- Engine game_error → passed through
- Sanitization correctness
