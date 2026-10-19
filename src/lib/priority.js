import { diasEntre, fechaEnLima, hoyEnLima } from './fechas'

// ---------------------------------------------------------------------
// Reglas de prioridad dinámica (ajústalas aquí, en un solo lugar).
// La prioridad NO se guarda en la base de datos: se calcula al mostrarla
// a partir de la prioridad base y de los días que faltan.
// ---------------------------------------------------------------------
export const DIAS_BAJA_A_MEDIA = 5 // baja  -> media cuando faltan <= 5 días
export const DIAS_MEDIA_A_ALTA = 2 // media -> alta  cuando faltan <= 2 días

// Para ordenar: número menor = más urgente.
export const ORDEN_PRIORIDAD = { alta: 0, media: 1, baja: 2 }

// Fecha ('YYYY-MM-DD') en que "vence" la tarea, o null si no tiene.
// - tarea: día de la fecha de entrega, visto desde Lima
// - actividad: la fecha de la actividad
export function fechaObjetivo(tarea) {
  if (tarea.tipo === 'tarea') {
    return tarea.fecha_entrega ? fechaEnLima(tarea.fecha_entrega) : null
  }
  return tarea.fecha_actividad ?? null
}

// Días que faltan desde hoy (en Lima). 0 = hoy, negativo = ya pasó, null = sin fecha.
export function diasRestantes(tarea, hoy = hoyEnLima()) {
  const objetivo = fechaObjetivo(tarea)
  return objetivo ? diasEntre(hoy, objetivo) : null
}

// Prioridad actual: 'alta' | 'media' | 'baja'.
export function prioridadActual(tarea, hoy = hoyEnLima()) {
  const dias = diasRestantes(tarea, hoy)
  if (dias === null) return tarea.prioridad_base

  // Vence hoy (o ya pasó): siempre alta.
  if (dias <= 0) return 'alta'

  // Las reglas se aplican en cadena: una "baja" primero sube a "media"
  // y, si además falta poco, esa "media" sube a "alta".
  let prioridad = tarea.prioridad_base
  if (prioridad === 'baja' && dias <= DIAS_BAJA_A_MEDIA) prioridad = 'media'
  if (prioridad === 'media' && dias <= DIAS_MEDIA_A_ALTA) prioridad = 'alta'
  return prioridad
}

// "Vencida" tampoco se guarda: es una tarea pendiente cuyo plazo ya pasó.
export function estaVencida(tarea, ahora = new Date()) {
  if (tarea.estado !== 'pendiente') return false
  if (tarea.tipo === 'tarea') {
    return tarea.fecha_entrega ? new Date(tarea.fecha_entrega) < ahora : false
  }
  const dias = diasRestantes(tarea, hoyEnLima(ahora))
  return dias !== null && dias < 0
}

// Ordena las tareas: primero las pendientes (por prioridad actual y luego por
// fecha más cercana); al final las completadas / justificadas.
export function ordenarPorPrioridad(tareas) {
  const hoy = hoyEnLima()
  const clave = (t) => ({
    pendiente: t.estado === 'pendiente' ? 0 : 1,
    prioridad: ORDEN_PRIORIDAD[prioridadActual(t, hoy)],
    fecha: fechaObjetivo(t) ?? '9999-12-31', // sin fecha: al final
  })

  return [...tareas].sort((a, b) => {
    const ka = clave(a)
    const kb = clave(b)
    return (
      ka.pendiente - kb.pendiente ||
      ka.prioridad - kb.prioridad ||
      ka.fecha.localeCompare(kb.fecha) ||
      a.created_at.localeCompare(b.created_at)
    )
  })
}
