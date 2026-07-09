# Tasks: Auth Setup

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550–700 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Local Supabase + env + SSR client files + proxy.ts + callback | PR 1 | Base: feature/auth-setup branch. ~280 lines. |
| 2 | Auth forms (Server Actions + components) + profiles migration | PR 2 | Base: PR 1 branch. ~320 lines. Depends on PR 1. |

## Phase 1: Local Supabase + Environment

- [x] 1.1 Modify `supabase/config.toml` — enable `[auth.external.google]`, set `site_url`, `additional_redirect_urls`, enable email confirmations
- [x] 1.2 Create `supabase/migrations/.gitkeep` — migration directory placeholder
- [x] 1.3 Create `supabase/seed.sql` — empty file (required by config.toml)
- [x] 1.4 Create `packages/frontend/.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Google OAuth env vars

## Phase 2: Supabase SSR Client + Proxy + Callback

- [x] 2.1 Run `bun add @supabase/ssr @supabase/supabase-js` in `packages/frontend`
- [x] 2.2 Create `packages/frontend/src/lib/supabase/client.ts` — browser client with `'use client'`, `createBrowserClient()` using `getAll`/`setAll` cookie API
- [x] 2.3 Create `packages/frontend/src/lib/supabase/server.ts` — server client with async `cookies()`, `createServerClient()`
- [x] 2.4 Create `packages/frontend/src/app/auth/callback/route.ts` — OAuth callback: extract `code`, `exchangeCodeForSession`, redirect to `/dashboard` on success, `/auth/error` on failure
- [x] 2.5 Create `packages/frontend/src/proxy.ts` — export `proxy()` and `proxyConfig`. Use `getUser()` (not `getSession()`). Protect `(dashboard)` + `(game)`, allow `(auth)` + `/auth/*`. Refresh cookies on every request.
- [x] 2.6 Verify: `bun run build` passes with new proxy and client files

## Phase 3: Auth Server Actions + Form Components

- [x] 3.1 Create `packages/frontend/src/app/actions/auth.ts` — Server Actions: `signUp` (username in `raw_user_meta_data`), `signIn` (redirect on success), `signOut` (revalidatePath + redirect)
- [x] 3.2 Create `packages/frontend/src/components/auth/login-form.tsx` — client form: email + password fields, submit calls `signIn`, Google OAuth button calls `signInWithOAuth({ provider: 'google' })`
- [x] 3.3 Create `packages/frontend/src/components/auth/register-form.tsx` — client form: username + email + password + confirm-password, submit calls `signUp`, Google OAuth button, error/message display
- [x] 3.4 Modify `packages/frontend/src/app/(auth)/login/page.tsx` — render `<LoginForm />`, remove GitHub button
- [x] 3.5 Modify `packages/frontend/src/app/(auth)/register/page.tsx` — render `<RegisterForm />`, remove GitHub button

## Phase 4: Profiles Table Migration

- [x] 4.1 Create `supabase/migrations/20260707_create_profiles.sql` — DDL: `profiles(id FK→auth.users, username, avatar_url, created_at, updated_at)`, `handle_new_user()` trigger, RLS policies (SELECT/UPDATE own profile)
- [x] 4.2 Create `packages/backend/src/db/schema/profiles.ts` — Drizzle schema mirroring migration (deferred typed queries, schema only for now)

## Phase 5: Verification

- [x] 5.1 Test: register via email/password → confirm in Inbucket → login → session persists across refresh
- [x] 5.2 Test: Google OAuth → callback → redirect to /dashboard → profile row created
- [x] 5.3 Test: unauthenticated access to /lobby → redirected to /login?next=%2Flobby
- [x] 5.4 Test: `bun run biome:check` passes on all new/modified files
