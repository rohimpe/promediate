-- =====================================================================
-- Fase 1: tablas iniciales de Tablero de Vida
-- profiles, courses, tasks, evaluations (todas con RLS activado)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES
-- Un perfil por usuario. Guarda datos que Supabase Auth no guarda,
-- como el nombre y la última vez que vio el "resumen del día".
-- ---------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre          text,
  ultimo_resumen  date,
  created_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: ver el propio"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: crear el propio"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles: editar el propio"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No hay política de DELETE: el perfil se borra solo cuando se borra el usuario (on delete cascade).


-- ---------------------------------------------------------------------
-- 2. COURSES
-- Los cursos del usuario (Cálculo, Física...). Cada uno tiene un color
-- para distinguirlo en la app.
-- ---------------------------------------------------------------------
create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre      text not null check (char_length(trim(nombre)) > 0),
  color       text,
  created_at  timestamptz not null default now()
);

create index courses_user_id_idx on public.courses (user_id);

alter table public.courses enable row level security;

create policy "courses: ver los propios"
  on public.courses for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "courses: crear los propios"
  on public.courses for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "courses: editar los propios"
  on public.courses for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "courses: borrar los propios"
  on public.courses for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 3. TASKS
-- Tareas (con hora de entrega) y actividades (solo con fecha).
-- La prioridad dinámica y el estado "vencida" NO se guardan: se calculan
-- en la app a partir de prioridad_base y las fechas.
-- ---------------------------------------------------------------------
create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Si se borra el curso, la tarea se conserva pero queda sin curso.
  course_id        uuid references public.courses (id) on delete set null,
  titulo           text not null check (char_length(trim(titulo)) > 0),
  descripcion      text,
  tipo             text not null default 'tarea'
                     check (tipo in ('tarea', 'actividad')),
  prioridad_base   text not null default 'media'
                     check (prioridad_base in ('alta', 'media', 'baja')),
  fecha_entrega    timestamptz,   -- solo para tareas
  fecha_actividad  date,          -- solo para actividades
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente', 'completada', 'justificada')),
  justificacion    text,
  completed_at     timestamptz,
  google_event_id  text,          -- se usará en la Fase 3 (Google Calendar)
  created_at       timestamptz not null default now(),

  -- Si está justificada, el motivo es obligatorio.
  constraint tasks_justificacion_obligatoria
    check (estado <> 'justificada' or char_length(trim(coalesce(justificacion, ''))) > 0)
);

create index tasks_user_id_idx         on public.tasks (user_id);
create index tasks_course_id_idx       on public.tasks (course_id);
create index tasks_fecha_entrega_idx   on public.tasks (user_id, fecha_entrega);
create index tasks_fecha_actividad_idx on public.tasks (user_id, fecha_actividad);

alter table public.tasks enable row level security;

create policy "tasks: ver las propias"
  on public.tasks for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Además de ser dueño de la tarea, el curso (si hay) también debe ser suyo.
create policy "tasks: crear las propias"
  on public.tasks for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      course_id is null
      or exists (
        select 1 from public.courses c
        where c.id = course_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "tasks: editar las propias"
  on public.tasks for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      course_id is null
      or exists (
        select 1 from public.courses c
        where c.id = course_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "tasks: borrar las propias"
  on public.tasks for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 4. EVALUATIONS
-- El árbol de evaluaciones de cada curso. Cada fila es un nodo con
-- nombre y peso (%). Si tiene hijos, su nota se calcula a partir de
-- ellos; si es una hoja, puede tener una nota (0 a 20).
-- parent_id apunta al nodo padre (null = nodo de primer nivel).
-- ---------------------------------------------------------------------
create table public.evaluations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  -- Si se borra un nodo, se borran también todos sus hijos.
  parent_id  uuid references public.evaluations (id) on delete cascade,
  nombre     text not null check (char_length(trim(nombre)) > 0),
  peso       numeric not null default 0 check (peso >= 0 and peso <= 100),
  nota       numeric check (nota >= 0 and nota <= 20),  -- null = aún sin nota
  orden      integer not null default 0
);

create index evaluations_user_id_idx   on public.evaluations (user_id);
create index evaluations_course_id_idx on public.evaluations (course_id);
create index evaluations_parent_id_idx on public.evaluations (parent_id);

alter table public.evaluations enable row level security;

create policy "evaluations: ver las propias"
  on public.evaluations for select
  to authenticated
  using (user_id = (select auth.uid()));

-- El curso y el nodo padre (si hay) también deben ser del mismo usuario.
create policy "evaluations: crear las propias"
  on public.evaluations for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.courses c
      where c.id = course_id and c.user_id = (select auth.uid())
    )
    and (
      parent_id is null
      or exists (
        select 1 from public.evaluations e
        where e.id = parent_id and e.user_id = (select auth.uid())
      )
    )
  );

create policy "evaluations: editar las propias"
  on public.evaluations for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.courses c
      where c.id = course_id and c.user_id = (select auth.uid())
    )
    and (
      parent_id is null
      or exists (
        select 1 from public.evaluations e
        where e.id = parent_id and e.user_id = (select auth.uid())
      )
    )
  );

create policy "evaluations: borrar las propias"
  on public.evaluations for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 5. TRIGGER: crear el perfil automáticamente al registrarse
-- Cuando Supabase Auth inserta un usuario en auth.users, esta función
-- crea su fila en public.profiles. El nombre se toma de los datos extra
-- del registro (options.data.nombre); si no viene, se usa la parte del
-- correo antes de la "@".
-- "security definer" hace que corra con permisos del dueño de la función
-- (necesario porque quien se registra aún no tiene sesión).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nombre)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
