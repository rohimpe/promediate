import { formatearFechaHora } from './fechas'

// En la base de datos el tipo se guarda como 'tarea' o 'actividad'.
// En pantalla, 'tarea' se llama "Entrega" (algo de la universidad con fecha límite)
// y 'actividad' se llama "Actividad" (algo personal con fecha y horario).
export const NOMBRE_TIPO = {
  tarea: 'Entrega',
  actividad: 'Actividad',
}

// Hora límite que se propone en las entregas nuevas.
export const HORA_ENTREGA_POR_DEFECTO = '23:59'

// 'HH:MM:SS' (como devuelve Postgres) -> 'HH:MM'
export function recortarHora(hora) {
  return hora ? hora.slice(0, 5) : ''
}

// Hora de un pendiente para mostrar: entrega -> '14:30' (hora límite) ; actividad -> '14:00–16:00'.
// Devuelve '' si no tiene hora.
export function horarioTarea(t) {
  if (t.tipo === 'tarea') return t.fecha_entrega ? formatearFechaHora(t.fecha_entrega).split(', ')[1] : ''
  return t.hora_inicio && t.hora_fin ? `${recortarHora(t.hora_inicio)}–${recortarHora(t.hora_fin)}` : ''
}
