# Proposal: Auth Setup

## Intent

Wire Supabase Auth into the Dominó Occidental frontend — login, register, Google OAuth, session management, route protection, and profiles table. Without this, every downstream feature (matches, friends, tournaments, ELO, monetization) has no user identity layer.

## Scope

### In Scope
- Local Supabase running with Inbucket email testing
- Google OAuth enabled
- `@supabase/ssr` client files (browser, server)
- Auth UI wired to Supabase (login, register, OAuth callback)
- Route protection via `proxy.ts` (Next.js 16)
- Profiles table migration + auth trigger

### Out of Scope
- OAuth beyond Google (GitHub, Discord)
- Password reset flow
- Email template customization
- RBAC / admin roles
- Auth on Elysia backend (future phase)

## Capabilities

### New Capabilities
- `user-auth`: Supabase Auth — email/password + Google OAuth, session lifecycle, profile creation

### Modified Capabilities
None — no existing spec behavior changes.

## Approach

`@supabase/ssr` for client and server auth helpers. Server Actions for form mutations. `proxy.ts` (Next.js 16 middleware rename) for session refresh + route protection. OAuth callback at `auth/callback/route.ts`. Profiles table via Supabase migration with `on_auth_user_created` trigger. Username stored in `raw_user_meta_data`.

## Phases

| # | Phase | Deliverables |
|---|-------|-------------|
| 1 | Local Supabase + Env | `supabase start`, Google OAuth in config.toml, Inbucket, `.env.local` |
| 2 | Client Files | Install `@supabase/ssr`, `client.ts`, `server.ts`, `proxy.ts`, `auth/callback/route.ts` |
| 3 | Auth UI | Server actions (signUp, signIn, signOut), wire login + register forms, Google OAuth button |
| 4 | Route Protection | `proxy.ts` matcher — protect `(dashboard)` + `(game)`, allow `(auth)` + `auth/callback`. Use `getUser()` not `getSession()` |
| 5 | Profiles Table | Migration: `profiles(id, username, avatar_url, created_at, updated_at)`. Trigger: `on_auth_user_created → INSERT`. Drizzle schema in backend |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `getUser()` vs `getSession()` misuse | Med | Enforce via skill validation + proxy pattern |
| OAuth redirect URL mismatch | Low | Configure `site_url` + `additional_redirect_urls` |
| `cookies()` async in Next.js 15+ | Low | Already handled by `@supabase/ssr` patterns |
| `proxy.ts` naming (Next.js 16) | Low | Use `proxy()` + `proxyConfig`, not `middleware.ts` |
| RLS not configured for profiles | Med | Include basic RLS in migration SQL |

## Rollback Plan

1. Unset env vars → app degrades to no-auth (pages accessible)
2. `supabase db reset` drops profiles table
3. Revert `proxy.ts` matcher to allow all

## Dependencies

- Docker (WSL2) for `supabase start`
- Google OAuth Client ID/Secret from Google Cloud Console

## Success Criteria

- [ ] Register with email + password, confirm via Inbucket, log in
- [ ] Sign in with Google OAuth
- [ ] Protected routes redirect unauthenticated to `/login`
- [ ] Auth session persists across page refresh
- [ ] Profiles row auto-created on signup
- [ ] `bun run biome:check` passes
