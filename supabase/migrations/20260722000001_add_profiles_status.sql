-- Add status column to profiles (online/in_game/offline)
-- Rollback: ALTER TABLE public.profiles DROP COLUMN IF EXISTS status;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text
    CHECK (status IN ('online', 'in_game', 'offline'))
    DEFAULT 'offline';
