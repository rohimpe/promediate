-- =====================================================================
-- Pesos de evaluations: de RELATIVOS al padre a ABSOLUTOS del curso
-- =====================================================================
-- Antes: cada nivel sumaba 100 (PCs 40% "de la evaluación continua").
-- Ahora: cada peso es % del curso entero; los hijos suman el peso del padre
--        (Continua 70% -> PCs 28% + Tareas 21% + Proyecto 21%).
--
-- La conversión se decide GRUPO POR GRUPO (los hijos de un mismo padre), así
-- funciona aunque haya datos mezclados y se puede ejecutar más de una vez:
--   * si los hijos suman lo mismo que el peso original del padre, ya estaban en
--     absoluto: se conservan (solo se reescalan si el padre cambió al convertirse);
--   * si no (lo normal: suman 100), eran relativos:
--       peso_absoluto = peso_absoluto_del_padre × peso / 100
-- Los nodos de primer nivel no cambian. Las notas NO se tocan.
--
-- VISTA PREVIA (opcional, no modifica nada): ejecuta solo el bloque WITH ... SELECT
-- de más abajo cambiando el "update ..." final por:
--   select e.nombre, a.peso_original, a.peso_absoluto
--   from arbol a join public.evaluations e on e.id = a.id
--   order by e.course_id, e.parent_id nulls first, e.orden;
-- =====================================================================

with recursive
  -- Suma ORIGINAL de los pesos de cada grupo de hermanos
  sumas as (
    select parent_id, sum(peso) as suma
    from public.evaluations
    where parent_id is not null
    group by parent_id
  ),
  arbol as (
    -- Primer nivel: ya es % del curso
    select e.id, e.peso as peso_original, e.peso as peso_absoluto
    from public.evaluations e
    where e.parent_id is null

    union all

    -- Hijos: se convierten a partir del padre (ya convertido)
    select
      h.id,
      h.peso,
      case
        -- Ya absoluto: los hermanos suman el peso original del padre
        when a.peso_original > 0 and abs(s.suma - a.peso_original) < 0.01
          then round(h.peso * a.peso_absoluto / a.peso_original, 4)
        -- Relativo (cada nivel sumaba 100)
        else round(a.peso_absoluto * h.peso / 100, 4)
      end
    from public.evaluations h
    join arbol a on a.id = h.parent_id
    join sumas s on s.parent_id = h.parent_id
  )
update public.evaluations e
set peso = a.peso_absoluto
from arbol a
where a.id = e.id
  and e.peso is distinct from a.peso_absoluto;
