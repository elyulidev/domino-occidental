-- Create Profile RPC: application-layer function to create profiles
-- after OAuth / email signup, since GoTrue bypasses DB triggers.
-- Rollback: DROP FUNCTION IF EXISTS public.create_profile_for_user;

-- Function called from the application layer (auth callback route).
-- Mirrors the coalesce logic from handle_new_user() trigger function.
create or replace function public.create_profile_for_user(
  user_id uuid,
  user_metadata jsonb default '{}',
  user_email text default ''
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, username)
  values (
    user_id,
    coalesce(
      user_metadata ->> 'username',
      user_metadata ->> 'name',
      split_part(user_email, '@', 1)
    )
  )
  on conflict (id) do nothing;
end;
$$;

-- Grant execute to authenticated so the user's session can call it via RPC.
grant execute on function public.create_profile_for_user to authenticated;
