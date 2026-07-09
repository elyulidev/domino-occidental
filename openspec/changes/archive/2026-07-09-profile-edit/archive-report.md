# Archive Report: profile-edit

**Change**: profile-edit
**Date**: 2026-07-09
**Status**: COMPLETED

## Goal

Replace static DEMO_PROFILE data in edit and view pages with real Supabase-backed data. Add avatar upload via Storage, country field, unique username enforcement, and public profile viewing (authenticated users can read any profile).

## What Was Implemented

### SQL Migration
- Added `country CHAR(2)` column to `profiles` table
- Created unique index `idx_profiles_username` on `username`
- Added public SELECT RLS policy for authenticated users (allow reading any profile)
- Preserved existing own-UPDATE policy

### Server Actions
- `updateProfile`: validates username (3–20 alphanumeric) and country (ISO), handles PG unique violation → friendly error, revalidates path and redirects
- `uploadAvatar`: validates file type (image/jpeg, image/png) and size (2MB max), uploads to Supabase Storage `avatars` bucket, updates `avatar_url`

### Edit Page (`/profile/edit`)
- Hybrid Server Component: fetches profile via `createClient()` → `supabase.from('profiles').select(...)`
- Client form `EditProfileForm.tsx`: uses `useActionState` with `updateProfile`, `useTransition` for avatar upload
- Avatar upload with preview, username validation, country select (16 ISO codes)
- Form disables submit while pending, shows validation errors inline

### View Page (`/profile/[username]`)
- Dynamic Server Component: queries profiles by username from URL params
- 404 handling via `notFound()` when profile not found
- Displays real data: username, avatar or initials, country, member since date
- Stats section with defaults (0 played / 1200 ELO)
- "Editar perfil" button shown only on own profile

### Custom 404 Page
- Created `not-found.tsx` with domino-900 theme
- Message: "Perfil no encontrado" with link back to lobby

### Validation & Testing
- Pure validation functions extracted to `profile-validation.ts` for testability
- 44/44 profile tests passing (unit tests for validation, actions, view)
- TDD approach: RED → GREEN → REFACTOR

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260709_profile_edit.sql` | Created | DB migration: country, unique username, RLS |
| `packages/frontend/src/lib/profile-validation.ts` | Created | Pure validation functions |
| `packages/frontend/src/lib/actions/profile.ts` | Created | Server actions: updateProfile, uploadAvatar |
| `packages/frontend/src/lib/actions/__tests__/profile-validation.test.ts` | Created | Unit tests for validation |
| `packages/frontend/src/lib/actions/__tests__/profile-actions.test.ts` | Created | Unit tests for server actions |
| `packages/frontend/src/lib/actions/__tests__/profile-view.test.ts` | Created | Unit tests for view utilities |
| `packages/frontend/src/app/(dashboard)/profile/edit/page.tsx` | Rewritten | Hybrid SC with real Supabase data |
| `packages/frontend/src/app/(dashboard)/profile/edit/EditProfileForm.tsx` | Created | Client form component |
| `packages/frontend/src/app/(dashboard)/profile/[username]/page.tsx` | Rewritten | Dynamic SC with real Supabase query |
| `packages/frontend/src/app/(dashboard)/profile/not-found.tsx` | Created | Custom 404 page |

## Test Results

- **Profile validation tests**: 44/44 passing ✅
- **Build**: Clean build, 19 routes ✅
- **Lint**: `bun run biome:check` passes ✅

## Known Issues

- **Pre-existing**: `login-form.test.tsx` has 5 failing tests (not related to profile-edit change)
- **Deferred**: `player_stats` materialized view doesn't exist yet (stats show defaults)
- **Deferred**: Debounced username uniqueness check (post-submit only for now)

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `profile-edit-page` | Created | New spec synced to `openspec/specs/profile-edit-page/spec.md` |

## Archive Contents

- proposal.md ✅
- specs/profile-edit-page/spec.md ✅
- design.md ✅
- tasks.md ✅ (15/15 tasks complete)

## Source of Truth Updated

The following spec now reflects the new behavior:
- `openspec/specs/profile-edit-page/spec.md`

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
Ready for the next change.
