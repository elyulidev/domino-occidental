# Tasks: Lobby Server Component Refactor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 470–570 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (types + sidebar) → PR 2 (lobby page rewrite) |
| Delivery strategy | feature-branch-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Add TypeScript interfaces + refactor sidebar to real data | PR 1 | base: main; types.ts + layout.tsx; ~70 lines changed |
| 2 | Rewrite lobby page as async server component with 8 sub-components | PR 2 | base: PR 1 branch; page.tsx full rewrite; ~400-500 lines changed |

## Phase 1: Types Foundation

- [x] 1.1 Add `FriendEntry` interface to `packages/frontend/src/lib/api/types.ts` — fields: id, username, avatar_url, elo, status, online_status?
- [x] 1.2 Add `TournamentEntry` interface to `types.ts` — fields: id, name, status, bracket_type, entry_fee, starts_at, pairs_count, prize_display, phase_display
- [x] 1.3 Add `LobbyData` interface to `types.ts` — bundle: profile, leaderboard, friends, tournaments

## Phase 2: Sidebar Refactor (layout.tsx)

- [x] 2.1 Make `layout.tsx` async — add `async` to `DashboardLayout` function signature
- [x] 2.2 Add `createClient()` import from `@/lib/supabase/server` in `layout.tsx`
- [x] 2.3 Fetch authenticated user + profile in layout — `supabase.auth.getUser()` then `profiles` query for username, elo, coins, avatar_url
- [x] 2.4 Replace hardcoded "JugadorDemo" sidebar footer (lines 62-75) with real profile data — avatar initials/image, username link, elo, coins
- [x] 2.5 Handle unauthenticated state — show fallback "Invitado" if user is null

## Phase 3: Lobby Page — Data Layer

- [x] 3.1 Remove `"use client"` directive and all React client imports (useState, useEffect, apiFetch) from `page.tsx`
- [x] 3.2 Add `createClient` import from `@/lib/supabase/server` and new type imports
- [x] 3.3 Create `fetchLobbyData()` async function — calls `supabase.auth.getUser()` then runs 4 parallel queries via `Promise.allSettled`: profile, leaderboard, friends, tournaments
- [x] 3.4 Implement friends query — single `or` filter `requester_id.eq.{uid},addressee_id.eq.{uid}` with `status='accepted'`, join profiles for friend data
- [x] 3.5 Implement tournaments query — `.in('status', ['registration', 'in_progress']).order('starts_at').limit(4)`
- [x] 3.6 Add per-query error handling — each `Promise.allSettled` result checked, fallback to empty array/null on rejection

## Phase 4: Lobby Page — Sub-Components

- [x] 4.1 Define `WelcomeHeader` function — receives `{ username, elo, coins, rank }`, renders greeting section with badges
- [x] 4.2 Define `QuickMatchCard` function — renders quick match section, imports `<QuickMatchButton />` (only client component)
- [x] 4.3 Define `LeaderboardCard` function — receives `{ entries: LeaderboardEntry[] }`, renders top 10 list with empty state
- [x] 4.4 Define `FriendsOnlineCard` function — receives `{ friends: FriendEntry[] }`, renders friends list with empty state + link to `/users/search`
- [x] 4.5 Define `TournamentsCard` function — receives `{ tournaments: TournamentEntry[] }`, renders active tournaments with empty state + link to `/tournaments`
- [x] 4.6 Define `StatsCard` function — hardcoded values with `// TODO: wire to match_moves when schema exists`
- [x] 4.7 Define `StreaksCard` function — hardcoded values with `// TODO: wire to match_moves when schema exists`
- [x] 4.8 Define `PremiumUpsell` function — static content, no props needed

## Phase 5: Lobby Page — Assembly

- [x] 5.1 Export `metadata` object with title "Lobby — Dominó Occidental"
- [x] 5.2 Rewrite `LobbyPage` as async server component — call `fetchLobbyData()`, destructure results, pass to sub-components
- [x] 5.3 Remove all hardcoded `FRIENDS_ONLINE` and `TOURNAMENTS` arrays (lines 419-452)
- [x] 5.4 Remove skeleton loading states — server components render after data arrives
- [x] 5.5 Verify `bun run build` passes — confirms RLS allows server-side reads

## Phase 6: Cleanup & Verification

- [x] 6.1 Verify no `"use client"` remains in `page.tsx`
- [x] 6.2 Verify no `useState`, `useEffect`, or `apiFetch` calls in `page.tsx`
- [x] 6.3 Verify no hardcoded "JugadorDemo" in `layout.tsx`
- [x] 6.4 Run `bun run biome:check` — lint and format both modified files
- [ ] 6.5 Manual E2E: visit `/lobby` while authenticated — verify username, leaderboard, tournaments render with real data
- [ ] 6.6 Manual E2E: visit any dashboard page — verify sidebar shows real user profile
