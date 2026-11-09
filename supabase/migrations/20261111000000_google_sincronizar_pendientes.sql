-- =====================================================================
-- Fase 3, parte C: los pendientes de la app (entregas y actividades) se crean y sincronizan
-- como eventos en el Google Calendar del usuario.
-- =====================================================================
-- Ejecútala en el SQL Editor de Supabase ANTES de desplegar google-calendar-sync y publicar el código.
-- Es repetible: puedes correrla dos veces sin romper nada.
--
-- tasks.google_event_id ya existe desde la Fase 1 (no se vuelve a crear).
--
-- No se tocan políticas: tasks y profiles ya tienen RLS con user_id / id = auth.uid(), y las
-- columnas nuevas quedan cubiertas por esas mismas políticas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TASKS: estado de la sincronización con Google
--   google_sync        'ninguno'   el pendiente no está en Google (o el usuario no lo quiso)
--                      'ok'        el evento en Google está al día
--                      'pendiente' se pidió crearlo y todavía no hay respuesta (o la llamada no llegó)
--                      'error'     Google falló: la app muestra "Reintentar"
--   google_sync_error  mensaje GENÉRICO para el usuario (nunca tokens ni contenido de Google)
-- ---------------------------------------------------------------------
alter table public.tasks
  add column if not exists google_event_id text; -- por si la base no viene de la Fase 1 (no hace nada si ya existe)

alter table public.tasks
  add column if not exists google_sync text not null default 'ninguno';

alter table public.tasks drop constraint if exists tasks_google_sync_check;
alter table public.tasks
  add constraint tasks_google_sync_check check (google_sync in ('ninguno', 'ok', 'pendiente', 'error'));

alter table public.tasks
  add column if not exists google_sync_error text;

alter table public.tasks drop constraint if exists tasks_google_sync_error_largo;
alter table public.tasks
  add constraint tasks_google_sync_error_largo check (char_length(google_sync_error) <= 200);

-- Los pendientes que ya tenían evento en Google (si hubiera alguno) quedan como sincronizados.
update public.tasks
  set google_sync = 'ok'
  where google_event_id is not null and google_sync = 'ninguno';


-- ---------------------------------------------------------------------
-- 2. PROFILES: ¿crear los pendientes nuevos en Google automáticamente?
-- Es el valor por defecto del interruptor "Añadir a Google Calendar" del formulario.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists google_sincronizar boolean not null default true;
