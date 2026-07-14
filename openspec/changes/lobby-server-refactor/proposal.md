# Proposal: Lobby Server Component Refactor

## Intent

The lobby page (`lobby/page.tsx`, 452 lines) is a monolithic `"use client"` component that fetches all data via browser-side `apiFetch` calls with manual loading/error states. This creates unnecessary waterfalls, prevents SSR/SEO, and leaves 3 hardcoded placeholder arrays (friends, tournaments, stats) untouched since scaffolding. The dashboard sidebar (`layout.tsx`, lines 62–75) has a hardcoded "JugadorDemo" user footer. This refactor converts the lobby to an async server component that queries Supabase directly, extracts sub-components as props-driven pure functions, and connects the sidebar to real auth data.

## Scope

### In Scope
- Convert `lobby/page.tsx` from `"use client"` to async server component
- Remove all `useState`/`useEffect` data-fetching; use `createClient()` from `@/lib/supabase/server` directly
- Extract 8 visual sections into sub-components defined in the same file (WelcomeHeader, QuickMatchCard, Leaderboard, FriendsOnline, Tournaments, StatsCard, StreaksCard, PremiumUpsell) — each receives data via props
- Remove hardcoded `FRIENDS_ONLINE` and `TOURNAMENTS` arrays; query `friendships` and `tournaments` tables via Supabase
- Connect dashboard sidebar user footer to real profile data (replace "JugadorDemo")
- `QuickMatchButton` remains as the only client component (already extracted)
- Leave streaks/daily stats as hardcoded values with `// TODO:` markers (no schema exists)
- Remove skeleton loading states (server components render after data arrives)

### Out of Scope
- New backend endpoints for friends online, tournaments, or stats
- Real-time online status for friends (requires Supabase Realtime subscriptions — client-side only)
- Tournament detail data transformation or aggregation
- Changes to the `QuickMatchButton` component
- Mobile sidebar or responsive layout changes
- New database tables or migrations

## Capabilities

### New Capabilities
- `lobby-server-fetch`: Server-side data fetching for lobby page via Supabase direct queries (profile, leaderboard, friends, tournaments)

### Modified Capabilities
- `profile-edit-page`: Sidebar user footer now receives real profile data instead of hardcoded values (layout.tsx modification)

## Approach

**Pattern**: Follow the established pattern from `profile/[username]/page.tsx` — async server component, `createClient()` from `@/lib/supabase/server`, direct Supabase queries.

**Data sources**:
| Section | Source | Query |
|---------|--------|-------|
| WelcomeHeader | `profiles` table | `select username, elo, coins, rank` for current user |
| QuickMatchCard | No data needed | Static content + `<QuickMatchButton />` |
| Leaderboard | `profiles` table | `select username, elo` ordered by `elo desc` limit 10 |
| FriendsOnline | `friendships` + `profiles` | Join on `friendships` where `status='accepted'` and either party is current user |
| Tournaments | `tournaments` table | `select *` where `status IN ('registration','in_progress')` limit 4 |
| StatsCard | No schema | Hardcoded with `// TODO: wire to match_moves when schema exists` |
| StreaksCard | No schema | Hardcoded with `// TODO: wire to match_moves when schema exists` |
| PremiumUpsell | No data needed | Static content |

**Sub-component structure**: All 8 sub-components defined as regular function components in `page.tsx`, receiving typed props. No new files. The page itself is an async function that runs queries with `Promise.all` for parallel fetching, then passes results down.

**Sidebar refactor**: `layout.tsx` becomes an async server component. Query `profiles` for the authenticated user via `createClient()` and pass data to the sidebar footer. Replace hardcoded "JugadorDemo" with real username/elo/coins/avatar.

**Error handling**: Wrap each Supabase query in try/catch. On failure, render a fallback section (e.g., "No se pudo cargar") rather than failing the entire page.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | Modified | Full rewrite from client to server component |
| `packages/frontend/src/app/(dashboard)/layout.tsx` | Modified | Sidebar user footer connected to real profile data |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Supabase RLS blocks server-side queries without user context | Low | `createClient()` uses cookie-based auth — same as `profile/[username]` pattern |
| Friends query returns empty (no friendships data yet) | Medium | Graceful empty state already exists in UI ("No hay amigos conectados") |
| Layout.tsx becomes async and breaks child component rendering | Low | Next.js App Router natively supports async server layouts |
| `Promise.all` waterfall if one query is slow | Low | All queries are simple indexed reads; parallel execution mitigates |

## Rollback Plan

Revert both files to their current git state. No database changes, no new dependencies, no migration artifacts. The refactor is purely frontend — a single `git checkout` restores the previous behavior.

## Dependencies

- Supabase `friendships` table must exist with `status` column (already in schema v2.0)
- Supabase `tournaments` table must exist with `status` column (already in schema v2.0)
- Auth cookies must be available in server components (verified via `createClient()` pattern)

## Success Criteria

- [ ] `lobby/page.tsx` renders as a server component (no `"use client"` directive)
- [ ] Profile data (username, elo, coins) fetched from Supabase, not hardcoded
- [ ] Leaderboard top 10 fetched from `profiles` table
- [ ] Friends list queries `friendships` table (empty state if no friends)
- [ ] Tournaments list queries `tournaments` table (empty state if none)
- [ ] Dashboard sidebar shows real authenticated user data
- [ ] No hardcoded "JugadorDemo" anywhere in the codebase
- [ ] All `// TODO:` markers present for streaks and daily stats
- [ ] `bun run build` passes without errors
- [ ] No new files created (all sub-components in `page.tsx`)
