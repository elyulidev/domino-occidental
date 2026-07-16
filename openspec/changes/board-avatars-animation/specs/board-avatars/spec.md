# Board Avatars Specification

## Purpose

Render player avatars around the game board perimeter, display active-player highlight, handle disconnected state, and provide default avatar fallback. Frontend-only capability tied to match session data.

## Requirements

### Requirement: Avatar Rendering

The system MUST render 4 player avatars at fixed positions around the board: bottom (self/P1), left (P2), top (partner/P3), right (P4). Avatar positions MUST rotate per player's seat index so perspective is always relative to the current user.

#### Scenario: All players have avatars

- GIVEN a match with 4 players, each having a non-null `avatarUrl`
- WHEN the board renders
- THEN 4 circular avatars MUST appear at bottom, left, top, right positions
- AND each avatar MUST display the player's `avatar_url` image

#### Scenario: Player without avatar

- GIVEN a player whose `avatarUrl` is null or empty
- WHEN the board renders
- THEN a circular SVG default avatar MUST display in place of the photo
- AND the default avatar SHALL use a neutral silhouette design

#### Scenario: Avatar size responsive

- GIVEN viewport width ≥ 768px (desktop)
- WHEN avatars render
- THEN each avatar MUST be 64×64px

- GIVEN viewport width < 768px (mobile)
- WHEN avatars render
- THEN each avatar MUST be 40×40px

### Requirement: Active Player Highlight

The system MUST visually distinguish the current player's avatar with a highlight effect. The highlight MUST track turn changes in real time.

#### Scenario: Active player glow

- GIVEN it is P2's turn (currentTurn = 1)
- WHEN the board renders
- THEN P2's avatar MUST display a glowing ring or pulse animation
- AND the other 3 avatars MUST appear without highlight

#### Scenario: Turn transitions

- GIVEN P2 is currently highlighted
- WHEN P2 plays or passes and turn advances to P3
- THEN P2's highlight MUST be removed
- AND P3's avatar MUST gain the highlight within 400ms

### Requirement: Disconnected Avatar State

The system MUST gray out a disconnected player's avatar, but ONLY after the 30-second reconnection window expires.

#### Scenario: Connected player

- GIVEN a player with `isConnected === true`
- WHEN the board renders
- THEN the avatar MUST display at full opacity with no gray filter

#### Scenario: Recently disconnected (within 30s)

- GIVEN a player with `isConnected === false` and reconnection window active (< 30s elapsed)
- WHEN the board renders
- THEN the avatar MUST still display at full opacity
- AND a small disconnected indicator (dot/badge) MAY appear

#### Scenario: Disconnected after timeout

- GIVEN a player with `isConnected === false` and > 30s elapsed since disconnect
- WHEN the board renders
- THEN the avatar MUST apply a gray/saturate(0) filter
- AND the avatar MUST be at reduced opacity (0.5)

### Requirement: Animation Accessibility

The system MUST respect `prefers-reduced-motion` for all avatar and tile animations.

#### Scenario: Reduced motion enabled

- GIVEN the user has `prefers-reduced-motion: reduce` in OS settings
- WHEN any avatar highlight or tile play animation triggers
- THEN animations MUST be disabled (instant state change)
- AND the visual state change (highlight on/off, tile placement) MUST still occur

### Requirement: Tile Play Animation Origin

When a new tile appears on the board, the animation MUST originate from the playing avatar's screen position toward the tile's final grid coordinate. Duration MUST be 400ms.

#### Scenario: Tile animates from avatar

- GIVEN P3 plays a tile that appears at grid position (x, y)
- WHEN the board detects a new tile via `board.tiles.length` increase
- THEN the tile MUST animate from P3's avatar center to (x, y) over 400ms
- AND the animation MUST use CSS keyframes or Web Animations API (no library)

#### Scenario: Rapid consecutive plays

- GIVEN two tiles played within 500ms by different players
- WHEN both animations trigger
- THEN each tile MUST animate independently from its respective avatar
- AND animations MUST NOT block or queue behind each other
