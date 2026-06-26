# Tasks: round-match-flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650-750 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Feature branch chain (PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 → PR 7 → PR 8) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Types + isBlocked setup | PR 1 | Core types and initial board detection |
| 2 | initializeMatch + startHand | PR 2 | Core match lifecycle implementation |
| 3 | playTile core logic | PR 3 | Tile placement validation and execution |
| 4 | passTurn + checkTimeout | PR 4 | Pass and timeout handling |
| 5 | handleHandEnd + cascade rule | PR 5 | Complex scoring and match end logic |
| 6 | Integration tests | PR 6 | End-to-end testing across match lifecycle |

## Phase 1: Types / Infrastructure

- [ ] 1.1 Add MatchStatus type ("waiting" | "in_progress" | "finished") to types.ts
- [ ] 1.2 Add MatchState (matchId, players, board, pool, poolCount, status, turnState, scores, consecutiveNullRounds), ActionResult, GameEvent discriminated union to types.ts
- [ ] 1.3 Implement isBlocked(board, players) in board.ts - returns true when NO player can legally play on either board end

## Phase 2: Match Initialization

- [ ] 2.1 Create src/game/match.ts with initializeMatch function
- [ ] 2.2 From hands array, create PlayerState entries for each player
- [ ] 2.3 Set MatchState with players, empty board, pool, poolCount (15), status 'in_progress', initial turn/score state
- [ ] 2.4 Return ActionResult with match and empty events array
- [ ] 2.5 Write 3-4 tests in match.test.ts covering basic state setup and validation

## Phase 3: Round Start

- [ ] 3.1 Implement startHand in match.ts
- [ ] 3.2 Determine first player via getFirstPlayer(players)
- [ ] 3.3 Set currentTurn in turnState
- [ ] 3.4 Calculate turnDeadline using TURN_TIMEOUT_MS
- [ ] 3.5 Reset all players' consecutivePasses to 0
- [ ] 3.6 Create fresh board via createBoard()
- [ ] 3.7 Emit GameEvent { type: 'round_started', firstPlayer: playerId }

## Phase 4: Tile Placement

- [ ] 4.1 Implement playTile in match.ts with all validation checks
- [ ] 4.2 MATCH_NOT_ACTIVE: return if match.status !== 'in_progress'
- [ ] 4.3 PLAYER_DISCONNECTED: return if player.isConnected === false
- [ ] 4.4 NOT_YOUR_TURN: return if player.id !== currentTurn player
- [ ] 4.5 TILE_NOT_FOUND: return if player doesn't have tileId
- [ ] 4.6 INVALID_PLAY: return if !canPlay(tile, side, board)
- [ ] 4.7 On success: place tile, update player hand, reset passes, advance turn, set deadline
- [ ] 4.8 Check for hand end (empty hand) and cascade to handleHandEnd
- [ ] 4.9 Emit tile_played event
- [ ] 4.10 Write 8-10 tests covering validation errors and success path

## Phase 5: Pass Actions

- [ ] 5.1 Implement passTurn in match.ts
- [ ] 5.2 Validate MATCH_NOT_ACTIVE and PLAYER_DISCONNECTED
- [ ] 5.3 Validate NOT_YOUR_TURN
- [ ] 5.4 Validate HAND_EMPTY: return if player.hand.length === 0
- [ ] 5.5 Increment player.consecutivePasses
- [ ] 5.6 Update player.lastActionAt
- [ ] 5.7 Advance turn (next player)
- [ ] 5.8 Emit player_passed event
- [ ] 5.9 Check if current board is blocked via isBlocked
- [ ] 5.10 If blocked → handleHandEnd with reason 'blocked'

## Phase 6: Timeout Handling

- [ ] 6.1 Implement checkTimeout in match.ts
- [ ] 6.2 Call turn.checkTurnTimeout with currentTurn player
- [ ] 6.3 If timedOut: force pass (increment passes on current player)
- [ ] 6.4 Advance turn after timeout
- [ ] 6.5 Emit turn_timeout event
- [ ] 6.6 Pass TimeoutResult to checkMatchEnd via handleHandEnd
- [ ] 6.7 Write 3-4 tests covering timeout scenarios

## Phase 7: Hand End Processing

- [ ] 7.1 Implement handleHandEnd in match.ts
- [ ] 7.2 Handle 3 cases based on reason:
   - 'winner': normal win → call scoreHand, applyHandResult
   - 'blocked': if consecutiveNullRounds < 3 → increment nullRounds, emit annulled with winner: null
   - 'forced_winner': 4th cascade → find lowest sumHand player, that player's pair wins
- [ ] 7.3 Call scoreHand(players) → get HandResult
- [ ] 7.4 If not annulled: applyHandResult(scores, handResult) → update MatchState.scores
- [ ] 7.5 Emit hand_ended event (winner: number | null)
- [ ] 7.6 Emit hand_scored event with HandResult
- [ ] 7.7 If match.over → emit match_ended event
- [ ] 7.8 Return updated MatchState

## Phase 8: Integration Testing

- [ ] 8.1 Create complete hand cycle tests using actual deck/shuffle/deal
- [ ] 8.2 Test full match lifecycle: deal → startHand → play → score → next hand → match end
- [ ] 8.3 Validate score accumulation across multiple hands
- [ ] 8.4 Test 4th null-round cascade rule under blocked scenarios
- [ ] 8.5 Verify event emission sequences and types
- [ ] 8.6 Write 3-4 integration tests covering complete match flow

