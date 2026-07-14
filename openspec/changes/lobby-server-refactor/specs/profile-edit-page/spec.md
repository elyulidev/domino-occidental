# Delta for profile-edit-page

## ADDED Requirements

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
