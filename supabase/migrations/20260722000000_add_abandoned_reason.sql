-- Migration: Add 'abandoned' to match_rounds reason check
-- When a match is abandoned mid-hand, we record a stub round with
-- reason='abandoned' so match_moves.round_id has a valid FK target.
-- Also adds the annulled constraint exception for abandoned rounds.

-- Step 1: Drop old check constraint
ALTER TABLE public.match_rounds
  DROP CONSTRAINT IF EXISTS match_rounds_reason_check;

-- Step 2: Recreate with 'abandoned' added
ALTER TABLE public.match_rounds
  ADD CONSTRAINT match_rounds_reason_check
  CHECK (reason in ('empty_hand', 'blocked', 'annulled', 'forced_winner', 'abandoned'));

-- Step 3: Relax annulled constraint — abandoned rounds don't require is_annulled=true
ALTER TABLE public.match_rounds
  DROP CONSTRAINT IF EXISTS match_rounds_annulled_check;

ALTER TABLE public.match_rounds
  ADD CONSTRAINT match_rounds_annulled_check
  CHECK (
    (is_annulled = true and winning_pair is null and points = 0)
    or reason = 'abandoned'
    or is_annulled = false
  );
