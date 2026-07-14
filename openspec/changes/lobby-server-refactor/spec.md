# Delta for lobby-server-refactor

## New Capability: lobby-server-fetch

### Requirement: Lobby Page Server Component

The lobby page (`/lobby`) MUST be an async server component. The `"use client"` directive MUST be removed. The page MUST export a `metadata` object with the title "Lobby — Dominó Occidental". All data fetching MUST use `createClient()` from `@/lib/supabase/server`.

#### Scenario: Page renders as server component

- GIVEN an authenticated user navigates to `/lobby`
- WHEN the page renders
- THEN it SHALL fetch profile data (username, elo, coins) from Supabase `profiles` table
- AND the HTML `<title>` SHALL be "Lobby — Dominó Occidental"
- AND the component SHALL NOT contain `"use client"`, `useState`, or `useEffect`

#### Scenario: No browser-side data fetching

- GIVEN the page loads
- WHEN inspecting network requests during render
- THEN no `apiFetch` or `createBrowserClient` calls SHALL originate from the page

### Requirement: Parallel Data Fetching

The page MUST use `Promise.all` to execute all Supabase queries in parallel. Each query MUST be wrapped in try/catch returning a fallback value on failure, so one failing query does not break the entire page.

#### Scenario: All queries succeed

- GIVEN the user loads the lobby
- WHEN Supabase queries execute via `Promise.all`
- THEN all sections SHALL render with real data in parallel

#### Scenario: Single query fails gracefully

- GIVEN the friends query throws a Supabase error
- WHEN the lobby renders
- THEN the friends section SHALL display "No se pudo cargar"
- AND all other sections SHALL render normally with their real data

### Requirement: Sub-Components as Props-Driven Functions

The system MUST define 8 sub-components as pure functions in `page.tsx`: `WelcomeHeader`, `QuickMatchCard`, `Leaderboard`, `FriendsOnline`, `Tournaments`, `StatsCard`, `StreaksCard`, `PremiumUpsell`. Each MUST receive typed props. No sub-component SHALL use `useState`, `useEffect`, or other client hooks.

#### Scenario: Sub-components receive data via props

- GIVEN the page fetches data from Supabase
- WHEN sub-components render
- THEN each SHALL receive its data exclusively through props
- AND `QuickMatchButton` SHALL remain the only client component import

### Requirement: Leaderboard Top 10

The system MUST query `profiles` for the top 10 users ordered by `elo` DESC, selecting `username` and `elo`.

#### Scenario: Leaderboard displays ranked users

- GIVEN multiple users exist with different ELO scores
- WHEN the leaderboard renders
- THEN it SHALL display up to 10 users ordered by ELO descending
- AND each entry SHALL show username and ELO value

### Requirement: Friends Online Data

The system MUST query `friendships` WHERE `status = 'accepted'` AND the current user is either `requester_id` or `addressee_id`. When no friendships exist, the section MUST display an empty state with "No hay amigos conectados" and a link to `/users/search`.

#### Scenario: User has accepted friendships

- GIVEN the user has accepted friendships
- WHEN the friends section renders
- THEN it SHALL display the list of friends

#### Scenario: No friendships — empty state

- GIVEN the user has no accepted friendships
- WHEN the friends section renders
- THEN it SHALL display "No hay amigos conectados"
- AND it SHALL include a link to `/users/search`

### Requirement: Active Tournaments Data

The system MUST query `tournaments` WHERE `status IN ('registration', 'in_progress')`, limited to 4 results. When no tournaments exist, the section MUST display "No hay torneos activos" with a link to `/tournaments`.

#### Scenario: Active tournaments exist

- GIVEN tournaments exist in registration or in_progress status
- WHEN the tournaments section renders
- THEN it SHALL display up to 4 active tournaments

#### Scenario: No active tournaments — empty state

- GIVEN no tournaments are in registration or in_progress status
- WHEN the tournaments section renders
- THEN it SHALL display "No hay torneos activos"
- AND it SHALL include a link to `/tournaments`

### Requirement: Hardcoded Stats and Streaks Placeholders

`StatsCard` and `StreaksCard` MUST display hardcoded placeholder values with `// TODO: wire to match_moves when schema exists` comments. No Supabase queries SHALL be made for these sections.

#### Scenario: Placeholder values render

- GIVEN the lobby loads
- WHEN StatsCard and StreaksCard render
- THEN they SHALL display hardcoded values (e.g., 3 wins / 2 losses / 1 streak)
- AND each SHALL contain a TODO comment referencing `match_moves`

---

## Modified Capability: profile-edit-page

### Requirement: Dashboard Sidebar User Footer

The dashboard layout (`layout.tsx`) MUST be an async server component that fetches the authenticated user's profile via `createClient()` from `@/lib/supabase/server`. The sidebar footer MUST display real user data (username, ELO, coins) and link to the user's profile page. Hardcoded placeholder data ("JugadorDemo") MUST be removed.

#### Scenario: Sidebar shows real authenticated user

- GIVEN an authenticated user views any dashboard page
- WHEN the sidebar footer renders
- THEN it SHALL display the user's real username, ELO score, and coins
- AND the username SHALL link to `/profile/[username]`

#### Scenario: No hardcoded placeholder data

- GIVEN the sidebar renders
- WHEN inspecting the component source
- THEN it SHALL NOT contain "JugadorDemo" or any hardcoded user object
