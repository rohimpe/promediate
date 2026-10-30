-- =====================================================================
-- evaluations: evitar la recursión infinita en las políticas RLS (error 42P17)
-- =====================================================================
-- Problema: las políticas de insert y update de "evaluations" comprobaban que el
-- nodo padre fuera del usuario con un "exists (select ... from public.evaluations ...)"
-- DENTRO de una política de la misma tabla. Postgres vuelve a aplicar las políticas
-- a esa subconsulta y entra en un bucle: "infinite recursion detected in policy".
--
-- Solución: la consulta al padre vive en una función "security definer", que corre con
-- los permisos de su dueño y por eso NO vuelve a pasar por RLS. Como ese permiso extra es
-- delicado, la función:
--   * fija "search_path = public" (nadie puede colar tablas falsas con ese nombre),
--   * comprueba por sí misma que el nodo sea del usuario (e.user_id = auth.uid()),
--   * solo la puede ejecutar el rol "authenticated" (no "anon" ni "public").
--
-- Esta migración deja la base igual que la que ya se ejecutó a mano en el SQL Editor.
-- Es idempotente: se puede correr más de una vez. Si ya coincide, no hace falta correrla
-- (verifícalo con supabase/verificar_es_nodo_propio.sql).
-- =====================================================================

-- ¿El nodo p_id existe, es del usuario y pertenece al curso p_course?
create or replace function public.es_nodo_propio(p_id uuid, p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_id
      and e.course_id = p_course
      and e.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.es_nodo_propio(uuid, uuid) from public, anon;
grant execute on function public.es_nodo_propio(uuid, uuid) to authenticated;


-- Crear: el nodo es del usuario, el curso también y, si hay padre, el padre es un nodo
-- propio de ese mismo curso.
drop policy if exists "evaluations: crear las propias" on public.evaluations;
create policy "evaluations: crear las propias" on public.evaluations
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.courses c
    where c.id = evaluations.course_id
      and c.user_id = (select auth.uid())
  )
  and (parent_id is null or public.es_nodo_propio(parent_id, course_id))
);

-- Editar: las mismas condiciones sobre la fila resultante.
drop policy if exists "evaluations: editar las propias" on public.evaluations;
create policy "evaluations: editar las propias" on public.evaluations
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.courses c
    where c.id = evaluations.course_id
      and c.user_id = (select auth.uid())
  )
  and (parent_id is null or public.es_nodo_propio(parent_id, course_id))
);
