# Archive Report: auth-setup

**Status**: archived
**Change**: auth-setup — Supabase Auth integration with Next.js 16 App Router
**Branch**: `feature/auth-setup`
**Archive Date**: 2026-07-07

---

## Change Summary

Integrated Supabase Auth into the Dominó Occidental frontend: email/password registration + login, Google OAuth, session management, route protection via `proxy.ts`, and profiles table with auto-creation trigger.

## Artifact Inventory

| Artifact | Path / Key | Status |
|----------|-----------|--------|
| Proposal | `openspec/changes/auth-setup/proposal.md` | ✅ Final |
| Spec | `openspec/changes/auth-setup/spec.md` + `openspec/specs/user-auth/spec.md` | ✅ Final |
| Design | `openspec/changes/auth-setup/design.md` | ✅ Final |
| Tasks | `openspec/changes/auth-setup/tasks.md` | ✅ Final |
| Verify | `openspec/changes/auth-setup/verify-report.md` | ✅ Final |
| Archive | `openspec/changes/auth-setup/archive-report.md` | ✅ Current |

## Delivery State

- **Branch**: `feature/auth-setup`
- **Strategy**: force-chained PRs, feature-branch-chain
- **PR #1**: Phases 1+2 (config.toml, SSR clients, proxy, callback, env) — ~280 lines
- **PR #2**: Phases 3+5 (Server Actions, auth forms, profiles migration) — ~320 lines
- **Commits**: None yet (pending archive → commit)

## Testing Summary

| Suite | Result | Notes |
|-------|--------|-------|
| `npx vitest run` (frontend) | ✅ 36/36 pass | 17 proxy-rules + 5 auth + 5 login-form + 5 register-form + 4 integration |
| `bun test` (root) | ⚠️ 10 component failures | jsdom-dependent tests; workaround: `npx vitest run` |
| `bun run build` | ✅ Pass (5.1s) | TypeScript check passed, 21 pages generated |
| `bun run biome:check` (auth-setup files) | ✅ Pass with warnings | 7 noNonNullAssertion warnings, 6 formatting cosmetics |

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth client | `@supabase/ssr` v0.12.0 | Handles SSR cookie serialization automatically |
| Auth check | `getUser()` over `getSession()` | Verifies JWT against Supabase API server-side |
| Form pattern | Client Component + Server Action | SEO-friendly page.tsx + no extra REST hop |
| proxy.ts naming | `src/proxy.ts` | Next.js 16 middleware rename |
| Profiles | SQL migration + trigger | Ensures profile creation regardless of signup path |

## Non-Blocking Findings (deferred)

1. **Biome env var warnings (7)**: `noNonNullAssertion` on `process.env.*` — intentional runtime assertions
2. **Integration test stubs (4)**: Placeholders requiring running Supabase local instance
3. **AUTH-ERRORS UX polish**: Generic Supabase error messages instead of specific retry/resend UI

## Dependencies for Next Changes

This change adds capability `user-auth`. Downstream changes (matches, friends, tournaments, ELO, etc.) depend on:
- `packages/frontend/src/lib/supabase/client.ts` — browser auth client
- `packages/frontend/src/lib/supabase/server.ts` — server auth client
- `packages/frontend/src/app/actions/auth.ts` — auth Server Actions
- `packages/backend/src/db/schema/profiles.ts` — profiles schema for typed queries

## Rollback

1. Remove `.env.local` → app degrades (no auth, pages accessible)
2. `supabase db reset` drops profiles table
3. Revert `proxy.ts` matcher to allow all
4. Remove added packages: `bun remove @supabase/ssr @supabase/supabase-js`
