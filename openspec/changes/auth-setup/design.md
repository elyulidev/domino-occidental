# Design: Auth Setup

## Technical Approach

Wire Supabase Auth into the frontend via `@supabase/ssr` — browser client, server client, proxy.ts for route protection + session refresh, and Server Actions for form mutations. Profiles table via SQL migration with an `on_auth_user_created` trigger. Google-only OAuth. `getUser()` everywhere (never `getSession()`).

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Auth client lib | `@supabase/ssr` | Supabase-js directly | SSR handles cookie serialization across client/server/edge context automatically |
| Auth check in proxy | `getUser()` | `getSession()` | `getUser()` verifies JWT against Supabase Auth API; `getSession()` trusts local cookie without verification |
| Form pattern | Client Form Component + Server Action | Full client page, API route | Keeps page.tsx as Server Component (SEO, metadata), Server Action avoids extra REST hop |
| OAuth providers | Google only | Google + GitHub | Per spec — GitHub button removed from both login/register |
| proxy.ts naming | `src/proxy.ts` | `middleware.ts` | Next.js 16 renamed middleware → proxy; must export `proxy()` + `proxyConfig` |
| Profiles schema | SQL migration + trigger | Drizzle schema only | Trigger ensures every auth.users row gets a profile regardless of signup path; Drizzle schema in backend for typed queries |
| Email verification | Enabled (Inbucket) | Disabled for dev | Required for production; Inbucket provides local testing |
| Cookie handling | `getAll()` / `setAll()` (v1 API) | Legacy `get()`/`set()` | @supabase/ssr v1 uses batch API for atomic cookie writes |

## Data Flow

### Registration
```
RegisterForm (client) ──submit──→ signUp(formData) (Server Action)
  → supabase.auth.signUp({ email, password, options: { data: { username } } })
  → Supabase creates auth.users row, sends confirmation email
  ← { message: "Revisá tu correo" }
  → User checks Inbucket at localhost:54324, clicks link
  → Email confirmed, user can sign in
```

### Login
```
LoginForm (client) ──submit──→ signIn(formData) (Server Action)
  → supabase.auth.signInWithPassword({ email, password })
  → Supabase verifies, sets session cookie
  ← revalidatePath('/'), redirect('/dashboard')
```

### Google OAuth
```
LoginForm (client) ──click Google──→ signInWithOAuth({ provider: 'google', redirectTo })
  → Browser redirects → Google consent → /auth/callback?code=...
  → callback route: exchangeCodeForSession(code)
  → Session cookie set → redirect /dashboard
```

### proxy.ts
```
Every request → proxy.ts
  → createServerClient(request.cookies)
  → supabase.auth.getUser()
    ├── user exists → refresh cookies → allow
    └── null → check path
        ├── public: /, /login, /register, /auth/* → allow
        └── protected: /lobby, /friends, /pairs, /tournaments, /shop, /profile/*, /notifications, /settings, /users/*, /match/* → redirect /login?next=<path>
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/config.toml` | Modify | Enable Google OAuth, enable email confirmations, set redirect URLs |
| `supabase/migrations/.gitkeep` | Create | Migration directory placeholder |
| `supabase/seed.sql` | Create | Empty seed (required by config.toml) |
| `packages/frontend/.env.local` | Create | Supabase env vars (gitignored) |
| `packages/frontend/package.json` | Modify | Add `@supabase/ssr` + `@supabase/supabase-js` |
| `packages/frontend/src/lib/supabase/client.ts` | Create | Browser Supabase client (`'use client'`) |
| `packages/frontend/src/lib/supabase/server.ts` | Create | Server Supabase client (async `cookies()`) |
| `packages/frontend/src/app/auth/callback/route.ts` | Create | OAuth callback: exchange code → redirect |
| `packages/frontend/src/proxy.ts` | Create | Route protection + session refresh (Next.js 16) |
| `packages/frontend/src/app/actions/auth.ts` | Create | Server Actions: signUp, signIn, signOut |
| `packages/frontend/src/components/auth/login-form.tsx` | Create | Client form with email/password + Google OAuth |
| `packages/frontend/src/components/auth/register-form.tsx` | Create | Client form with username + email/password + Google OAuth |
| `packages/frontend/src/app/(auth)/login/page.tsx` | Modify | Render LoginForm, remove GitHub button |
| `packages/frontend/src/app/(auth)/register/page.tsx` | Modify | Render RegisterForm, remove GitHub button |
| `supabase/migrations/<ts>_create_profiles.sql` | Create | Profiles table DDL + trigger + RLS |
| `packages/backend/src/db/schema/profiles.ts` | Create | Drizzle schema mirroring migration |

## Interfaces / Contracts

### Server Action Signatures

```typescript
// app/actions/auth.ts — all 'use server'
export async function signUp(formData: FormData): Promise<{ error?: string; message?: string }>
export async function signIn(formData: FormData): Promise<{ error?: string }>  // redirects on success
export async function signOut(): Promise<void>  // redirects on success
```

### proxy.ts Exports

```typescript
// proxy.ts
export async function proxy(request: NextRequest): Promise<NextResponse>
export const proxyConfig: { matcher: string[] }
```

### Profiles Table DDL

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- RLS: select + update own profile only
-- Trigger: handle_new_user() on auth.users insert
--   derives username from raw_user_meta_data ->> 'username' or 'name' (Google)
```

## proxy.ts Configuration

```typescript
export const proxyConfig = {
  // Run on page routes only (exclude static assets)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

Protected routes (require auth): all paths under `(dashboard)` and `(game)` route groups. Public routes: `/`, `/login`, `/register`, `/auth/*`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | Server Actions | Mock `createClient`, verify `signIn`/`signUp`/`signOut` calls and error returns |
| Unit | proxy.ts | Mock `getUser()`, test redirect logic for protected vs public routes |
| Integration (DB) | Profiles trigger | Insert into `auth.users`, verify `profiles` row created with correct username |
| Integration (DB) | RLS policies | Verify authenticated user can only SELECT/UPDATE own profile |
| E2E | Full auth flow | Need Supabase local; register → confirm in Inbucket → login → access dashboard |

## Migration / Rollout

No migration required for existing data. Rollback:
1. Remove `.env.local` → app degrades (no auth, pages accessible)
2. `supabase db reset` drops profiles table
3. Revert `proxy.ts` matcher to allow all

## Phase 1 Detail — Local Supabase Setup

1. Enable Google OAuth in `config.toml`: `[auth.external.google] enabled = true`, set `client_id = ""` and `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`
2. Enable email confirmations: `[auth.email] enable_confirmations = true`
3. Set `site_url = "http://localhost:3000"` and `additional_redirect_urls = ["http://localhost:3000/auth/callback"]`
4. Create `supabase/migrations/` + `.gitkeep` + empty `seed.sql`
5. User runs `supabase start` in WSL, shares `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Create `packages/frontend/.env.local` with those vars + Google OAuth client ID/secret

## Dependencies

```bash
bun add @supabase/ssr @supabase/supabase-js
# @supabase/ssr v1.x — use batch cookie API (getAll/setAll)
```

## Chained PR Strategy

Estimated ~14 files, ~600-800 lines → split into 2 chained PRs:
- **PR #1**: Phases 1+2 (setup, client files, proxy, callback) — ~300 lines
- **PR #2**: Phases 3+5 (auth UI + profiles) — ~300 lines
