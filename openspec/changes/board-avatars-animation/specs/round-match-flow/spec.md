# Delta for Round-Match Flow

## MODIFIED Requirements

### Requirement: Match Types

The system MUST define `MatchStatus`, `MatchState`, `ActionResult`, and `GameEvent` in `src/game/types.ts`. `SanitizedMatchState` MUST include an `avatarUrls` tuple of 4 strings (`[string, string, string, string]`), indexed by player position. Each entry is the player's `avatar_url` from the `profiles` table, or an empty string if null. The server MUST fetch `avatar_url` alongside player names during match creation and include it in the player store.

(Previously: MatchState types defined without avatar data.)

#### Scenario: MatchState after initialization

- GIVEN 4 player hands of 10 tiles each and a 15-tile pool
- WHEN `initializeMatch()` is called
- THEN `status` MUST be `in_progress`
- AND `poolCount` MUST equal `pool.length`
- AND `targetScore` MUST default to 200

#### Scenario: SanitizedMatchState includes avatarUrls

- GIVEN a match with 4 players, 3 having avatar URLs and 1 with null
- WHEN the server sanitizes match state for client delivery
- THEN `avatarUrls` MUST be a 4-element tuple
- AND the 3 players with URLs MUST have their `avatar_url` string at their seat index
- AND the player with null MUST have an empty string `""` at their seat index

#### Scenario: Server fetches avatar_url on match creation

- GIVEN a new match is being created with 4 player IDs
- WHEN the server queries the `profiles` table for player data
- THEN the query MUST include `avatar_url` alongside `username`/`display_name`
- AND the result MUST be stored in the player store as `{ name, avatarUrl }[]`

#### Scenario: Avatar URL missing gracefully

- GIVEN a player whose `profiles.avatar_url` is NULL in the database
- WHEN match state is sanitized
- THEN `avatarUrls[playerIndex]` MUST be `""` (empty string)
- AND the client MUST render a default SVG avatar for that slot

#### Scenario: ActionResult contracts

- GIVEN any action on a valid `MatchState`
- WHEN the function returns
- THEN `match` MUST be a complete immutable `MatchState`
- AND `events` MUST be `GameEvent[]` in causal order
