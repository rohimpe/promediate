-- =====================================================================
-- Fase 3, parte A: conectar la cuenta de Google de cada usuario
-- google_oauth_states y google_connections (RLS activo y SIN políticas)
-- =====================================================================
-- Estas dos tablas guardan datos delicados (el refresh token de Google, aunque cifrado).
-- Por eso el frontend NO puede leerlas ni escribirlas: tienen RLS activado y ninguna
-- política para "authenticated" ni "anon". Solo las usan las Edge Functions con la
-- service role, que se salta RLS. Además se revocan los permisos de tabla a esos roles
-- (doble candado: aunque alguien creara una política por error, seguiría sin permiso).
--
-- Lo único que ve el frontend es la función mi_conexion_google() (más abajo), que
-- devuelve el estado de la conexión sin ningún token.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. GOOGLE_OAUTH_STATES
-- Un "state" es un código aleatorio de un solo uso que une el viaje de ida a Google con
-- el de vuelta (callback). Sirve para saber QUÉ usuario inició la conexión.
-- Dura 10 minutos. Los vencidos se borran al crear uno nuevo (función google-connect).
-- ---------------------------------------------------------------------
create table public.google_oauth_states (
  state       text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  expira_en   timestamptz not null default (now() + interval '10 minutes'),
  created_at  timestamptz not null default now()
);

create index google_oauth_states_expira_en_idx on public.google_oauth_states (expira_en);

alter table public.google_oauth_states enable row level security;
revoke all on public.google_oauth_states from anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. GOOGLE_CONNECTIONS
-- Una conexión por usuario. El refresh token se guarda CIFRADO (AES-GCM) con la clave
-- TOKEN_ENCRYPTION_KEY, que solo existe como secret de las Edge Functions.
-- estado: 'activa' (funciona) o 'reconectar' (Google rechazó el token: hay que volver a conectar).
-- ---------------------------------------------------------------------
create table public.google_connections (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  refresh_token_cifrado text not null,
  scopes                text,
  email_google          text,
  estado                text not null default 'activa' check (estado in ('activa', 'reconectar')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. mi_conexion_google()
-- Lo que el frontend puede saber: si hay conexión, con qué correo y en qué estado.
-- "security definer" = corre con los permisos de su dueño, así puede leer la tabla
-- aunque el usuario no tenga acceso. Por eso:
--   * fija "search_path = public",
--   * solo devuelve la fila de auth.uid() (nunca la de otro usuario),
--   * NO devuelve el token,
--   * solo la puede ejecutar el rol "authenticated".
-- Siempre devuelve exactamente una fila (conectado = false si no hay conexión).
-- ---------------------------------------------------------------------
create or replace function public.mi_conexion_google()
returns table (conectado boolean, email_google text, estado text)
language sql
stable
security definer
set search_path = public
as $$
  select (c.user_id is not null), c.email_google, c.estado
  from (select 1) base
  left join public.google_connections c on c.user_id = (select auth.uid());
$$;

revoke execute on function public.mi_conexion_google() from public, anon;
grant execute on function public.mi_conexion_google() to authenticated;
