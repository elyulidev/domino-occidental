# Design: Lobby Server Component Refactor

## Technical Approach

Convert `lobby/page.tsx` from a 452-line `"use client"` component to an async server component that fetches data directly from Supabase via `createClient()`, following the established pattern in `profile/[username]/page.tsx`. All 8 visual sections become pure function sub-components defined in the same file, receiving typed props. The dashboard sidebar (`layout.tsx`) becomes an async server component to replace hardcoded "JugadorDemo" with real auth data. No new files are created.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Data fetching pattern | `Promise.all` in async page | Sequential awaits, React Suspense boundaries | Parallel queries minimize total waterfall. All 4 queries are independent indexed reads — no dependency between them. Simpler than Suspense for 4 parallel fetches. |
| Sub-component structure | Inline functions in `page.tsx` | Separate files in `_components/` | Proposal explicitly scoped "no new files." 8 small components (~30-50 LOC each) fit naturally in one file. They are server-only — no `"use client"`. |
| Sidebar approach | Make `layout.tsx` async | Extract sidebar to client component, or separate server component file | `layout.tsx` is already a server component (no `"use client"`). Making it async is the minimal change. A client component would need its own data-fetching layer. |
| Error handling | Per-query try/catch with fallback | React ErrorBoundary, top-level try/catch | Each section degrades independently — a friends query failure doesn't kill the leaderboard. Matches the "graceful degradation" requirement. |
| Friends online status | Show accepted friends only (no real-time) | Add Supabase Realtime subscription | Real-time presence is explicitly out of scope. Friends card shows ELO + name from `profiles` join. Online status stays as a static placeholder with a `// TODO` for Realtime. |

## Data Flow

```
LobbyPage (async server component)
  │
  ├─ fetchLobbyData() ──→ Promise.all([
  │   supabase.from('profiles').select('...').eq('id', userId).single()  → profile
  │   supabase.from('profiles').select('...').order('elo', {asc:false}).limit(10)  → leaderboard
  │   supabase.from('friendships').select('..., profiles!inner(...)')...  → friends
  │   supabase.from('tournaments').select('...').in('status',[...]).limit(4)  → tournaments
  │  ])
  │
  ├─ WelcomeHeader({ username, elo, coins, rank })
  ├─ QuickMatchCard → <QuickMatchButton /> (client component)
  ├─ LeaderboardCard({ entries: LeaderboardEntry[] })
  ├─ FriendsOnlineCard({ friends: FriendEntry[] })
  ├─ TournamentsCard({ tournaments: TournamentEntry[] })
  ├─ StatsCard → hardcoded with TODO
  ├─ StreaksCard → hardcoded with TODO
  └─ PremiumUpsell → static, no props

DashboardLayout (async server component)
  │
  ├─ supabase.auth.getUser() → userId
  ├─ supabase.from('profiles').select('username,elo,coins,avatar_url').eq('id', userId).single()
  └─ SidebarFooter({ username, elo, coins, avatarUrl })
```

## Interfaces / Contracts

```typescript
// packages/frontend/src/lib/api/types.ts — additions to existing file

/** Friend with profile data, queried from friendships + profiles join */
export interface FriendEntry {
  id: string
  username: string
  avatar_url: string | null
  elo: number
  status: string          // friendship status: 'accepted'
  online_status?: string  // TODO: wire to Realtime presence
}

/** Tournament from the tournaments table */
export interface TournamentEntry {
  id: string
  name: string
  status: string          // 'registration' | 'in_progress' | 'finished' | 'cancelled'
  bracket_type: string
  entry_fee: number | null
  starts_at: string | null
  // Derived for display
  pairs_count: number
  prize_display: string   // formatted for UI
  phase_display: string   // derived from status + bracket_type
}

/** Lobby data bundle — fetched in parallel */
export interface LobbyData {
  profile: ProfileResponse | null
  leaderboard: LeaderboardEntry[]
  friends: FriendEntry[]
  tournaments: TournamentEntry[]
}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/frontend/src/lib/api/types.ts` | Modify | Add `FriendEntry`, `TournamentEntry`, `LobbyData` interfaces |
| `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | Rewrite | Server component: `fetchLobbyData()` + 8 inline sub-components |
| `packages/frontend/src/app/(dashboard)/layout.tsx` | Modify | Make async, fetch profile, replace "JugadorDemo" sidebar footer |

**No new files created.** `QuickMatchButton` stays as-is.

## Supabase Queries

```typescript
// 1. Profile (current user)
const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = await supabase
  .from('profiles')
  .select('id, username, avatar_url, elo, coins, country, rank')
  .eq('id', user!.id)
  .maybeSingle()

// 2. Leaderboard top 10
const { data: leaderboard } = await supabase
  .from('profiles')
  .select('username, elo, avatar_url, rank')
  .order('elo', { ascending: false })
  .limit(10)

// 3. Friends (accepted friendships with profile join)
const { data: friendships } = await supabase
  .from('friendships')
  .select(`
    id, status,
    profiles!friendships_addressee_id_fkey ( id, username, avatar_url, elo )
  `)
  .eq('requester_id', user!.id)
  .eq('status', 'accepted')
// Note: also query where addressee_id = user!.id
// Two queries needed OR use an `or` filter:
const { data: friends } = await supabase
  .from('friendships')
  .select('id, status, requester_id, addressee_id')
  .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
  .eq('status', 'accepted')
// Then resolve profiles separately or use a view

// 4. Active tournaments
const { data: tournaments } = await supabase
  .from('tournaments')
  .select('id, name, status, bracket_type, entry_fee, starts_at')
  .in('status', ['registration', 'in_progress'])
  .order('starts_at', { ascending: true })
  .limit(4)
```

**Friends query complexity**: The `friendships` table has `requester_id` and `addressee_id`. The current user could be either side. Two approaches:

1. **Two parallel queries** — one filtering `requester_id`, one `addressee_id`, then merge and deduplicate
2. **Single query with `or`** — filter `requester_id.eq.{uid} OR addressee_id.eq.{uid}`

Choose option 2 (single query with `or`). It's one round-trip. The response includes both IDs so the component can resolve which is the friend (the "other" side).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `fetchLobbyData` query logic | Mock `supabase.from()` chain, verify correct table/columns/order/limits called |
| Unit | Sub-component rendering | Render each function component with mock props, verify output |
| Integration | Server component renders without error | `bun run build` passes — verifies RLS allows server-side reads |
| E2E | Full lobby loads with real data | Visit `/lobby` while authenticated, verify username, leaderboard, tournaments visible |

## Server/Client Boundary

```
SERVER (no "use client"):
  lobby/page.tsx           — entire page + 8 sub-components
  layout.tsx               — sidebar with profile fetch

CLIENT ("use client"):
  lobby/_components/quick-match-button.tsx   — stays as-is (interactive)
  components/mobile-menu.tsx                 — stays as-is (interactive)
```

Server components cannot use `useState`, `useEffect`, `onClick`, or browser APIs. All 8 lobby sub-components are pure JSX with props — no interactivity needed.

## Error Handling

```typescript
// Pattern: per-query try/catch, fallback rendering
async function fetchLobbyData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileResult, leaderboardResult, friendsResult, tournamentsResult] =
    await Promise.allSettled([
      // ...queries...
    ])

  return {
    profile: profileResult.status === 'fulfilled' ? profileResult.value.data : null,
    leaderboard: leaderboardResult.status === 'fulfilled' ? leaderboardResult.value.data ?? [] : [],
    friends: friendsResult.status === 'fulfilled' ? friendsResult.value.data ?? [] : [],
    tournaments: tournamentsResult.status === 'fulfilled' ? tournamentsResult.value.data ?? [] : [],
  }
}
```

Use `Promise.allSettled` (not `Promise.all`) so one failed query doesn't kill all sections. Each sub-component handles empty/error state with existing empty-state UI (already in the current code for leaderboard and friends).

## Performance Considerations

| Concern | Solution |
|---------|----------|
| Query waterfall | `Promise.allSettled` runs all 4 queries in parallel |
| Layout.tsx sidebar | Single `profiles` query for current user — same query the lobby already does, but layout.tsx runs for ALL dashboard pages. Consider: this query is fast (indexed by PK), one row, ~50 bytes. Acceptable. |
| Unnecessary re-renders | Server components don't re-render on client navigation — they render once per request. No `useEffect` cleanup needed. |
| Caching | No explicit cache headers needed — Supabase reads are fast (<50ms p95 for indexed queries). Next.js fetch deduplication automatically caches identical requests within the same render. |
| Loading states | Removed entirely — server components render AFTER data arrives. The browser receives complete HTML. No skeleton spinners needed. |
| Friends query (two-sided) | Single `or` query instead of two sequential queries. The `friendships` table should have an index on `(requester_id, status)` and `(addressee_id, status)` — verify in schema. |

## Sidebar Design Detail

`layout.tsx` becomes async:

```typescript
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('username, elo, coins, avatar_url')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  }

  // ... rest of layout with profile passed to sidebar footer
}
```

The sidebar footer Link becomes:

```tsx
<Link href={`/profile/${profile?.username ?? ''}`}>
  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-domino-700">
    {profile?.avatar_url ? (
      <img src={profile.avatar_url} alt={profile.username} className="h-full w-full rounded-full object-cover" />
    ) : (
      <span className="text-sm font-semibold text-gold-400">
        {profile?.username?.slice(0, 2).toUpperCase() ?? '??'}
      </span>
    )}
  </div>
  <div className="flex-1 min-w-0">
    <p className="truncate text-sm font-medium text-domino-50">
      {profile?.username ?? 'Invitado'}
    </p>
    <p className="text-xs text-domino-400">ELO {profile?.elo?.toLocaleString('es-AR') ?? '—'}</p>
  </div>
  <div className="flex items-center gap-1 rounded-full bg-gold-500/10 px-2.5 py-1">
    <span className="text-xs font-semibold text-gold-400">{profile?.coins ?? 0}</span>
  </div>
</Link>
```

## Migration / Rollout

No migration required. No database changes, no new dependencies, no migration artifacts. Revert is a single `git checkout` of both modified files.

## Open Questions

- [ ] Do `friendships` table have indexes on `(requester_id, status)` and `(addressee_id, status)`? The `or` query needs both to be efficient. If not, an index migration may be needed.
- [ ] Should the sidebar show a "Not logged in" state when `user` is null, or is auth guaranteed at this layout level? (Assuming auth middleware guards all `(dashboard)` routes.)
- [ ] The `leaderboard` query uses `rank` column directly — does the `profiles` table have a `rank` column, or is rank derived from position? The existing `ProfileResponse` type includes `rank: number`, suggesting it's a materialized column. Verify.
