-- =====================================================================
-- Horas de inicio y fin para las actividades
-- (las entregas siguen usando fecha_entrega, que ya incluye la hora)
-- =====================================================================

-- "time" guarda solo la hora del día (ej. 14:30), sin fecha ni zona horaria:
-- es la hora de pared en Lima, que es lo que el usuario escribe y espera ver.
-- Son nullable porque las entregas (y las actividades ya creadas) no las tienen.
alter table public.tasks
  add column hora_inicio time,
  add column hora_fin    time;

-- Si hay ambas horas, el fin debe ser posterior al inicio.
alter table public.tasks
  add constraint tasks_horas_en_orden
  check (hora_inicio is null or hora_fin is null or hora_fin > hora_inicio);

-- No hace falta tocar RLS: las políticas de "tasks" ya cubren todas las columnas
-- (cada usuario solo ve y modifica las filas con user_id = auth.uid()).
