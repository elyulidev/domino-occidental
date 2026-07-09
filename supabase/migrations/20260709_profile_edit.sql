-- Profile Edit: add country column, unique username index, public SELECT policy.
-- Rollback: DROP POLICY IF EXISTS "Authenticated users can view any profile" ON public.profiles;
--          DROP INDEX IF EXISTS public.idx_profiles_username;
--          ALTER TABLE public.profiles DROP COLUMN IF EXISTS country;

-- 1. Add country column (ISO 3166-1 alpha-2, nullable for existing rows)
alter table public.profiles
  add column if not exists country char(2);

-- 2. Unique index on username (prevents duplicate usernames at DB level)
create unique index if not exists idx_profiles_username
  on public.profiles (username);

-- 3. Grant base permissions to authenticated role so RLS can enforce policies
grant select, update on public.profiles to authenticated;

-- 4. Public SELECT policy: any authenticated user can read any profile
--    (keeps existing own-profile SELECT policy intact)
create policy "Authenticated users can view any profile"
  on public.profiles for select
  to authenticated
  using ( true );
