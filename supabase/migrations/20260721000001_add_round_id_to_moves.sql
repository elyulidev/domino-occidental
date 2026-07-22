-- Migration: Add round_id FK to match_moves → match_rounds
-- Normalizes the schema: matches → match_rounds → match_moves
--
-- Fully idempotent: safe to re-run.

-- Step 1: Add round_id column (no-op if exists)
ALTER TABLE public.match_moves
  ADD COLUMN IF NOT EXISTS round_id uuid;

-- Step 2: Backfill round_id from match_rounds (for existing data)
UPDATE public.match_moves mv
  SET round_id = mr.id
  FROM public.match_rounds mr
  WHERE mv.match_id = mr.match_id
    AND mv.round_number = mr.round_number
    AND mv.round_id IS NULL;

-- Step 3: Make round_id NOT NULL (only if currently nullable)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match_moves'
      AND column_name = 'round_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE public.match_moves
      ALTER COLUMN round_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: Add FK constraint (only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'match_moves_round_id_fkey'
      AND conrelid = 'public.match_moves'::regclass
  ) THEN
    ALTER TABLE public.match_moves
      ADD CONSTRAINT match_moves_round_id_fkey
      FOREIGN KEY (round_id) REFERENCES public.match_rounds(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Step 5: Replace round-based index with round_id index
DROP INDEX IF EXISTS public.idx_match_moves_round;

CREATE INDEX IF NOT EXISTS idx_match_moves_round_id
  ON public.match_moves (round_id, move_number);

-- Comment
COMMENT ON COLUMN public.match_moves.round_id IS 'FK a match_rounds. Identifica la ronda/mano a la que pertenece este movimiento.';
