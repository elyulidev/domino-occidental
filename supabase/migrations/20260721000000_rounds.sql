-- Match Rounds: persist per-hand results so each match has a complete narrative
-- who won each hand, points scored, board state, and score progression.
-- Enables replay, analytics, and match history review.
--
-- Fully idempotent: safe to re-run on databases where the table
-- was partially created by a previous attempt.

-- 1. Create table (no-op if already exists)
create table if not exists public.match_rounds (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null,
  round_number      integer not null,
  winning_pair      smallint,
  points            integer not null default 0,
  is_blocked        boolean not null default false,
  is_annulled       boolean not null default false,
  reason            text not null,
  hand_scores       smallint[2] not null,
  scores_after      smallint[2] not null,
  board_left_end    smallint,
  board_right_end   smallint,
  board_tile_count  integer not null default 0,
  player_hands      smallint[4] not null,
  first_player      smallint not null,
  created_at        timestamptz not null default now()
);

-- 2. Add check constraints only if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'match_rounds_reason_check'
      AND conrelid = 'public.match_rounds'::regclass
  ) THEN
    ALTER TABLE public.match_rounds
      ADD CONSTRAINT match_rounds_reason_check
      CHECK (reason in ('empty_hand', 'blocked', 'annulled', 'forced_winner'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'match_rounds_annulled_check'
      AND conrelid = 'public.match_rounds'::regclass
  ) THEN
    ALTER TABLE public.match_rounds
      ADD CONSTRAINT match_rounds_annulled_check
      CHECK (
        (is_annulled = true and winning_pair is null and points = 0)
        or is_annulled = false
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'match_rounds_match_id_fkey'
      AND conrelid = 'public.match_rounds'::regclass
  ) THEN
    ALTER TABLE public.match_rounds
      ADD CONSTRAINT match_rounds_match_id_fkey
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Index (idempotent)
CREATE INDEX IF NOT EXISTS idx_match_rounds_match
  ON public.match_rounds (match_id, round_number);

-- 4. RLS (idempotent)
ALTER TABLE public.match_rounds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can view match rounds'
      AND tablename = 'match_rounds'
  ) THEN
    CREATE POLICY "Authenticated users can view match rounds"
      ON public.match_rounds FOR SELECT
      TO authenticated
      USING ( true );
  END IF;
END $$;

GRANT SELECT ON public.match_rounds TO authenticated;

-- 5. Comments
COMMENT ON TABLE public.match_rounds IS 'Per-hand results for replay and match history';
COMMENT ON COLUMN public.match_rounds.winning_pair IS 'Pair index (0 or 1) that won the hand; null if annulled';
COMMENT ON COLUMN public.match_rounds.points IS 'Points awarded to the winning pair (0 if annulled)';
COMMENT ON COLUMN public.match_rounds.hand_scores IS 'Pair sums at hand end [pair0, pair1]';
COMMENT ON COLUMN public.match_rounds.scores_after IS 'Match scores after this hand [pair0, pair1]';
COMMENT ON COLUMN public.match_rounds.board_tile_count IS 'Number of tiles on the board at hand end';
COMMENT ON COLUMN public.match_rounds.player_hands IS 'Pip count per player [p0, p1, p2, p3]';
COMMENT ON COLUMN public.match_rounds.first_player IS 'Player index who started the hand';
