-- =====================================================================
-- Pesos de evaluations: de ABSOLUTOS (% del curso) a RELATIVOS AL PADRE
-- =====================================================================
-- Antes: PCs 28% (del curso) -> PC1 14%, PC2 14%.
-- Ahora: PCs 40% (de Continua 70%) -> PC1 50% (de PCs), PC2 50%.
--        Los hijos de cada nodo suman 100, y los de primer nivel también.
--
-- Conversión de cada hijo:   peso_nuevo = peso / peso_del_padre × 100
--   * "peso_del_padre" es el peso ANTIGUO y EFECTIVO del padre (% del curso). Se
--     calcula todo en una sola sentencia sobre los datos originales, así que nunca
--     se usan valores ya convertidos (los nietos se convierten con el padre viejo).
--   * Primer nivel: no cambia (ya era % del curso y suma 100).
--   * Hijos de un grupo 'iguales': no cambian. La app ignora su peso (cada uno vale
--     100 / (hijos - descartes) y se calcula solo). Para calcular a sus propios hijos
--     sí se usa el peso efectivo del grupo: peso del padre / (hijos - descartes).
--   * Padre con peso 0: se evita dividir entre cero y sus hijos se dejan igual
--     (la app mostrará "faltan X% para completar…" y los corriges a mano).
--   * Si los hermanos ya suman 100, se dejan igual: o ya son relativos (por si esto se
--     ejecuta dos veces) o el padre vale 100 y dividir por 100 y multiplicar por 100 no cambia nada.
--   * Un hijo que pesara más que su padre daría más de 100; como la columna exige
--     peso <= 100, se topa en 100 (la consulta 1 de supabase/diagnostico_pesos.sql avisa cuáles).
--   * Las NOTAS no se tocan: solo se modifica la columna peso.
--
-- ANTES de ejecutar: corre supabase/diagnostico_pesos.sql (consulta 1), revisa la columna
-- "problema" y exporta el resultado a CSV como respaldo (la migración no tiene "deshacer").
--
-- VISTA PREVIA sin modificar nada: ejecuta solo el bloque WITH ... y reemplaza el
-- "update" final por:
--   select e.nombre, e.peso as antes, n.peso_nuevo as despues
--   from nuevo n join public.evaluations e on e.id = n.id
--   order by e.course_id, e.parent_id nulls first, e.orden;
-- =====================================================================

with recursive
  -- Cantidad de hijos y suma de sus pesos, por padre
  hermanos as (
    select parent_id, count(*) as n, sum(peso) as suma
    from public.evaluations
    where parent_id is not null
    group by parent_id
  ),
  -- Peso ANTIGUO efectivo de cada nodo (% del curso), tal como lo calculaba la app
  viejo as (
    select e.id, e.peso as peso_abs
    from public.evaluations e
    where e.parent_id is null

    union all

    select
      h.id,
      case
        when p.reparto = 'iguales'
          then v.peso_abs / (hm.n - least(p.descartar_peores, hm.n - 1))
        else h.peso
      end
    from public.evaluations h
    join public.evaluations p on p.id = h.parent_id
    join viejo v on v.id = h.parent_id
    join hermanos hm on hm.parent_id = h.parent_id
  ),
  -- Peso nuevo (relativo al padre) de cada hijo
  nuevo as (
    select
      h.id,
      case
        when p.reparto = 'iguales' then h.peso                  -- la app lo ignora
        when abs(hm.suma - 100) < 0.01 then h.peso              -- ya suma 100
        when v.peso_abs = 0 then h.peso                         -- evita dividir entre cero
        else least(100, round(h.peso / v.peso_abs * 100, 4))
      end as peso_nuevo
    from public.evaluations h
    join public.evaluations p on p.id = h.parent_id
    join viejo v on v.id = h.parent_id
    join hermanos hm on hm.parent_id = h.parent_id
  )
update public.evaluations e
set peso = n.peso_nuevo
from nuevo n
where n.id = e.id
  and e.peso is distinct from n.peso_nuevo;

-- No hace falta tocar RLS: las políticas de evaluations ya cubren todas las columnas.
