// En la base de datos el tipo se guarda como 'tarea' o 'actividad'.
// En pantalla, 'tarea' se llama "Entrega" (algo de la universidad con fecha límite)
// y 'actividad' se llama "Actividad" (algo personal con fecha y horario).
export const NOMBRE_TIPO = {
  tarea: 'Entrega',
  actividad: 'Actividad',
}

// 'HH:MM:SS' (como devuelve Postgres) -> 'HH:MM'
export function recortarHora(hora) {
  return hora ? hora.slice(0, 5) : ''
}
