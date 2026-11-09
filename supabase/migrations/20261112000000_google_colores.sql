-- =====================================================================
-- Colores propios para los eventos de Google Calendar.
-- =====================================================================
-- Google no devuelve los colores personalizados (colorId llega null en la mayoría de eventos), así que
-- el usuario elige el color en la app y se guarda aquí.
--
-- Cada fila pinta UN evento (google_event_id = id de la ocurrencia) o UNA serie entera (serie_id), nunca las dos
-- cosas. color_id es el número de la paleta de Google ('1' a '11'; los hex están en src/lib/calendario.js).
-- Al pintar manda el de la ocurrencia, luego el de la serie, luego el colorId de Google y al final el azul por defecto.
--
-- Las políticas usan SOLO user_id = (select auth.uid()): sin subconsultas a otras tablas ni a sí mismas
-- (una política que consulta su propia tabla causa "infinite recursion", error 42P17).
-- Es repetible: puedes ejecutarla más de una vez.
-- =====================================================================

create table if not exists public.google_colores (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  serie_id         text check (char_length(serie_id) > 0),
  google_event_id  text check (char_length(google_event_id) > 0),
  color_id         text not null check (color_id in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11')),
  created_at       timestamptz not null default now(),

  -- Exactamente uno de los dos: o pinta un evento suelto o pinta una serie.
  constraint google_colores_uno_solo check (num_nonnulls(serie_id, google_event_id) = 1),
  -- Un solo color por evento y por serie (y permite "upsert"). Los null no cuentan como iguales,
  -- así que cada restricción solo vigila su columna.
  constraint google_colores_serie_unica unique (user_id, serie_id),
  constraint google_colores_evento_unico unique (user_id, google_event_id)
);

alter table public.google_colores enable row level security;

drop policy if exists "google_colores: ver los propios" on public.google_colores;
create policy "google_colores: ver los propios"
  on public.google_colores for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "google_colores: crear los propios" on public.google_colores;
create policy "google_colores: crear los propios"
  on public.google_colores for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "google_colores: editar los propios" on public.google_colores;
create policy "google_colores: editar los propios"
  on public.google_colores for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "google_colores: borrar los propios" on public.google_colores;
create policy "google_colores: borrar los propios"
  on public.google_colores for delete to authenticated
  using (user_id = (select auth.uid()));
