# Delta for round-match-flow

## MODIFIED Requirements

### Requirement: Match Types

The system MUST define `MatchStatus`, `MatchState`, `ActionResult`, and `GameEvent` in `src/game/types.ts`. The `GameStatusOverlay` and `AbandonedScreen` MUST display the identity of the player who caused abandonment.

#### Scenario: MatchState after initialization

- GIVEN 4 player hands of 10 tiles each and a 15-tile pool
- WHEN `initializeMatch()` is called
- THEN `status` MUST be `in_progress`
- AND `poolCount` MUST equal `pool.length`
- AND `targetScore` MUST default to 200

#### Scenario: ActionResult contracts

- GIVEN any action on a valid `MatchState`
- WHEN the function returns
- THEN `match` MUST be a complete immutable `MatchState`
- AND `events` MUST be `GameEvent[]` in causal order

#### Scenario: AbandonedScreen displays leaving player username

- GIVEN a match transitioned to `abandoned` status due to a `leave` forfeit
- WHEN `AbandonedScreen` renders
- THEN it displays "{username} left the match" using the `matchAbandonedBy` playerId
- AND if the username is unavailable, it falls back to "A player left the match"

## ADDED Requirements

### Requirement: Match Abandonment Store Field

The game store MUST include a `matchAbandonedBy` field to track which player caused an abandonment via forfeit.

#### Scenario: matchAbandonedBy is set on forfeit

- GIVEN the client receives a `match_abandoned` event with `reason: "forfeit"`
- WHEN the event is processed
- THEN `matchAbandonedBy` is set to the `disconnectedPlayerId` from the event

#### Scenario: matchAbandonedBy is null on non-forfeit abandonment

- GIVEN the client receives a `match_abandoned` event without `reason: "forfeit"`
- WHEN the event is processed
- THEN `matchAbandonedBy` remains `null`

#### Scenario: matchAbandonedBy is cleared on reset

- GIVEN `matchAbandonedBy` is set
- WHEN `reset()` is called on the game store
- THEN `matchAbandonedBy` is cleared to `null`

### Requirement: Username Resolution for Abandonment Display

The system SHOULD resolve player usernames from the match player list for display in abandonment messages.

#### Scenario: Username available from player state

- GIVEN a match has player "p1" with username "dominoKing"
- WHEN "p1" triggers abandonment
- THEN the overlay displays "dominoKing left the match"

#### Scenario: Username unavailable — fallback

- GIVEN a match has player "p1" with no resolved username
- WHEN "p1" triggers abandonment
- THEN the overlay displays "A player left the match"

<!-- TODO: All players MUST have a username (not email) for proper display.
     The profile resolution should happen during matchmaking and be stored
     in the player list so the overlay can always show a username. -->
