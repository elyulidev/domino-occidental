# Verify Report: lobby-server-refactor

**Date**: 2026-07-14
**Verifier**: SDD Verify Agent
**Status**: PASS (with WARNINGS)

---

## Automated Checks

| Check | Target | Result | Details |
|-------|--------|--------|---------|
| `"use client"` in page.tsx | page.tsx | ✅ PASS | No `"use client"` directive found |
| Async function | page.tsx | ✅ PASS | `export default async function LobbyPage()` |
| 8 sub-components | page.tsx | ✅ PASS | WelcomeHeader, QuickMatchCard, LeaderboardCard, FriendsOnlineCard, TournamentsCard, StatsCard, StreaksCard, PremiumUpsell |
| Hardcoded arrays removed | page.tsx | ✅ PASS | No `FRIENDS_ONLINE` or `TOURNAMENTS` arrays |
| Metadata exported | page.tsx | ⚠️ WARNING | Exported but title is `"Inicio — Dominó Occidental"` instead of spec `"Lobby — Dominó Occidental"` |
| "JugadorDemo" removed | layout.tsx | ✅ PASS | No "JugadorDemo" literal found |
| Build | frontend | ✅ PASS | `next build` compiles successfully, TypeScript passes |
| Biome lint | lobby files | ✅ PASS | No Biome errors in target files (pre-existing errors in other files only) |
| Server component pattern | page.tsx | ✅ PASS | Uses `createClient()` from `@/lib/supabase/server`, no `useState`/`useEffect` |

---

## Requirements Traceability

### R1: Lobby Page is Async Server Component

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `"use client"` removed | ✅ PASS | Not present |
| `export default async function` | ✅ PASS | Line 370: `export default async function LobbyPage()` |
| Uses `createClient()` from server | ✅ PASS | Line 3: import from `@/lib/supabase/server` |
| Exports metadata | ⚠️ WARNING | **Title mismatch**: spec says `"Lobby — Dominó Occidental"`, actual is `"Inicio — Dominó Occidental"` |
| No useState/useEffect | ✅ PASS | No client hooks present |

**Verdict**: ⚠️ PASS (minor title deviation)

### R2: 8 Sub-Components as Pure Functions with Props

| Sub-component | Props | Result | Evidence |
|---------------|-------|--------|----------|
| WelcomeHeader | `{ profile: ProfileResponse \| null }` | ✅ PASS | Line 12-57 |
| QuickMatchCard | No props | ✅ PASS | Line 60-91, imports QuickMatchButton |
| LeaderboardCard | `{ leaderboard: LeaderboardEntry[] }` | ✅ PASS | Line 93-140 |
| FriendsOnlineCard | `{ friends: Array<{ username, elo }> }` | ⚠️ WARNING | Uses inline type instead of `FriendEntry[]` from types.ts |
| TournamentsCard | `{ tournaments: Array<{ id, name, status, pairs_count, prize_pool }> }` | ⚠️ WARNING | Uses inline type instead of `TournamentEntry[]` from types.ts |
| StatsCard | No props, hardcoded values | ✅ PASS | Line 287-310, has TODO comment |
| StreaksCard | No props, hardcoded values | ✅ PASS | Line 312-331, has TODO comment |
| PremiumUpsell | No props, static | ✅ PASS | Line 333-366 |

**New interfaces `FriendEntry` and `TournamentEntry` defined in types.ts but NOT used by the sub-components.** The sub-components use inline anonymous types instead. This works but deviates from the design contract.

**Verdict**: ⚠️ PASS (interface types defined but unused by sub-components)

### R3: All Hardcoded Placeholder Data Removed

| Item | Result | Evidence |
|------|--------|----------|
| `FRIENDS_ONLINE` array | ✅ PASS | Removed |
| `TOURNAMENTS` array | ✅ PASS | Removed |
| StatsCard hardcoded | ✅ PASS | Intentionally hardcoded with `// TODO` comments |
| StreaksCard hardcoded | ✅ PASS | Intentionally hardcoded with `// TODO` comments |
| QuickMatchCard "124 jugadores en cola" | ℹ️ INFO | Still hardcoded (expected — no data source for this yet) |
| QuickMatchCard "~15 segundos" | ℹ️ INFO | Still hardcoded (expected — requires real-time presence data) |

**Verdict**: ✅ PASS

### R4: Sidebar Connected to Real User Data

| Criterion | Result | Evidence |
|-----------|--------|----------|
| layout.tsx is async server component | ✅ PASS | Line 23: `export default async function DashboardLayout()` |
| Fetches auth user | ✅ PASS | Line 25: `supabase.auth.getUser()` |
| Fetches profile from Supabase | ✅ PASS | Lines 29-34: profiles query |
| No "JugadorDemo" | ✅ PASS | Not present anywhere in file |
| Shows real username | ✅ PASS | Line 96: `{profile?.username ?? "Invitado"}` |
| Shows ELO | ✅ PASS | Line 99: `{profile?.elo?.toLocaleString("es-AR") ?? "—"}` |
| Shows coins | ✅ PASS | Line 104: `{profile?.coins ?? 0}` |
| Links to profile page | ✅ PASS | Line 77: `href={\`/profile/${profile?.username ?? ""}\`}` |
| Handles unauthenticated state | ✅ PASS | Shows "Invitado" fallback |

**Verdict**: ✅ PASS

### R5: Data Sources for Each Section

| Query | Design Pattern | Actual | Result |
|-------|---------------|--------|--------|
| Profile | `maybeSingle()` | `.single()` | ⚠️ WARNING: `.single()` throws on no match (caught by Promise.allSettled) |
| Leaderboard | Select `username, elo, avatar_url, rank` | Select `id, username, avatar_url, elo`, rank computed as `i+1` | ℹ️ INFO: Position-based rank is arguably better |
| Friends | `.or(requester_id.eq.{uid},addressee_id.eq.{uid})` with `.eq('status', 'accepted')` | Only `.eq('status', 'accepted')` — **no user filter!** | 🔴 ISSUE: Fetches ALL accepted friendships, not just current user's. Inefficient — could return all rows. |
| Tournaments | `.in('status', ['registration', 'in_progress']).order('starts_at').limit(4)` | `.in('status', ['registration', 'in_progress'])` — no `.order()` or `.limit(4)` | ⚠️ WARNING: Missing `.order()` and `.limit()` |
| User rank | Design queries `profiles.rank` directly | Uses RPC `supabase.rpc("get_rank", ...)` | ℹ️ INFO: Alternative approach, works correctly |

**Verdict**: ⚠️ WARNINGS (friends query missing user filter is the most significant)

### R6: Empty States for Friends/Tournaments

| Section | Text | Link | Result |
|---------|------|------|--------|
| Friends | "No hay amigos conectados" | `/users/search` "Buscar jugadores" | ✅ PASS |
| Tournaments | "No hay torneos activos" | `/tournaments` "Ver torneos" | ✅ PASS |
| Leaderboard | "Aún no hay jugadores en el ranking" | N/A | ✅ PASS |

**Verdict**: ✅ PASS

### R7: Error Handling Graceful Per Section

| Mechanism | Result | Evidence |
|-----------|--------|----------|
| `Promise.allSettled` used | ✅ PASS | Line 393 |
| Per-result status checking | ✅ PASS | Lines 414-457: each result checked individually |
| Fallback on failure | ✅ PASS | Each falls back to empty array/null |
| One failure doesn't block others | ✅ PASS | Promise.allSettled semantics guarantees this |

**Verdict**: ✅ PASS

---

## Detailed Findings

### 🔴 CRITICAL Issues

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | **Metadata title mismatch**: Spec requires `"Lobby — Dominó Occidental"`, code has `"Inicio — Dominó Occidental"` | page.tsx:6-8 | Spec compliance. The title is visible in the browser tab and affects SEO. |

### ⚠️ WARNINGS

| # | Issue | File | Impact |
|---|-------|------|--------|
| W1 | **Friends query does not filter by current user**: Uses only `.eq("status", "accepted")` without `.or(requester_id.eq.{uid},addressee_id.eq.{uid})` — fetches ALL accepted friendships across all users | page.tsx:405-407 | Performance: grows with total user base. Security: conceptually leaks data (mitigated by RLS) |
| W2 | **Friends query missing `.order()` and `.limit()` on tournaments**: Sets no limit, no ordering | page.tsx:408-411 | Minor: could return many tournaments — though unlikely in practice for `registration`/`in_progress` status |
| W3 | **Profile query uses `.single()` instead of `.maybeSingle()`**: Will throw `PGRST116` if no profile found (caught by Promise.allSettled) | page.tsx:398 | Works in practice but deviates from design pattern |
| W4 | **Sub-component props use inline types instead of `FriendEntry[]`/`TournamentEntry[]`**: New interfaces defined but unused | page.tsx:143-146, 211-219 | Design contract deviation. Types defined in types.ts but not consumed. |

### ℹ️ INFO / Suggestions

| # | Item | Detail |
|---|-------|--------|
| S1 | QuickMatchCard "124 jugadores" is hardcoded | Expected — no data source available yet |
| S2 | Non-functional `<button>Retar</button>` in FriendsOnlineCard | Renders but does nothing in server component |
| S3 | Leaderboard rank computed positionally (i+1) rather than from DB | Actually better — avoids stale rank column issues |

---

## Files Changed

| File | Lines | Status | Role |
|------|-------|--------|------|
| `packages/frontend/src/lib/api/types.ts` | 56 | ✅ | New interfaces: FriendEntry, TournamentEntry, LobbyData |
| `packages/frontend/src/app/(dashboard)/lobby/page.tsx` | 481 | ✅ | Full rewrite as async server component + 8 sub-components |
| `packages/frontend/src/app/(dashboard)/layout.tsx` | 192 | ✅ | Made async, real profile data in sidebar |

---

## Recommendations Before Merge

### Must Fix (Spec Compliance)
1. **Fix metadata title**: Change line 7 from `"Inicio — Dominó Occidental"` to `"Lobby — Dominó Occidental"`

### Should Fix (Design Compliance)
2. **Fix friends query**: Add `.or(\`requester_id.eq.${user.id},addressee_id.eq.${user.id}\`)` filter to the friendships query
3. **Add `.order('starts_at', { ascending: true }).limit(4)` to the tournaments query**

### Nice to Fix
4. **Use defined interfaces**: Update `FriendsOnlineCard` to use `FriendEntry[]` and `TournamentsCard` to use `TournamentEntry[]` props instead of inline types
5. **Change `.single()` to `.maybeSingle()`** on the profile query (minor, but correct)

---

## Overall Verdict

```
Status: PASS (with WARNINGS)

Checks:
  R1 (Server Component):     ⚠️ Minor — metadata title mismatch
  R2 (8 Sub-Components):     ⚠️ Minor — inline types instead of interfaces
  R3 (Hardcoded data):       ✅ PASS
  R4 (Sidebar refactor):     ✅ PASS
  R5 (Data sources):         ⚠️ Medium — friends query missing user filter
  R6 (Empty states):         ✅ PASS
  R7 (Error handling):       ✅ PASS

Next: fixes-required — 1 critical (title), 2 warnings (friends query filter, tournaments sort/limit)
```
