-- Match Moves: historial de cada jugada para replay y auditoría anti-trampas.
-- Cada fila = un movimiento (tile play o pass) dentro de una partida.
-- Rollback: DROP TABLE IF EXISTS public.match_moves;
--
-- Regla de integridad: si es pass, no hay tile. Si es play, tile obligatorio.
-- Las partidas activas viven en memoria del servidor. FK a matches(id) se agrega
-- en la migración 20260716_matches.sql una vez creada la tabla matches.

create table if not exists public.match_moves (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null,
  round_number    integer not null,
  player_index    smallint not null check (player_index between 0 and 3),
  move_number     integer not null,        -- número secuencial global de la partida
  is_pass         boolean not null,
  tile_id         text,                     -- null si is_pass = true
  tile_top        smallint,                 -- null si is_pass = true
  tile_bottom     smallint,                 -- null si is_pass = true
  side            text,                     -- 'left' o 'right'; null si pass
  board_left_end  smallint,                 -- estado del tablero después del move
  board_right_end smallint,                 -- estado del tablero después del move
  action_source   text not null default 'player',  -- 'player' | 'timeout' | 'forfeit'
  created_at      timestamptz not null default now(),

  -- Regla de integridad crítica: pass no lleva ficha, play sí lleva
  constraint match_moves_data_check check (
    (is_pass = true and tile_id is null and tile_top is null and tile_bottom is null and side is null)
    or (is_pass = false and tile_id is not null and tile_top is not null and tile_bottom is not null and side is not null)
  ),

  -- side válido solo cuando no es pass
  constraint match_moves_side_check check (
    is_pass = true
    or (is_pass = false and side in ('left', 'right'))
  ),

  -- source válido: play es siempre voluntario, timeout/forfeit solo en pass
  constraint match_moves_action_check check (
    action_source in ('player', 'timeout', 'forfeit')
  ),

  -- consistencia: si es play (no pass), el source es siempre voluntario
  constraint match_moves_action_play_check check (
    (is_pass = false and action_source = 'player')
    or is_pass = true
  )
);

-- Índice para replay: obtener todos los moves de una partida en orden
create index if not exists idx_match_moves_match
  on public.match_moves (match_id, move_number);

-- Índice para análisis: moves por ronda
create index if not exists idx_match_moves_round
  on public.match_moves (match_id, round_number, move_number);

-- RLS: cualquier usuario autenticado puede leer moves (para ver replays)
alter table public.match_moves enable row level security;

create policy "Authenticated users can view match moves"
  on public.match_moves for select
  to authenticated
  using ( true );

-- El servidor inserta con service_role, así que solo necesita
-- el SELECT policy para usuarios; INSERT/UPDATE no se exponen al cliente.
grant select on public.match_moves to authenticated;

comment on table public.match_moves is 'Historial de jugadas para replay y auditoría';
comment on column public.match_moves.is_pass is 'true = pase (no jugó ficha), false = jugó ficha. action_source distingue voluntario vs forzado.';
comment on column public.match_moves.action_source is 'Origen de la acción: player (voluntario vía WS), timeout (paso forzado por temporizador), forfeit (abandono voluntario).';
comment on column public.match_moves.move_number is 'Número de jugada secuencial desde el inicio de la partida';
comment on column public.match_moves.board_left_end is 'Valor del extremo izquierdo después del move';
comment on column public.match_moves.board_right_end is 'Valor del extremo derecho después del move';
