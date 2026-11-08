-- Solo LEE (no cambia nada). Verifica que google_oauth_states y google_connections
-- tengan RLS activo y CERO políticas, y que la función mi_conexion_google esté bien cerrada.

-- 1) RLS y número de políticas por tabla.
--    Esperado: rls_activo = true y politicas = 0 en las dos filas.
select
  c.relname                                   as tabla,
  c.relrowsecurity                            as rls_activo,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('google_oauth_states', 'google_connections')
order by c.relname;

-- 2) Permisos de tabla para anon y authenticated.
--    Esperado: ninguna fila.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('google_oauth_states', 'google_connections')
  and grantee in ('anon', 'authenticated', 'public');

-- 3) Quién puede ejecutar mi_conexion_google.
--    Esperado: authenticated = true; anon = false; public = false.
select
  has_function_privilege('authenticated', 'public.mi_conexion_google()', 'execute') as authenticated,
  has_function_privilege('anon',          'public.mi_conexion_google()', 'execute') as anon,
  exists (
    select 1
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.mi_conexion_google()'::regprocedure and a.grantee = 0
  ) as public_;
