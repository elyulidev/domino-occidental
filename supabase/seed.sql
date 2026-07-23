-- Dominó Occidental — seed data
-- Run via `supabase db reset` (automatically loads this file).
--
-- Users (password for all: 123456789)
--   1. elyulidev  — elyuli.dev@gmail.com
--   2. liovis     — liovis@gmail.com
--   3. yoel       — yoelalmedabarrios@gmail.com
--   4. cesar      — cesar@gmail.com

-- ──────────────────────────────────────────────────────────────
-- Auth users (Supabase Auth)
-- ──────────────────────────────────────────────────────────────
-- Password: 123456789 → bcrypt hash (cost 10)
-- Generated via: SELECT crypt('123456789', gen_salt('bf', 10));

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  x.id,
  'authenticated',
  'authenticated',
  x.email,
  x.password,
  now(), now(), now(), '', ''
FROM (VALUES
  ('dbeded8f-dbf3-4136-a8b1-8c57eb3fbb4e'::uuid, 'elyuli.dev@gmail.com',   '$2a$10$0NUgdOYP5S2as/Wdcz009endo3a.pubae6.IRSl4aIBzDyMRjThXq'),
  ('09f43c9f-6305-4ec3-aa71-8e9fec45145c'::uuid, 'liovis@gmail.com',        '$2a$10$hEhQ0BhczPKbbPYMnejzDeD6F.uw524AFUGryuw0eZ4dSRrPraxPm'),
  ('7324cbaa-79e8-4ecc-abc2-b7983ac9b95b'::uuid, 'yoelalmedabarrios@gmail.com', '$2a$10$XNAh5GCeL7VoEMeeUfKcbu0MA9gFvEk.3sHxNboqvKKNcdyvvSZuK'),
  ('9960c104-2303-4b49-883e-0eb6fbcfa746'::uuid, 'cesar@gmail.com',         '$2a$10$daawhs1kyPEMYDR88babK.yrf18QjhWru9bCVZnMWCy60hG1hTgKG')
) AS x(id, email, password);

-- Auth identities (links user → email provider)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
SELECT
  x.id,
  x.id,
  jsonb_build_object('sub', x.id::text, 'email', x.email),
  'email',
  x.email,
  now(), now(), now()
FROM (VALUES
  ('dbeded8f-dbf3-4136-a8b1-8c57eb3fbb4e'::uuid, 'elyuli.dev@gmail.com'),
  ('09f43c9f-6305-4ec3-aa71-8e9fec45145c'::uuid, 'liovis@gmail.com'),
  ('7324cbaa-79e8-4ecc-abc2-b7983ac9b95b'::uuid, 'yoelalmedabarrios@gmail.com'),
  ('9960c104-2303-4b49-883e-0eb6fbcfa746'::uuid, 'cesar@gmail.com')
) AS x(id, email);

-- ──────────────────────────────────────────────────────────────
-- Profiles (public profile data)
-- ──────────────────────────────────────────────────────────────
-- Profiles are auto-created by trigger on auth.users insert.
-- Update with extra fields (status, country) that the trigger doesn't set.
UPDATE public.profiles SET status = 'offline', country = 'CU'
WHERE id IN (
  'dbeded8f-dbf3-4136-a8b1-8c57eb3fbb4e',
  '09f43c9f-6305-4ec3-aa71-8e9fec45145c',
  '7324cbaa-79e8-4ecc-abc2-b7983ac9b95b',
  '9960c104-2303-4b49-883e-0eb6fbcfa746'
);
