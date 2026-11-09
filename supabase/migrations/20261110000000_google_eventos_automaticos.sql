-- =====================================================================
-- Fase 3, parte B2 (versión definitiva): los eventos de Google Calendar entran AUTOMÁTICAMENTE
-- a Hoy y Pendientes, y el usuario quita los que no quiera.
-- =====================================================================
-- Reemplaza el diseño anterior de "seguir eventos" (migración 20261109000000_google_seguimiento.sql).
-- Puedes ejecutarla tanto si ya corriste esa migración como si no: es repetible y deja la base igual.
--
-- Qué queda al final:
--   google_seguimiento  SOLO los eventos que el usuario marcó (Fui = completada, o justificada).
--                       Los pendientes son "virtuales": salen de Google y no se guardan.
--                       Guarda un RESUMEN del evento (título, inicio, fin…), así se sigue viendo
--                       aunque Google se desconecte o el evento cambie.
--   google_ocultos      eventos sueltos o series enteras que el usuario quitó de sus pendientes.
--   profiles.google_incluir_todo_el_dia   si los eventos de todo el día también entran a pendientes.
--
-- Qué se elimina del diseño anterior:
--   google_series_seguidas   ya no hace falta (ahora todo entra salvo lo oculto).
--   las filas de google_seguimiento con estado 'pendiente' (eran solo "lo sigo"; ahora entran solos).
--
-- Qué se conserva: las filas ya marcadas (completada / justificada) de google_seguimiento.
--
-- Las políticas usan SOLO user_id = (select auth.uid()): sin subconsultas a otras tablas ni a sí
-- mismas (una política que consulta su propia tabla causa "infinite recursion", error 42P17).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. GOOGLE_SEGUIMIENTO (eventos marcados)
-- Si la tabla ya existe (diseño anterior) no se toca su contenido; más abajo se ajusta.
-- google_event_id es el id de la OCURRENCIA en Google (cada ocurrencia de una serie tiene el suyo).
-- serie_id es el id de la serie repetitiva (recurringEventId de Google), null si el evento es suelto.
-- ---------------------------------------------------------------------
create table if not exists public.google_seguimiento (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  google_event_id  text not null check (char_length(google_event_id) > 0),
  serie_id         text,
  titulo           text not null check (char_length(trim(titulo)) > 0),
  inicio           timestamptz not null,
  fin              timestamptz,
  todo_el_dia      boolean not null default false,
  estado           text not null,
  justificacion    text,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),

  -- Una sola fila por ocurrencia y usuario: evita duplicados (y permite "upsert").
  constraint google_seguimiento_unico unique (user_id, google_event_id)
);

-- Diseño anterior: las filas 'pendiente' solo decían "sigo este evento"; ahora no se guardan.
delete from public.google_seguimiento where estado = 'pendiente';

-- Ahora una fila existe solo si el evento está completado o justificado.
alter table public.google_seguimiento drop constraint if exists google_seguimiento_estado_check;
alter table public.google_seguimiento
  add constraint google_seguimiento_estado_check check (estado in ('completada', 'justificada'));
alter table public.google_seguimiento alter column estado drop default;

-- Igual que en tasks: si está justificada, el motivo es obligatorio.
alter table public.google_seguimiento drop constraint if exists google_seguimiento_justificacion_obligatoria;
alter table public.google_seguimiento
  add constraint google_seguimiento_justificacion_obligatoria
  check (estado <> 'justificada' or char_length(trim(coalesce(justificacion, ''))) > 0);

-- Para pedir "lo de estos días" sin recorrer toda la tabla.
create index if not exists google_seguimiento_user_inicio_idx on public.google_seguimiento (user_id, inicio);

alter table public.google_seguimiento enable row level security;

drop policy if exists "google_seguimiento: ver los propios" on public.google_seguimiento;
create policy "google_seguimiento: ver los propios"
  on public.google_seguimiento for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "google_seguimiento: crear los propios" on public.google_seguimiento;
create policy "google_seguimiento: crear los propios"
  on public.google_seguimiento for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "google_seguimiento: editar los propios" on public.google_seguimiento;
create policy "google_seguimiento: editar los propios"
  on public.google_seguimiento for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "google_seguimiento: borrar los propios" on public.google_seguimiento;
create policy "google_seguimiento: borrar los propios"
  on public.google_seguimiento for delete to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 2. GOOGLE_OCULTOS (lo que el usuario quitó de sus pendientes)
-- Cada fila oculta UN evento (google_event_id) o UNA serie entera (serie_id), nunca las dos cosas.
-- ---------------------------------------------------------------------
create table if not exists public.google_ocultos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  google_event_id  text check (char_length(google_event_id) > 0),
  serie_id         text check (char_length(serie_id) > 0),
  titulo           text not null check (char_length(trim(titulo)) > 0),
  created_at       timestamptz not null default now(),

  -- Exactamente uno de los dos: o es un evento suelto o es una serie.
  constraint google_ocultos_uno_solo check (num_nonnulls(google_event_id, serie_id) = 1),
  -- Sin duplicados (los null no cuentan como iguales, así que cada restricción solo vigila su columna).
  constraint google_ocultos_evento_unico unique (user_id, google_event_id),
  constraint google_ocultos_serie_unica unique (user_id, serie_id)
);

alter table public.google_ocultos enable row level security;

drop policy if exists "google_ocultos: ver los propios" on public.google_ocultos;
create policy "google_ocultos: ver los propios"
  on public.google_ocultos for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "google_ocultos: crear los propios" on public.google_ocultos;
create policy "google_ocultos: crear los propios"
  on public.google_ocultos for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "google_ocultos: editar los propios" on public.google_ocultos;
create policy "google_ocultos: editar los propios"
  on public.google_ocultos for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "google_ocultos: borrar los propios" on public.google_ocultos;
create policy "google_ocultos: borrar los propios"
  on public.google_ocultos for delete to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 3. PROFILES: ¿los eventos de todo el día entran a pendientes?
-- Por defecto no (suelen ser feriados, cumpleaños…). profiles ya tiene RLS y políticas.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists google_incluir_todo_el_dia boolean not null default false;


-- ---------------------------------------------------------------------
-- 4. Limpieza del diseño anterior
-- Las series que el usuario "seguía" ya no se necesitan: ahora todo entra salvo lo oculto.
-- ---------------------------------------------------------------------
drop table if exists public.google_series_seguidas;
