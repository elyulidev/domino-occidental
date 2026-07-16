-- =============================================================================
-- Matches table: persist terminal-state matches (finished/abandoned) to DB.
-- Previously matches lived only in an in-memory Map and vanished on restart.
-- match_moves.match_id was UUID but inserts failed silently because
-- match IDs used string format (match-${ts}-${rand}).
--
-- This migration:
--   1. Creates the `matches` table with all required columns.
--   2. Deletes orphaned match_moves rows (all have broken string-format IDs).
--   3. Adds FK from match_moves.match_id → matches.id.
-- =============================================================================

-- 1. Matches table
create table if not exists public.matches (
  id              uuid primary key default gen_random_uuid(),
  status          text not null check (status in ('finished', 'abandoned')),
  winner          smallint,          -- winning pair index (0 or 1), null if abandoned
  forfeit_by      uuid,              -- player who forfeited, null otherwise
  scores          smallint[2] not null,  -- [pair0, pair1] final scores
  round_count     integer not null,  -- total hands played (1-indexed)
  target_score    integer not null default 200,
  player_ids      uuid[4] not null,  -- [p1, p2, p3, p4] seat order
  started_at      timestamptz not null,
  ended_at        timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Index for player match history
create index if not exists idx_matches_player_ids
  on public.matches using gin (player_ids);

-- Index for recent matches / leaderboard queries
create index if not exists idx_matches_ended_at
  on public.matches (ended_at desc);

-- RLS: authenticated users can read matches (for replay, history, etc.)
alter table public.matches enable row level security;

create policy "Authenticated users can view matches"
  on public.matches for select
  to authenticated
  using ( true );

grant select on public.matches to authenticated;

comment on table public.matches is 'Persisted terminal-state matches (finished/abandoned)';
comment on column public.matches.player_ids is 'UUID array [p1, p2, p3, p4] in seat order';
comment on column public.matches.winner is 'Winning pair index (0 or 1), null if abandoned';
comment on column public.matches.forfeit_by is 'Player UUID who forfeited/abandoned, null otherwise';

-- 2. Delete orphaned match_moves rows (all have string-format IDs that never matched UUIDs)
delete from public.match_moves;

-- 3. Add FK from match_moves to matches
alter table public.match_moves
  add constraint match_moves_match_id_fkey
  foreign key (match_id) references public.matches(id)
  on delete cascade;
