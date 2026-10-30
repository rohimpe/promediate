-- =====================================================================
-- DIAGNÓSTICO de pesos de evaluations (SOLO LECTURA, no modifica nada)
-- =====================================================================
-- Para qué sirve: ver cómo están hoy los cursos (modelo ABSOLUTO) y qué pasaría
-- con la migración 20261030000000_pesos_relativos.sql, ANTES de ejecutarla.
-- No es una migración: por eso está fuera de supabase/migrations/.
--
-- Cómo usarlo: Supabase -> SQL Editor -> pega UNA consulta a la vez y pulsa Run
-- (el editor solo muestra el resultado de la última). Corre con permisos de
-- administrador, así que ve los datos de TODOS los usuarios (columna "usuario").
--
-- Qué es cada columna de la consulta 1:
--   peso_guardado   lo que hay en la columna evaluations.peso hoy
--   peso_abs        peso EFECTIVO actual (% del curso). En partes iguales se calcula
--                   como la app: peso del grupo / (hijos - descartes)
--   suma_hijos      suma de los pesos guardados de sus hijos
--   peso_nuevo      lo que quedaría guardado tras la migración (vista previa)
--   problema        vacío = todo bien; si no, qué está raro
-- =====================================================================


-- ---------------------------------------------------------------------
-- CONSULTA 1: el árbol de cada curso, con vista previa y problemas
-- (para ver solo los problemas, agrega al final:  where problema <> '' )
-- ---------------------------------------------------------------------
with recursive
  hermanos as (
    select parent_id, count(*) as n, sum(peso) as suma
    from public.evaluations
    where parent_id is not null
    group by parent_id
  ),
  viejo as (
    select e.id, 0 as nivel, e.peso as peso_abs, array[e.orden] as ruta
    from public.evaluations e
    where e.parent_id is null

    union all

    select
      h.id,
      v.nivel + 1,
      case when p.reparto = 'iguales'
        then v.peso_abs / (hm.n - least(p.descartar_peores, hm.n - 1))
        else h.peso
      end,
      v.ruta || h.orden
    from public.evaluations h
    join public.evaluations p on p.id = h.parent_id
    join viejo v on v.id = h.parent_id
    join hermanos hm on hm.parent_id = h.parent_id
  ),
  detalle as (
    select
      e.*,
      v.nivel,
      v.ruta,
      v.peso_abs,
      p.reparto as reparto_padre,
      p.course_id as curso_del_padre,
      pv.peso_abs as peso_abs_padre,
      sib.suma as suma_hermanos,
      kids.suma as suma_hijos,
      case
        when e.parent_id is null then e.peso
        when p.reparto = 'iguales' then e.peso                  -- la app lo ignora
        when abs(sib.suma - 100) < 0.01 then e.peso             -- ya suma 100
        when pv.peso_abs = 0 then e.peso                        -- sin dividir entre cero
        else least(100, round(e.peso / pv.peso_abs * 100, 4))
      end as peso_nuevo
    from public.evaluations e
    join viejo v on v.id = e.id
    left join public.evaluations p on p.id = e.parent_id
    left join viejo pv on pv.id = e.parent_id
    left join hermanos sib on sib.parent_id = e.parent_id
    left join hermanos kids on kids.parent_id = e.id
  )
select
  u.email as usuario,
  c.nombre as curso,
  repeat('    ', d.nivel) || d.nombre as nodo,
  d.reparto,
  d.descartar_peores as descartes,
  d.peso as peso_guardado,
  round(d.peso_abs, 4) as peso_abs,
  d.suma_hijos,
  d.peso_nuevo,
  d.nota,
  concat_ws('; ',
    case when d.curso_del_padre is not null and d.curso_del_padre <> d.course_id
      then 'el padre es de OTRO curso' end,
    case when d.suma_hijos is not null and d.reparto = 'manual'
              and abs(d.suma_hijos - d.peso_abs) >= 0.01
              and abs(d.suma_hijos - 100) < 0.01
      then 'sus hijos suman 100: parece que YA son relativos' end,
    case when d.suma_hijos is not null and d.reparto = 'manual'
              and abs(d.suma_hijos - d.peso_abs) >= 0.01
              and abs(d.suma_hijos - 100) >= 0.01
      then 'sus hijos suman ' || round(d.suma_hijos, 2) || ' y deberían sumar ' || round(d.peso_abs, 2) end,
    case when d.suma_hijos is not null and d.peso_abs = 0
      then 'pesa 0: sus hijos NO se convierten (se dejan igual)' end,
    case when d.reparto_padre = 'manual' and d.peso_abs_padre > 0 and d.peso > d.peso_abs_padre + 0.01
      then 'pesa más que su padre: quedaría capado en 100' end,
    case when d.suma_hijos is not null and d.nota is not null
      then 'tiene nota Y subdivisiones (la nota no cuenta)' end
  ) as problema
from detalle d
join public.courses c on c.id = d.course_id
left join auth.users u on u.id = d.user_id
order by u.email, c.nombre, d.ruta;


-- ---------------------------------------------------------------------
-- CONSULTA 2: ¿el primer nivel de cada curso suma 100? (el primer nivel no cambia)
-- ---------------------------------------------------------------------
-- select u.email as usuario, c.nombre as curso, sum(e.peso) as suma_primer_nivel,
--        case when abs(sum(e.peso) - 100) < 0.01 then 'ok' else 'NO SUMA 100' end as estado
-- from public.evaluations e
-- join public.courses c on c.id = e.course_id
-- left join auth.users u on u.id = e.user_id
-- where e.parent_id is null
-- group by u.email, c.nombre
-- order by u.email, c.nombre;


-- ---------------------------------------------------------------------
-- CONSULTA 3 (para DESPUÉS de migrar): grupos que no suman 100
-- Debe devolver 0 filas, salvo grupos 'iguales' (se calculan solos) o que ya
-- estuvieran mal antes (los marcó la consulta 1).
-- ---------------------------------------------------------------------
-- select u.email as usuario, c.nombre as curso, coalesce(p.nombre, '(primer nivel)') as grupo,
--        p.reparto, round(sum(e.peso), 2) as suma
-- from public.evaluations e
-- join public.courses c on c.id = e.course_id
-- left join public.evaluations p on p.id = e.parent_id
-- left join auth.users u on u.id = e.user_id
-- where coalesce(p.reparto, 'manual') = 'manual'
-- group by u.email, c.nombre, p.id, p.nombre, p.reparto
-- having abs(sum(e.peso) - 100) >= 0.01
-- order by u.email, c.nombre, grupo;
