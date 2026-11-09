-- =====================================================================
-- Fase 3, parte B2: "seguir" eventos de Google Calendar
-- google_seguimiento y google_series_seguidas (RLS activo, políticas por usuario)
-- =====================================================================
-- Un evento de Google que el usuario "sigue" aparece en Hoy y en Pendientes y se puede marcar
-- (Fui / Justificar). Dos tablas:
--
--   google_seguimiento      una fila por ocurrencia que el usuario siguió o marcó. Guarda un
--                           RESUMEN del evento (título, inicio, fin…), así se sigue viendo aunque
--                           Google se desconecte o el evento cambie.
--   google_series_seguidas  una fila por serie repetitiva seguida ("Clase de Física" todos los
--                           lunes). Sus ocurrencias son pendientes "virtuales": no tienen fila hasta
--                           que el usuario hace Fui o Justificar.
--
-- A diferencia de google_connections (que guarda tokens), estas tablas solo tienen datos
-- que el propio usuario puede ver, así que sí llevan políticas para "authenticated".
-- Las políticas usan SOLO user_id = (select auth.uid()): sin subconsultas a otras tablas ni a
-- sí mismas (una política que consulta su propia tabla causa "infinite recursion", error 42P17).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. GOOGLE_SEGUIMIENTO
-- google_event_id es el id de la OCURRENCIA en Google (cada ocurrencia de una serie tiene el suyo).
-- serie_id es el id de la serie repetitiva (recurringEventId de Google), null si el evento es suelto.
-- ---------------------------------------------------------------------
create table public.google_seguimiento (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  google_event_id  text not null check (char_length(google_event_id) > 0),
  serie_id         text,
  titulo           text not null check (char_length(trim(titulo)) > 0),
  inicio           timestamptz not null,
  fin              timestamptz,
  todo_el_dia      boolean not null default false,
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente', 'completada', 'justificada')),
  justificacion    text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),

  -- Una sola fila por ocurrencia y usuario: evita duplicados (y permite "upsert").
  constraint google_seguimiento_unico unique (user_id, google_event_id),
  -- Igual que en tasks: si está justificada, el motivo es obligatorio.
  constraint google_seguimiento_justificacion_obligatoria
    check (estado <> 'justificada' or char_length(trim(coalesce(justificacion, ''))) > 0)
);

-- Para pedir "lo de estos días" sin recorrer toda la tabla.
create index google_seguimiento_user_inicio_idx on public.google_seguimiento (user_id, inicio);

alter table public.google_seguimiento enable row level security;

create policy "google_seguimiento: ver los propios"
  on public.google_seguimiento for select to authenticated
  using (user_id = (select auth.uid()));

create policy "google_seguimiento: crear los propios"
  on public.google_seguimiento for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "google_seguimiento: editar los propios"
  on public.google_seguimiento for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "google_seguimiento: borrar los propios"
  on public.google_seguimiento for delete to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 2. GOOGLE_SERIES_SEGUIDAS
-- ---------------------------------------------------------------------
create table public.google_series_seguidas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  serie_id    text not null check (char_length(serie_id) > 0),
  titulo      text not null check (char_length(trim(titulo)) > 0),
  created_at  timestamptz not null default now(),

  constraint google_series_seguidas_unica unique (user_id, serie_id)
);

alter table public.google_series_seguidas enable row level security;

create policy "google_series_seguidas: ver las propias"
  on public.google_series_seguidas for select to authenticated
  using (user_id = (select auth.uid()));

create policy "google_series_seguidas: crear las propias"
  on public.google_series_seguidas for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "google_series_seguidas: editar las propias"
  on public.google_series_seguidas for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "google_series_seguidas: borrar las propias"
  on public.google_series_seguidas for delete to authenticated
  using (user_id = (select auth.uid()));
