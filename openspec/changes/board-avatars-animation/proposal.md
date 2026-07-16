# Proposal: Board Avatars & Play Animation

## Intent

The game board currently shows tiles with small tooltips identifying who played each tile, but there's no persistent visual identity for players during gameplay. Players cannot quickly tell which side of the board their partner/opponents occupy, and tile plays feel instantaneous rather than spatial. This change adds player avatars around the board and animates tile plays from avatar to final position, improving spatial awareness and play attribution.

## Scope

### In Scope
- Add `avatar_url` to `SanitizedMatchState` (server sends it, client receives it)
- Render 4 player avatars at fixed positions around the board (top, right, bottom, left)
- Animate new tiles from the playing avatar to the tile's final grid position
- Maintain existing hover tooltip for tile attribution

### Out of Scope
- Avatar upload/edit (assumed to exist in profiles; if not, deferred)
- Avatar selection or customization UI
- Sound effects on play
- Spectator mode avatars
- Disconnected player avatar visual state (gray-out) — future polish

## Capabilities

### New Capabilities
- `board-avatars`: Player avatar rendering around the board perimeter, layout positioning relative to current player's perspective, and avatar idle/disconnected states

### Modified Capabilities
- `board-rendering`: R6 tile animation changes from simple CSS fade-in to avatar-origin animation. New tile animation requires coordinate origin (avatar position) + target (grid position).
- `round-match-flow`: `SanitizedMatchState` gains `avatarUrls: [string, string, string, string]`. Server must fetch `avatar_url` from `profiles` table alongside player names.

## Approach

**Avatar placement**: Fixed positions around board container — top (P3, partner), right (P4), bottom (P1/self), left (P2). Positions relative to current player's seat index so perspective rotates per player.

**Animation technique**: CSS `@keyframes` via inline `style` with `animation` property. No library needed — this is a simple translate + opacity transition. Web Animations API (`element.animate()`) for programmatic start/end coordinates since grid positions are dynamic.

**Detection of new tile**: Compare `board.tiles.length` between renders. When length increases, the last tile in the array is the new play. Extract `playerId` from that tile to identify the source avatar.

**Server change**: Add `avatar_url` to `profiles` table query in match creation. Include in `playerNamesStore` shape as `{ name, avatarUrl }[]`. Add `avatarUrls` tuple to `SanitizedMatchState`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/shared/src/types.ts` | Modified | Add `avatarUrls` to `MatchState` / `SanitizedMatchState` |
| `packages/backend/src/game/match-creation.ts` | Modified | Fetch `avatar_url` from profiles, store in player store |
| `packages/backend/src/game/sanitize.ts` | Modified | Include `avatarUrls` in sanitized output |
| `app/(dashboard)/match/[id]/page.tsx` or board component | Modified | Add `PlayerAvatar` component, layout wrapper |
| `packages/shared/src/game/grid-layout.ts` | Read-only | Understand grid coordinates for animation targets |
| `app/(dashboard)/match/[id]/components/` | New | `PlayerAvatar.tsx` component, avatar position constants |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Avatar URL missing for users without uploaded avatar | High | Server falls back to default avatar (generated initials or placeholder URL) |
| Animation jank on low-end devices | Medium | `prefers-reduced-motion` media query disables animation; fallback to instant placement |
| Avatar positions overlap on very small screens (< 360px) | Low | Avatar scales down; on mobile, consider hiding 2 of 4 avatars (only show self + active player) |
| Server performance: extra `avatar_url` fetch per match | Low | Single SELECT with existing profile query; no N+1 |

## Rollback Plan

1. Remove `PlayerAvatar` component from board render tree
2. Remove `avatarUrls` from `SanitizedMatchState` (server stops sending)
3. Revert board container to current flat layout
4. Remove animation logic from tile rendering
5. No database migration needed (avatar_url column assumed to already exist in profiles)

## Dependencies

- `profiles.avatar_url` column must exist (check migration status; if missing, add migration as prerequisite)
- No new npm packages required

## Success Criteria

- [ ] 4 avatars render around board at correct positions for all 4 seat perspectives
- [ ] New tile animates from source avatar to final grid position in ~400ms
- [ ] Animation respects `prefers-reduced-motion`
- [ ] Existing hover tooltip still works on all tiles
- [ ] Default avatar fallback works when `avatar_url` is null
- [ ] No performance regression: board renders < 16ms on mid-range device

## Proposal Question Round

Before finalizing, here are questions to sharpen the proposal:

1. **Avatar size on desktop vs mobile**: Should avatars be the same size everywhere, or smaller on mobile (say 40px vs 64px)? This affects layout space around the board.

2. **Active player indicator**: Should the current player's avatar have a visual highlight (glow, ring, pulse) to reinforce whose turn it is? Or keep it neutral?

3. **Disconnected state**: During the exploration out-of-scope, but quick question — should a disconnected player's avatar gray out immediately, or only after the 30s reconnection window?

4. **Animation timing**: 400ms felt right in the proposal. Too slow for fast-paced play? Too fast to notice? Should it vary by distance (farther = longer)?

5. **Avatar shape**: Circular (most common) or rounded square (domino tile aesthetic)? Circular is standard; rounded square ties into the tile visual language.

Let me know which of these you want to decide now vs. defer to the design phase.
