# Tasks: Profile Edit — Conectar a Supabase

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~670 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Foundation (migration + validation + tests) → PR 2: Server actions + edit page → PR 3: View page + 404 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DB migration + validation functions + unit tests | PR 1 | base = feature/profile-edit; pure foundation, no UI dependencies |
| 2 | Server actions + edit page rewrite | PR 2 | base = PR 1 branch; depends on Unit 1 for validation |
| 3 | Dynamic view page + custom 404 | PR 3 | base = PR 2 branch; depends on Unit 2 for profile query pattern |

---

## Phase 1: Foundation — Migration & Validation

- [x] 1.1 Create `supabase/migrations/20260709_profile_edit.sql`: add `country CHAR(2)` column, `CREATE UNIQUE INDEX idx_profiles_username ON profiles(username)`, add public SELECT RLS policy for authenticated users, keep existing own-UPDATE policy
- [x] 1.2 Create `packages/frontend/src/lib/profile-validation.ts`: extract COUNTRIES array from edit page, export `validateProfileFields({ username, country })`, `validateCountry(code)`, `getInitials(name)`, and `COUNTRIES` constant. Follow `auth-validation.ts` pattern (pure functions, no side effects)
- [x] 1.3 RED: Create `packages/frontend/src/lib/actions/__tests__/profile-validation.test.ts` — write failing tests for `validateProfileFields` (username too short, invalid chars, valid input), `validateCountry` (valid/invalid codes), `getInitials` (normal name, empty, single char)
- [x] 1.4 GREEN: Make profile-validation tests pass by implementing functions in `profile-validation.ts`

## Phase 2: Server Actions & Edit Page

- [x] 2.1 Create `packages/frontend/src/lib/actions/profile.ts`: `"use server"` — `updateProfile(prevState, formData)` using useActionState pattern from auth.ts. Validate with `validateProfileFields`, call `supabase.from('profiles').update(...)`, catch PG 23505 (username collision), `revalidatePath`, `redirect(/profile/{username})`. Export `ProfileState` type
- [x] 2.2 Add `uploadAvatar(formData)` server action in same file: validate file type (image/jpeg, image/png), validate size (2MB max), upload to Supabase Storage `avatars` bucket, return `{ avatarUrl }` or `{ error }`. Use `createClient()` from `@/lib/supabase/server`
- [x] 2.3 Create `packages/frontend/src/app/(dashboard)/profile/edit/EditProfileForm.tsx`: client component `"use client"`. Accept `profile` prop (username, country, avatar_url). Use `useActionState` with `updateProfile` for form submission. Use `useTransition` for avatar upload on file onChange. Reuse existing UI sections (avatar, username, country) from current edit page. Show validation errors inline. Disable submit while pending
- [x] 2.4 Rewrite `packages/frontend/src/app/(dashboard)/profile/edit/page.tsx`: remove `"use client"`, make hybrid Server Component. Fetch profile via `createClient()` → `supabase.from('profiles').select(...)`. Redirect to `/login` if no session. Pass profile as prop to `EditProfileForm`. Add `metadata` export for page title

## Phase 3: View Page & 404

- [x] 3.1 Rewrite `packages/frontend/src/app/(dashboard)/profile/[username]/page.tsx`: remove `force-static` and `generateStaticParams`. Query profile by username from URL params. Call `notFound()` if no row. Display real data (username, avatar_url or initials, country, created_at). Stats section defaults to 0 played / 1200 ELO if no match history
- [x] 3.2 Create `packages/frontend/src/app/(dashboard)/profile/not-found.tsx`: custom 404 page matching domino-900 theme. Message: "Perfil no encontrado". Link back to lobby

## Phase 4: Integration Verification

- [x] 4.1 Verify: `bun test` passes for profile-validation.test.ts
- [x] 4.2 Verify: `bun run biome:check` passes (lint + format)
- [x] 4.3 Manual smoke test: edit page loads real profile data, form submits, redirects to /profile/{username}, view page shows updated data
- [x] 4.4 Verify RLS: authenticated user can SELECT any profile; unauthenticated cannot
