import { hoyEnLima, instanteLima } from './fechas'
import { sincronizarConGoogle } from './googleApi'
import { actualizarTarea, borrarTarea, crearTarea } from './tasksApi'

// ---------------------------------------------------------------------
// Pendientes de la app como eventos de Google Calendar (Fase 3, parte C).
// El evento lo arma la Edge Function google-calendar-sync; aquí solo se decide CUÁNDO llamarla.
// Regla de oro: el pendiente se guarda SIEMPRE primero. Si Google falla no se pierde nada: la tarea queda con
// google_sync = 'pendiente' o 'error' y la app ofrece "Reintentar".
// ---------------------------------------------------------------------

// Si la función ni siquiera respondió (sin internet, función caída…).
const ERROR_SIN_RESPUESTA = 'No se pudo conectar con Google Calendar.'

// Campos de `tasks` que cambian el evento de Google (título, fechas, horas, estado → prefijo y color…).
const CAMPOS_DEL_EVENTO = [
  'titulo',
  'descripcion',
  'tipo',
  'course_id',
  'fecha_entrega',
  'fecha_actividad',
  'hora_inicio',
  'hora_fin',
  'estado',
]

// ¿El pendiente está en Google, o pudo quedar ahí? ('pendiente' / 'error': quizá Google lo creó y no lo supimos).
export function estaEnGoogle(tarea) {
  return !!tarea.google_event_id || (tarea.google_sync ?? 'ninguno') !== 'ninguno'
}

export function cambiaElEvento(campos) {
  return CAMPOS_DEL_EVENTO.some((c) => c in campos)
}

// Qué hacer en Google después de editar un pendiente:
//   anadirAGoogle true  -> crearlo, o actualizarlo si ya estaba
//   anadirAGoogle false -> si estaba, borrar el evento (el usuario apagó el interruptor)
//   undefined           -> sin interruptor (Google no conectado): solo actualizar si ya estaba
export function accionTrasEditar(tarea, campos, anadirAGoogle) {
  const enGoogle = estaEnGoogle(tarea)
  if (anadirAGoogle === true) return enGoogle ? (cambiaElEvento(campos) ? 'actualizar' : null) : 'crear'
  if (anadirAGoogle === false) return enGoogle ? 'borrar' : null
  return enGoogle && cambiaElEvento(campos) ? 'actualizar' : null
}

// Llama a la función y devuelve { estado, cambios }: `cambios` son las columnas de Google de la tarea tal como
// quedaron, para mezclarlas en la lista en pantalla sin recargar. Nunca lanza error.
export async function sincronizarTarea(accion, tareaId) {
  const r = await sincronizarConGoogle(accion, tareaId)
  if (r.google_sync != null) {
    const { google_event_id, google_sync, google_sync_error } = r
    return { estado: r.estado, cambios: { google_event_id, google_sync, google_sync_error } }
  }
  if (accion === 'borrar') return { estado: r.estado, cambios: null } // la fila se borra igual

  // La función no respondió: se deja constancia en la tarea para ofrecer "Reintentar".
  const cambios = { google_sync: 'error', google_sync_error: ERROR_SIN_RESPUESTA }
  await actualizarTarea(tareaId, cambios).catch(() => {}) // el error ya se registró en consola
  return { estado: 'error', cambios }
}

// Crea un pendiente y, si se pidió, su evento en Google. Devuelve la fila con el estado de Google ya al día.
export async function crearPendiente(campos, { anadirAGoogle = false } = {}) {
  const nueva = await crearTarea(anadirAGoogle ? { ...campos, google_sync: 'pendiente' } : campos)
  if (!anadirAGoogle) return nueva
  const { cambios } = await sincronizarTarea('crear', nueva.id)
  return { ...nueva, ...cambios }
}

// Guarda los cambios de un pendiente y los refleja en Google (ver accionTrasEditar).
export async function actualizarPendiente(tarea, campos, { anadirAGoogle } = {}) {
  await actualizarTarea(tarea.id, campos)
  const accion = accionTrasEditar(tarea, campos, anadirAGoogle)
  if (accion) await sincronizarTarea(accion, tarea.id)
}

// Borra un pendiente. Si estaba en Google, primero borra el evento; si eso falla, borra la tarea de todos modos.
// Devuelve { eventoQuedo }: true si el evento pudo quedar en Google (para avisar al usuario).
export async function borrarPendiente(tarea) {
  let eventoQuedo = false
  if (estaEnGoogle(tarea)) {
    const { estado } = await sincronizarTarea('borrar', tarea.id)
    eventoQuedo = estado !== 'ok'
  }
  await borrarTarea(tarea.id)
  return { eventoQuedo }
}

// ¿El pendiente todavía no pasó? Entrega: su hora límite es futura. Actividad: aún no terminó (hora de Lima).
function esFuturo(t, ahora) {
  if (t.tipo === 'tarea') return !!t.fecha_entrega && new Date(t.fecha_entrega) > ahora
  if (!t.fecha_actividad) return false
  const hoy = hoyEnLima(ahora)
  if (t.fecha_actividad !== hoy) return t.fecha_actividad > hoy
  return !t.hora_fin || instanteLima(t.fecha_actividad, t.hora_fin) > ahora
}

// Los que crea "Sincronizar mis pendientes existentes": futuros, sin completar y sin evento en Google.
export function pendientesParaSincronizar(tareas, ahora = new Date()) {
  return tareas.filter((t) => t.estado === 'pendiente' && !t.google_event_id && esFuturo(t, ahora))
}

const MAX_EN_PARALELO = 5

// Crea en Google el evento de cada tarea, de a 5 a la vez (para no saturar a Google ni al navegador).
// alAvanzar({ hechos, fallidos }) se llama después de cada una. Devuelve { hechos, fallidos } al final.
export async function sincronizarVarias(tareas, alAvanzar) {
  let siguiente = 0
  let hechos = 0
  let fallidos = 0

  async function trabajador() {
    while (siguiente < tareas.length) {
      const t = tareas[siguiente++]
      const { estado } = await sincronizarTarea('crear', t.id)
      if (estado === 'ok') hechos++
      else fallidos++
      alAvanzar?.({ hechos, fallidos })
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_EN_PARALELO, tareas.length) }, trabajador))
  return { hechos, fallidos }
}
