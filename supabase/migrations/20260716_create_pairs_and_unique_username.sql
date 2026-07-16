-- Pairs table: stable partnerships between two players.
-- Also adds unique constraint on profiles.username.

-- 1. Unique username
ALTER TABLE profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

COMMENT ON CONSTRAINT profiles_username_unique ON profiles IS 'Usernames must be unique across all players.';

-- 2. Pairs table
CREATE TABLE pairs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'active'
               CHECK (status IN ('pending', 'active', 'dissolved')),
  priority     smallint NOT NULL DEFAULT 1,
  elo_pareja   integer NOT NULL DEFAULT 1200,
  invited_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- A pair is two distinct users
  CHECK (user_a <> user_b),
  -- No duplicate pairs (order-independent)
  UNIQUE (user_a, user_b)
);

COMMENT ON TABLE pairs IS 'Stable partnerships for 2v2 domino. Both users must accept before status=active.';

-- RLS: anyone can read pairs (for matchmaking), only members can modify
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pairs"
  ON pairs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create pairs they invited"
  ON pairs FOR INSERT
  TO authenticated
  WITH CHECK ( (select auth.uid()) = invited_by );

CREATE POLICY "Pair members can update status"
  ON pairs FOR UPDATE
  TO authenticated
  USING ( (select auth.uid()) IN (user_a, user_b) )
  WITH CHECK ( (select auth.uid()) IN (user_a, user_b) );

CREATE POLICY "Pair members can dissolve"
  ON pairs FOR DELETE
  TO authenticated
  USING ( (select auth.uid()) IN (user_a, user_b) );
