# Proposal: Profile Edit — Conectar a Supabase

## Intent

Replace static DEMO_PROFILE data in edit and view pages with real Supabase-backed data. Add avatar upload via Storage, country field, unique username enforcement, and public profile viewing (authenticated users can read any profile).

## Scope

### In Scope
- SQL migration: add `country CHAR(2)` column, unique index on `username`, RLS policy for public SELECT (authenticated → any profile)
- Supabase Storage bucket `avatars` (public, for profile pictures)
- Server action `updateProfile` — validates username (3–20 alphanumeric) and country (ISO), handles PG unique violation → friendly error
- Server action `uploadAvatar` — uploads file to avatars bucket, updates `avatar_url`
- Edit page: hybrid Server Component (loads profile from Supabase) + client form (`useActionState` with `updateProfile`)
- View page: dynamic Server Component, queries profiles by username from URL param, 404 if not found, stats show defaults (0 played, 1200 ELO)
- Back link → `/profile/{username}` of authenticated user
- Remove showElo/notifications toggles from edit form

### Out of Scope
- `player_stats` (materialized view doesn't exist yet)
- Debounced username uniqueness check (post-submit only)
- Achievements / recent matches on view page (deferred)
- Friend request button functionality (visual only)

## Capabilities

### New Capabilities
- `profile-edit-page`: Edit profile form with server actions (updateProfile, uploadAvatar), avatar upload via Storage, validated username + country inputs

### Modified Capabilities
- `user-auth`: profiles table gains `country` column + unique username index; RLS expands from "view own" to "authenticated users can view any profile"

## Approach

1. **SQL migration** — add `country`, unique index on username, replace self-only SELECT policy with authenticated-read-all
2. **Storage** — create `avatars` bucket (public) via Supabase seed/UI
3. **Server action `updateProfile`** — server-validate inputs, `supabase.from('profiles').update()`, catch PG unique violation → return `{ error: "Usuario ya registrado" }`, `revalidatePath`, `redirect`
4. **Server action `uploadAvatar`** — `supabase.storage.from('avatars').upload()`, update `avatar_url` on profiles row
5. **Edit page** — Server Component fetches profile (createClient → getUser → query profiles), passes to client form; form uses `useActionState` with `updateProfile`; hidden file input triggers `uploadAvatar` on selection
6. **View page** — dynamic SC, `supabase.from('profiles').select('*').eq('username', params.username).single()`, 404 `notFound()` if null; stats grid shows hardcoded defaults

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/<timestamp>_profile_edit.sql` | New | Add country, unique username, public SELECT RLS |
| `packages/frontend/src/app/(dashboard)/profile/edit/page.tsx` | Modified | From static client form → hybrid SC + client with server actions |
| `packages/frontend/src/app/(dashboard)/profile/[username]/page.tsx` | Modified | From force-static DEMO → dynamic Supabase query, 404 handling |
| `packages/frontend/src/lib/actions/profile.ts` | New | Server actions: updateProfile, uploadAvatar |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Username unique violation unhandled | Low | Catch PG error code 23505 in server action, return user-friendly message |
| Avatar bucket not created in production | Med | Document as setup step; add Supabase seed migration script |
| RLS public read leaks data | Low | Policy scoped to authenticated users only, no mass-list endpoint |

## Rollback Plan

1. Drop migration: `ALTER TABLE profiles DROP COLUMN country`, `DROP INDEX profiles_username_key`, revert RLS policy
2. Delete avatars bucket via Supabase dashboard
3. `git checkout` on both page.tsx files to restore DEMO_PROFILE versions

## Dependencies

- Existing auth middleware (`proxy.ts`) — pages are already auth-gated
- Existing `createClient()` from `@/lib/supabase/server`
- Existing supabase migrations pattern

## Success Criteria

- [ ] Edit form loads authenticated user's real data (username, country, avatar)
- [ ] Username update succeeds (new value) and rejects duplicates (inline error)
- [ ] Country update persists to profiles.country
- [ ] Avatar upload creates file in avatars bucket and updates avatar_url
- [ ] View page at `/profile/{username}` shows real data, returns 404 for unknown users
- [ ] `bun run build` passes in frontend package
