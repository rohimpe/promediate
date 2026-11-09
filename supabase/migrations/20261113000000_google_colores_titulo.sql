-- =====================================================================
-- Color por título para los eventos de Google Calendar.
-- =====================================================================
-- Además de pintar una ocurrencia (google_event_id) o una serie (serie_id), una fila de google_colores puede
-- pintar TODOS los eventos con el mismo título (titulo_norm). Sirve para eventos que Google no marca como serie
-- (por ejemplo, el mismo curso creado a mano varias veces).
--
-- titulo_norm lo calcula la app (src/lib/seguimiento.js, normalizarTitulo): el título en minúsculas, sin espacios
-- al inicio ni al final y sin tildes. La base solo guarda lo que llega; no lo recalcula.
--
-- Al pintar manda: 1) la ocurrencia, 2) la serie, 3) el título, 4) el colorId de Google, 5) el azul #039be5.
--
-- Requiere haber ejecutado antes 20261112000000_google_colores.sql.
-- Las políticas siguen usando SOLO user_id = (select auth.uid()): sin subconsultas a otras tablas ni a sí mismas
-- (una política que consulta su propia tabla causa "infinite recursion", error 42P17).
-- Es repetible: puedes ejecutarla más de una vez.
-- =====================================================================

alter table public.google_colores
  add column if not exists titulo_norm text;

-- Un título normalizado vacío no tiene sentido.
alter table public.google_colores
  drop constraint if exists google_colores_titulo_norm_no_vacio;
alter table public.google_colores
  add constraint google_colores_titulo_norm_no_vacio check (titulo_norm is null or char_length(titulo_norm) > 0);

-- Antes: exactamente uno de serie_id o google_event_id. Ahora: exactamente uno de los tres.
alter table public.google_colores
  drop constraint if exists google_colores_uno_solo;
alter table public.google_colores
  add constraint google_colores_uno_solo check (num_nonnulls(serie_id, google_event_id, titulo_norm) = 1);

-- Un solo color por título y por usuario (y permite "upsert" sobre (user_id, titulo_norm)).
alter table public.google_colores
  drop constraint if exists google_colores_titulo_unico;
alter table public.google_colores
  add constraint google_colores_titulo_unico unique (user_id, titulo_norm);

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
