-- Remove FK constraint match_moves_match_id_fkey
-- match_moves.match_id is a logical reference, not a DB-enforced FK.
-- This allows moves to be buffered independently of match persistence.

ALTER TABLE public.match_moves
  DROP CONSTRAINT IF EXISTS match_moves_match_id_fkey;
