-- =====================================================================
-- Verificación (solo lee, no modifica nada): ¿la base real coincide con la migración
-- 20261030100000_evaluations_es_nodo_propio.sql? Ejecútala en el SQL Editor de Supabase.
-- Si todo coincide, NO hace falta ejecutar la migración.
-- =====================================================================

-- 1. Definición de la función.
-- Debe verse:  LANGUAGE sql · STABLE · SECURITY DEFINER · SET search_path TO 'public'
-- y el cuerpo: select exists (select 1 from public.evaluations e where e.id = p_id
--              and e.course_id = p_course and e.user_id = (select auth.uid()))
select pg_get_functiondef('public.es_nodo_propio(uuid, uuid)'::regprocedure) as definicion;

-- 2. Permisos de ejecución de la función.
-- Debe dar: ejecuta_authenticated = true · ejecuta_anon = false · ejecuta_public = false
select
  has_function_privilege('authenticated', 'public.es_nodo_propio(uuid, uuid)', 'execute') as ejecuta_authenticated,
  has_function_privilege('anon',          'public.es_nodo_propio(uuid, uuid)', 'execute') as ejecuta_anon,
  coalesce((
    select bool_or(a.grantee = 0)   -- grantee 0 = PUBLIC
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.es_nodo_propio(uuid, uuid)'::regprocedure
  ), false) as ejecuta_public;

-- 3. Políticas de insert y update de evaluations.
-- Debe dar 2 filas, roles = {authenticated}.
--   · "crear las propias" (INSERT): with_check con user_id = auth.uid(), el exists sobre courses
--     y  (parent_id IS NULL OR es_nodo_propio(parent_id, course_id)). qual vacío.
--   · "editar las propias" (UPDATE): qual = user_id = auth.uid(); with_check igual que el de crear.
-- En NINGUNA debe aparecer "FROM evaluations" (eso era lo que causaba la recursión).
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'evaluations'
  and policyname in ('evaluations: crear las propias', 'evaluations: editar las propias')
order by policyname;

-- 4. Resumen de una línea (true = coincide; el detalle fino sigue siendo la revisión de arriba).
select
  exists (
    select 1 from pg_proc
    where oid = 'public.es_nodo_propio(uuid, uuid)'::regprocedure
      and prosecdef                                            -- security definer
      and provolatile = 's'                                    -- stable
      and 'search_path=public' = any (proconfig)
  ) as funcion_ok,
  (select count(*) = 2
   from pg_policies
   where schemaname = 'public' and tablename = 'evaluations'
     and policyname in ('evaluations: crear las propias', 'evaluations: editar las propias')
     and with_check like '%es_nodo_propio(parent_id, course_id)%'
     and with_check not ilike '%from evaluations%'
     and with_check not ilike '%from public.evaluations%') as politicas_ok;
