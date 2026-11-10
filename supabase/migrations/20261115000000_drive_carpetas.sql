-- =====================================================================
-- Fase 3, parte D: carpetas propias dentro de la carpeta de cada curso en Google Drive.
-- =====================================================================
-- El usuario puede crear carpetas (y subcarpetas, hasta 4 niveles) dentro de la carpeta de un curso. Cada fila
-- apunta a una carpeta real de Drive (drive_folder_id) que crea la Edge Function google-drive-folder.
--
-- Ejecútala en el SQL Editor de Supabase ANTES de desplegar google-drive-folder y publicar el código.
-- Requiere 20261114000000_google_drive_archivos.sql (tabla archivos). Es repetible.
--
-- Las políticas usan SOLO user_id = (select auth.uid()): sin subconsultas a otras tablas ni a sí misma
-- (una política que consulta su propia tabla causa "infinite recursion", error 42P17). Que el curso y la carpeta
-- padre sean del usuario, y la profundidad máxima, lo comprueba la Edge Function con la service role.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. CARPETAS
--   course_id  curso al que pertenece (al borrar el curso se borran sus carpetas; los archivos quedan "sin curso")
--   parent_id  carpeta que la contiene; null = directamente en la carpeta del curso.
--              Al borrar una carpeta se borran sus subcarpetas (on delete cascade).
-- ---------------------------------------------------------------------
create table if not exists public.carpetas (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id        uuid not null references public.courses (id) on delete cascade,
  parent_id        uuid references public.carpetas (id) on delete cascade,
  drive_folder_id  text not null check (char_length(drive_folder_id) between 1 and 200),
  nombre           text not null check (char_length(nombre) between 1 and 80),
  created_at       timestamptz not null default now(),

  -- Una carpeta de Drive tiene una sola fila.
  constraint carpetas_drive_folder_unica unique (user_id, drive_folder_id),
  constraint carpetas_padre_distinto check (parent_id is null or parent_id <> id)
);

-- Dos carpetas hermanas no pueden llamarse igual (sin distinguir mayúsculas: "Tareas" y "tareas" chocan).
-- parent_id null se trata como un valor más con coalesce: si no, dos carpetas "Tareas" en la raíz del curso
-- no chocarían, porque en SQL null nunca es igual a null.
create unique index if not exists carpetas_nombre_unico_idx
  on public.carpetas (
    user_id,
    course_id,
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(nombre)
  );

-- Para listar por curso y para que los "on delete" no recorran la tabla entera.
create index if not exists carpetas_course_id_idx on public.carpetas (course_id);
create index if not exists carpetas_parent_id_idx on public.carpetas (parent_id);

alter table public.carpetas enable row level security;

drop policy if exists "carpetas: ver las propias" on public.carpetas;
create policy "carpetas: ver las propias"
  on public.carpetas for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "carpetas: crear las propias" on public.carpetas;
create policy "carpetas: crear las propias"
  on public.carpetas for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "carpetas: editar las propias" on public.carpetas;
create policy "carpetas: editar las propias"
  on public.carpetas for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "carpetas: borrar las propias" on public.carpetas;
create policy "carpetas: borrar las propias"
  on public.carpetas for delete to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 2. ARCHIVOS: en qué carpeta está cada uno (null = en la carpeta del curso).
-- Si se borra la carpeta, la fila queda en null (aunque google-drive-folder ya borra antes los archivos que contenía).
-- La columna nueva queda cubierta por las políticas que ya tiene archivos.
-- ---------------------------------------------------------------------
alter table public.archivos
  add column if not exists carpeta_id uuid references public.carpetas (id) on delete set null;

create index if not exists archivos_carpeta_id_idx on public.archivos (carpeta_id);
