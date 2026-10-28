-- =====================================================================
-- Reparto y descarte en los grupos de evaluaciones
-- =====================================================================
-- reparto:
--   'manual'  -> cada hijo tiene su propio peso (absoluto, % del curso)
--   'iguales' -> los hijos se reparten el peso del grupo en partes iguales;
--                su columna "peso" se ignora (se calcula en la app y no se guarda)
-- descartar_peores:
--   en modo 'iguales', cuántas de las peores notas del grupo no cuentan.
--   La app lo limita a (cantidad de hijos - 1).

alter table public.evaluations
  add column reparto text not null default 'manual'
    check (reparto in ('manual', 'iguales')),
  add column descartar_peores integer not null default 0
    check (descartar_peores >= 0);

-- No hace falta tocar RLS: las políticas de evaluations ya cubren todas las columnas.
