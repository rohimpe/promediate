-- =====================================================================
-- Fase 3, parte D: archivos en el Google Drive del usuario.
-- =====================================================================
-- Cada curso tiene su carpeta dentro de una carpeta raíz "Tablero de Vida" en el Drive del usuario. Los archivos
-- se suben directo del navegador a Google (subida reanudable que inicia la Edge Function google-drive-upload-init)
-- y google-drive-register guarda aquí su fila con los metadatos REALES que devuelve Drive.
--
-- Ejecútala en el SQL Editor de Supabase ANTES de desplegar las funciones de Drive y publicar el código.
-- Es repetible: puedes correrla dos veces sin romper nada.
--
-- Las políticas usan SOLO user_id = (select auth.uid()): sin subconsultas a otras tablas ni a sí mismas
-- (una política que consulta su propia tabla causa "infinite recursion", error 42P17). Que course_id y task_id
-- sean del usuario lo comprueban las Edge Functions (con la service role) antes de guardar.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Ids de las carpetas en Drive (los rellenan las Edge Functions la primera vez que se sube algo).
--   profiles.drive_root_folder_id  carpeta "Tablero de Vida"
--   courses.drive_folder_id        carpeta del curso, dentro de la raíz
-- Si el usuario borra una carpeta en Drive, la función la vuelve a crear y actualiza el id.
-- Las columnas nuevas quedan cubiertas por las políticas que ya tienen profiles y courses.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists drive_root_folder_id text;

alter table public.courses
  add column if not exists drive_folder_id text;


-- ---------------------------------------------------------------------
-- 2. ARCHIVOS: lo que el usuario subió a Drive desde la app.
--   course_id  carpeta en la que está (null si se borró el curso: el archivo sigue en Drive)
--   task_id    entrega a la que está adjunto (null si no está adjunto o se borró la entrega)
--   enlace     webViewLink de Drive ("Abrir en Drive")
-- ---------------------------------------------------------------------
create table if not exists public.archivos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id      uuid references public.courses (id) on delete set null,
  task_id        uuid references public.tasks (id) on delete set null,
  drive_file_id  text not null check (char_length(drive_file_id) between 1 and 200),
  nombre         text not null check (char_length(nombre) between 1 and 255),
  mime_type      text check (char_length(mime_type) <= 255),
  tamano         bigint check (tamano >= 0),
  enlace         text check (char_length(enlace) <= 2000),
  created_at     timestamptz not null default now(),

  -- Un archivo de Drive tiene una sola fila (y permite "upsert" si se registra dos veces).
  constraint archivos_drive_file_unico unique (user_id, drive_file_id)
);

-- Para listar por curso y por entrega, y para que "on delete set null" no recorra la tabla entera.
create index if not exists archivos_course_id_idx on public.archivos (course_id);
create index if not exists archivos_task_id_idx on public.archivos (task_id);

alter table public.archivos enable row level security;

drop policy if exists "archivos: ver los propios" on public.archivos;
create policy "archivos: ver los propios"
  on public.archivos for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "archivos: crear los propios" on public.archivos;
create policy "archivos: crear los propios"
  on public.archivos for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "archivos: editar los propios" on public.archivos;
create policy "archivos: editar los propios"
  on public.archivos for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "archivos: borrar los propios" on public.archivos;
create policy "archivos: borrar los propios"
  on public.archivos for delete to authenticated
  using (user_id = (select auth.uid()));
