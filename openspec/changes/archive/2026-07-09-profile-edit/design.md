# Design: Profile Edit — Conectar a Supabase

## Technical Approach

Replace static DEMO_PROFILE with real Supabase-backed data. Server Component fetches profile at render time, passes to a client form via `useActionState`. Avatar upload fires a second server action on file selection. View page queries profiles by `params.username`, 404s on miss, shows default stats. Pure validation logic extracted for unit testability (TDD).

## Architecture Decisions

| Decision | Option | Tradeoff | Rationale |
|----------|--------|----------|-----------|
| Form submission | `useActionState` vs `useTransition` | `useActionState` gives built-in pending/error/success state bound to `<form action>`. `useTransition` needs manual state. | Use `useActionState` — matches existing login/register pattern. |
| Avatar upload trigger | `useTransition` vs separate route | Upload happens on file `onChange`, not form submit. Server action via transition avoids form coupling. | Use `useTransition` — no extra route, no form dependency. |
| Server action file | New `profile.ts` vs inline vs `auth.ts` | Auth and profile are separate concerns. New file follows existing convention. | New `src/lib/actions/profile.ts`. |
| Profile data flow | SC fetches → passes as prop vs client fetch-on-mount | SC fetch = zero loading state, initial HTML has data, no client flash. | Hybrid SC+client component. |
| Redirect after save | Server-side `redirect()` vs client `router.push()` | Server redirect invalidates cache via `revalidatePath` before navigating. Matches auth pattern. | Server-side redirect in `updateProfile`. |
| RLS for SELECT | "authenticated read all" + "own profile" | Both policies coexist (RLS uses OR for same command type). Narrower policy redundant but safe. | Add public SELECT for authenticated; keep existing UPDATE and own-SELECT policies. |
| Username collision | Post-submit catch vs debounced check | Debounce adds complexity, extra round-trips. Post-submit catches PG unique violation → friendly error. | Post-submit catch (PG error 23505). |

## Data Flow

### Profile Edit
```
Browser             Server Component           Supabase
  │                        │                      │
  │  GET /profile/edit     │                      │
  │───────────────────────►│                      │
  │                        │  createClient()      │
  │                        │─────────────────────►│
  │                        │◄──── session + id ───│
  │                        │  profiles.select()   │
  │                        │─────────────────────►│
  │                        │◄─── profile row ─────│
  │  HTML + initial props  │                      │
  │◄───────────────────────│                      │
  │                        │                      │
  │  [user edits form]     │                      │
  │  [selects avatar]      │                      │
  │  startUploadTransition │                      │
  │  │ uploadAvatar(fd)    │                      │
  │  │─────────────────────│─────────────────────►│
  │  │◄── { url, error } ──│──────────────────────│
  │  │ update preview      │                      │
  │  │                      │                      │
  │  [clicks Guardar]      │                      │
  │  form → updateProfile  │                      │
  │  │─────────────────────│─────────────────────►│
  │  │                     │  revalidatePath      │
  │  │                     │  redirect(/profile…) │
  │◄── redirect ──────────│                      │
```

### Profile View
```
Browser             Server Component           Supabase
  │                        │                      │
  │  GET /profile/alice    │                      │
  │───────────────────────►│                      │
  │                        │  profiles.select()   │
  │                        │  .eq("username","alice")│
  │                        │─────────────────────►│
  │                        │◄── row │ null ───────│
  │  [ null → notFound() ] │                      │
  │  [ row → render HTML ] │                      │
  │◄───────────────────────│                      │
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260709_profile_edit.sql` | Create | Add `country CHAR(2)`, unique index on `username`, public SELECT RLS policy |
| `packages/frontend/src/lib/actions/profile.ts` | Create | Server actions: `updateProfile` (validate+upsert), `uploadAvatar` (storage+DB update) |
| `packages/frontend/src/lib/profile-validation.ts` | Create | Pure functions: `validateProfileFields`, `validateCountry`, `getInitials` — extract for unit testability |
| `packages/frontend/src/app/(dashboard)/profile/edit/page.tsx` | Rewrite | Hybrid SC: fetches profile via `createClient()` + `getUser()`, renders `<EditProfileForm>` |
| `packages/frontend/src/app/(dashboard)/profile/edit/EditProfileForm.tsx` | Create | Client form: `useActionState(updateProfile)`, `useTransition` for avatar, file input, country select |
| `packages/frontend/src/app/(dashboard)/profile/[username]/page.tsx` | Rewrite | Dynamic SC: queries profiles by username, `notFound()` on null, default stats, own-profile edit button |
| `packages/frontend/src/app/(dashboard)/profile/not-found.tsx` | Create | Custom 404 for unknown profile usernames |
| `packages/frontend/src/lib/actions/__tests__/profile-validation.test.ts` | Create | Unit tests for validation functions (TDD) |

## Interfaces / Contracts

```typescript
// src/lib/actions/profile.ts
export type ProfileFormState = {
  success?: boolean;
  error?: string;
  username?: string;   // new username for redirect target
};

export async function updateProfile(
  _prevState: ProfileFormState | null,
  formData: FormData,
): Promise<ProfileFormState>

export async function uploadAvatar(
  formData: FormData,
): Promise<{ url?: string; error?: string }>

// src/lib/profile-validation.ts
export function validateProfileFields(fields: {
  username: string;
  country: string;
}): { error?: string }

export function getInitials(username: string): string
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `validateProfileFields` — valid username, too short, special chars, invalid country | Pure function tests via `bun test`, no mocks |
| Unit | `getInitials` — normal name, single letter, edge cases | Pure function tests |
| Unit | `categorizeProfileError` — PG unique violation, network error, unknown | Unit tests with mock error objects |
| Integration | `updateProfile` — valid save, duplicate username | Structured integration tests (requires Supabase) |
| Integration | `uploadAvatar` — valid file, oversize, wrong type | Structured integration tests (requires Supabase) |

## Migration / Rollback

**Migration** (`20260709_profile_edit.sql`):
```sql
-- Add country column
ALTER TABLE profiles ADD COLUMN country CHAR(2);

-- Unique index on username
CREATE UNIQUE INDEX profiles_username_key ON profiles (username);

-- Public SELECT policy for authenticated users
CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
```

**Rollback**:
1. `DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles`
2. `DROP INDEX IF EXISTS profiles_username_key`
3. `ALTER TABLE profiles DROP COLUMN IF EXISTS country`

## Open Questions

- None — all decisions scoped in proposal and verified against codebase patterns.
