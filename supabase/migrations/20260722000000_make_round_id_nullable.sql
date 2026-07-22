-- Migration: Make match_moves.round_id nullable
-- Abandoned matches have moves without a completed round (no hand_ended event).
-- FK constraint dropped because a nullable FK on a volatile relationship
-- causes more problems than it solves.

-- Step 1: Drop FK constraint (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'match_moves_round_id_fkey'
      AND conrelid = 'public.match_moves'::regclass
  ) THEN
    ALTER TABLE public.match_moves
      DROP CONSTRAINT match_moves_round_id_fkey;
  END IF;
END $$;

-- Step 2: Drop NOT NULL (if currently required)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match_moves'
      AND column_name = 'round_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.match_moves
      ALTER COLUMN round_id DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.match_moves.round_id IS 'FK a match_rounds (nullable). NULL cuando la partida fue abandonada antes de completar la ronda.';
