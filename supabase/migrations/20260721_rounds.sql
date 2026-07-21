-- Match Rounds: persist per-hand results so each match has a complete narrative
-- — who won each hand, points scored, board state, and score progression.
-- Enables replay, analytics, and match history review.
--
-- Rollback: DROP TABLE IF EXISTS public.match_rounds;
--
-- FK constraint: match_rounds.match_id → matches(id) cascade delete.
-- Matches are created in-memory first; the match row is inserted into the DB
-- by persistMatch(). Rounds are buffered in memory and flushed after the
-- match row exists (same pattern as match_moves).

create table if not exists public.match_rounds (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null,
  round_number      integer not null,          -- 0-indexed, matches turn.roundNumber
  winning_pair      smallint,                  -- 0 or 1, null if annulled
  points            integer not null default 0, -- points awarded (0 if annulled)
  is_blocked        boolean not null default false,
  is_annulled       boolean not null default false,
  reason            text not null check (reason in ('empty_hand', 'blocked', 'annulled', 'forced_winner')),
  hand_scores       smallint[2] not null,      -- pair sums at hand end [pair0, pair1]
  scores_after      smallint[2] not null,      -- match scores after this hand [pair0, pair1]
  board_left_end    smallint,                  -- board left end at hand end (null if empty board)
  board_right_end   smallint,                  -- board right end at hand end (null if empty board)
  board_tile_count  integer not null default 0, -- number of tiles on board at hand end
  player_hands      smallint[4] not null,      -- pip count per player [p0, p1, p2, p3]
  first_player      smallint not null check (first_player between 0 and 3), -- player who started the hand
  created_at        timestamptz not null default now(),

  -- reason valid values
  constraint match_rounds_reason_check check (
    reason in ('empty_hand', 'blocked', 'annulled', 'forced_winner')
  ),

  -- annulled hand: no winner, 0 points
  constraint match_rounds_annulled_check check (
    (is_annulled = true and winning_pair is null and points = 0)
    or is_annulled = false
  )
);

-- Index for replay: all rounds of a match in order
create index if not exists idx_match_rounds_match
  on public.match_rounds (match_id, round_number);

-- RLS: authenticated users can read rounds (for replay, history)
alter table public.match_rounds enable row level security;

create policy "Authenticated users can view match rounds"
  on public.match_rounds for select
  to authenticated
  using ( true );

-- Server inserts with service_role; only SELECT policy needed for clients
grant select on public.match_rounds to authenticated;

comment on table public.match_rounds is 'Per-hand results for replay and match history';
comment on column public.match_rounds.winning_pair is 'Pair index (0 or 1) that won the hand; null if annulled';
comment on column public.match_rounds.points is 'Points awarded to the winning pair (0 if annulled)';
comment on column public.match_rounds.hand_scores is 'Pair sums at hand end [pair0, pair1]';
comment on column public.match_rounds.scores_after is 'Match scores after this hand [pair0, pair1]';
comment on column public.match_rounds.board_tile_count is 'Number of tiles on the board at hand end';
comment on column public.match_rounds.player_hands is 'Pip count per player [p0, p1, p2, p3]';
comment on column public.match_rounds.first_player is 'Player index who started the hand';
