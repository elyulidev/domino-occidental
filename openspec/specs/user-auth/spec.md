# user-auth Specification

## Purpose

Authenticate users in Dominó Occidental via email/password and Google OAuth, manage sessions, protect routes, and auto-create profiles on signup. Built on Supabase Auth with `@supabase/ssr` for the Next.js 16 App Router.

## Requirements

### Requirement: AUTH-ENV — Local Supabase with Google OAuth

The development environment MUST run Supabase locally via CLI. Google OAuth MUST be enabled in `config.toml` with `site_url` and `additional_redirect_urls` pointing to the dev origin. Email verification MUST use Inbucket (bundled with `supabase start`).

#### Scenario: Full local stack starts

- GIVEN Docker (WSL2) is running
- WHEN `supabase start` completes
- THEN Supabase services (Auth, DB, Inbucket) are available at local URLs
- AND `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Scenario: Email confirmation via Inbucket

- GIVEN a user registered with email+password
- WHEN they check Inbucket at `localhost:54324`
- THEN the confirmation email is visible and clickable

### Requirement: AUTH-CLIENT — Supabase SSR client helpers

The frontend MUST provide three client factories via `@supabase/ssr`: browser client (`'use client'`), server client (`cookies()` from `next/headers`), and an auth callback route at `/auth/callback/route.ts` that exchanges the OAuth code for a session. The callback MUST use `createServerClient` and redirect to `/` on success, `/auth/error` on failure.

#### Scenario: OAuth callback success

- GIVEN Google redirects to `/auth/callback?code=...`
- WHEN `exchangeCodeForSession` succeeds
- THEN the user is redirected to the dashboard

#### Scenario: OAuth callback failure

- GIVEN the `code` param is missing or invalid
- WHEN `exchangeCodeForSession` fails
- THEN redirect to `/auth/error`

### Requirement: AUTH-REGISTER — Email/password registration

A Server Action at `app/actions/auth.ts` MUST call `supabase.auth.signUp` with email, password, and username in `options.data.raw_user_meta_data`. The client form MUST send username, email, password, and confirm-password. On success the user sees a confirmation message; on error the form displays the error inline.

#### Scenario: Successful registration

- GIVEN the user fills username, email, password, confirm-password
- WHEN they submit the register form
- THEN `auth.signUp` is called with `raw_user_meta_data: { username }`
- AND a confirmation message is shown ("Revisá tu correo")

#### Scenario: Duplicate email

- GIVEN an email already registered
- WHEN the user submits the same email
- THEN the action returns `{ error: "El correo ya está registrado" }`
- AND the form displays the error

### Requirement: AUTH-LOGIN — Email/password sign-in

A Server Action MUST call `supabase.auth.signInWithPassword`. On success it redirects to `/dashboard`. On error it returns the error to the form.

#### Scenario: Valid credentials

- GIVEN the user has a verified account
- WHEN they submit valid email + password
- THEN `signInWithPassword` succeeds
- AND the user is redirected to `/dashboard`

#### Scenario: Invalid credentials

- GIVEN an incorrect password for an existing email
- WHEN the user submits the form
- THEN the action returns `{ error: "Credenciales inválidas" }`
- AND the form displays the error without redirecting

### Requirement: AUTH-OAUTH — Google OAuth sign-in

The login and register pages MUST provide a "Google" button that calls `supabase.auth.signInWithOAuth({ provider: 'google' })`. The redirectTo MUST derive from `origin` (not hardcoded). No GitHub button SHALL be present in the final UI.

#### Scenario: Google sign-in flow

- GIVEN the user clicks "Google" on the login page
- WHEN `signInWithOAuth({ provider: 'google' })` is called
- THEN the browser redirects to Google's consent screen
- AND after consent, Google redirects to `/auth/callback`
- AND the callback exchanges the code for a session and redirects to `/dashboard`

### Requirement: AUTH-PROXY — Route protection via proxy.ts

A `proxy.ts` file at the frontend root MUST export a `proxy()` function and `proxyConfig`. It MUST call `getUser()` (not `getSession()`) to verify authentication. Protected route groups (`(dashboard)`, `(game)`) MUST redirect to `/login` when unauthenticated. The `(auth)` group and `/auth/callback` MUST be publicly accessible.

#### Scenario: Authenticated user navigates to dashboard

- GIVEN the user has a valid session cookie
- WHEN they visit `/dashboard`
- THEN `proxy()` calls `getUser()` which returns the user
- AND the request passes through to the page

#### Scenario: Unauthenticated user navigates to dashboard

- GIVEN the user has NO session cookie
- WHEN they visit `/dashboard`
- THEN `getUser()` returns `{ user: null }`
- AND the proxy redirects to `/login`
- AND the original URL is preserved as a `?next=` param

#### Scenario: Unauthenticated user visits login page

- GIVEN the user has NO session cookie
- WHEN they visit `/login` or `/register`
- THEN the proxy allows the request through (no redirect)

### Requirement: AUTH-PROFILE — Profiles table with auto-creation

A migration SHALL create table `profiles(id UUID PK FK → auth.users, username TEXT, avatar_url TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)`. A trigger `on_auth_user_created` on `auth.users` SHALL INSERT a row into `profiles` with `id = NEW.id` and `username` from `raw_user_meta_data->>'username'`. RLS SHALL be enabled: SELECT and UPDATE for own profile only.

#### Scenario: Profile created on signup

- GIVEN a new user signs up via email/password
- WHEN `auth.users` gets a new row
- THEN the trigger fires and inserts into `profiles(id, username, created_at, updated_at)
- AND the username matches `raw_user_meta_data.username`

#### Scenario: Profile created on Google OAuth

- GIVEN a user signs up via Google
- WHEN `auth.users` gets a new row
- THEN the trigger inserts a profile row
- AND `username` is derived from `raw_user_meta_data.name` (Google display name)

### Requirement: AUTH-LOGOUT — Sign-out

A Server Action MUST call `supabase.auth.signOut()`, revalidate the layout cache with `revalidatePath('/', 'layout')`, and redirect to `/`.

#### Scenario: User signs out

- GIVEN the user is authenticated
- WHEN they trigger sign-out
- THEN the session is destroyed
- AND the user is redirected to `/`
- AND accessing `/dashboard` after logout redirects to `/login`

### Requirement: AUTH-ERRORS — Error states

The system MUST handle these error states with user-visible feedback: network failure (retry message), expired session (silent refresh via proxy or redirect to login), rate limiting (429 — wait message), and email not confirmed (resend prompt).

#### Scenario: Session expired during navigation

- GIVEN the user's session token has expired
- WHEN they navigate to a new page
- THEN `proxy.ts` attempts a silent refresh via `getUser()`
- AND if refresh fails, redirects to `/login`

#### Scenario: Email not confirmed

- GIVEN the user registered but hasn't confirmed their email
- WHEN they try to sign in
- THEN `signInWithPassword` returns an `email_not_confirmed` error
- AND the form shows a resend confirmation prompt

## Schema

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can view own profile"
  on public.profiles for select
  to authenticated
  using ( (select auth.uid()) = id );

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', new.raw_user_meta_data ->> 'name', 'user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

## API Changes

No new REST endpoints. Auth is handled entirely through Supabase Auth (client-side `@supabase/ssr`) and Next.js Server Actions.

| Action | Mechanism | File |
|--------|-----------|------|
| signUp | Server Action → `supabase.auth.signUp` | `app/actions/auth.ts` |
| signIn | Server Action → `supabase.auth.signInWithPassword` | `app/actions/auth.ts` |
| signOut | Server Action → `supabase.auth.signOut` | `app/actions/auth.ts` |
| OAuth | Client → `supabase.auth.signInWithOAuth` | Login/Register page components |
| Callback | Route Handler → `supabase.auth.exchangeCodeForSession` | `app/auth/callback/route.ts` |
| Session refresh | `proxy.ts` → `supabase.auth.getUser()` | `proxy.ts` |

## Security Constraints

1. **All `profiles` queries go through RLS** — no bypass except the trigger function (which is `security definer` scoped to profile creation only)
2. **`getUser()` everywhere** — never `getSession()` for auth checks; `getSession()` doesn't verify the JWT
3. **No `service_role` key on the client** — `NEXT_PUBLIC_*` vars are anon key only
4. **OAuth redirect URL derived from `origin`** — never hardcoded; prevents redirect mismatch across environments
5. **No GitHub OAuth** — only Google (per proposal scope)

## Test Scenarios

| Test | Type | Coverage |
|------|------|----------|
| Register new user → confirm email → login | Integration | Auth flow |
| Sign in with wrong password returns error | Unit | Error handling |
| Google OAuth callback exchanges code | Integration | OAuth flow |
| Unauthenticated request to `/dashboard` redirects | Integration | Route protection |
| Authenticated request to `/dashboard` passes through | Integration | Route protection |
| Session cookie persists across page navigation | Integration | Session lifecycle |
| Sign-out clears session and redirects | Integration | Logout flow |
| Profiles row created on auth.users insert | Integration (DB) | Trigger |
| RLS prevents reading another user's profile | Integration (DB) | Security |
| Drizzle schema matches migration DDL | Unit | Schema sync |

## Files To Create

- `packages/frontend/lib/supabase/client.ts` — browser client
- `packages/frontend/lib/supabase/server.ts` — server client
- `packages/frontend/app/auth/callback/route.ts` — OAuth callback handler
- `packages/frontend/app/actions/auth.ts` — Server Actions
- `packages/frontend/proxy.ts` — route protection (Next.js 16)
- `packages/frontend/supabase/migrations/<timestamp>_create_profiles.sql` — migration
- `packages/backend/src/db/schema/profiles.ts` — Drizzle schema
- `.env.local` — Supabase env vars
