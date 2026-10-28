import { formatearFecha, formatearFechaHora, textoPlazo } from '../lib/fechas'
import { diasRestantes, estaVencida, prioridadActual } from '../lib/priority'
import { NOMBRE_TIPO, recortarHora } from '../lib/tipos'
import EtiquetaPrioridad from './EtiquetaPrioridad'
import EtiquetaVencida from './EtiquetaVencida'

const ESTADOS = {
  completada: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  justificada: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
}

// "acciones": botones o formularios que muestra cada página debajo de la tarjeta.
export default function TarjetaTarea({ tarea, acciones }) {
  const pendiente = tarea.estado === 'pendiente'
  const dias = diasRestantes(tarea)
  // Entrega: "18 oct, 14:30" · Actividad: "18 oct, 14:00–16:00"
  let fecha = null
  if (tarea.tipo === 'tarea') {
    fecha = tarea.fecha_entrega && formatearFechaHora(tarea.fecha_entrega)
  } else if (tarea.fecha_actividad) {
    fecha = formatearFecha(tarea.fecha_actividad)
    if (tarea.hora_inicio && tarea.hora_fin) {
      fecha += `, ${recortarHora(tarea.hora_inicio)}–${recortarHora(tarea.hora_fin)}`
    }
  }

  return (
    <li
      className={`rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${
        pendiente ? '' : 'opacity-70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className={`font-semibold ${pendiente ? '' : 'line-through'}`}>{tarea.titulo}</h2>
        <div className="flex shrink-0 gap-1.5">
          {estaVencida(tarea) && <EtiquetaVencida />}
          {pendiente ? (
            <EtiquetaPrioridad prioridad={prioridadActual(tarea)} />
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ESTADOS[tarea.estado]}`}>
              {tarea.estado}
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {NOMBRE_TIPO[tarea.tipo]}
        {fecha && (
          <>
            {' · '}
            {fecha} ({textoPlazo(dias)})
          </>
        )}
        {tarea.courses && (
          <>
            {' · '}
            <span
              className="mr-1 inline-block size-2 rounded-full bg-gray-400"
              style={tarea.courses.color ? { backgroundColor: tarea.courses.color } : undefined}
            />
            {tarea.courses.nombre}
          </>
        )}
      </p>

      {tarea.descripcion && (
        <p className="mt-2 text-sm whitespace-pre-line text-gray-700 dark:text-gray-300">{tarea.descripcion}</p>
      )}

      {acciones && <div className="mt-3">{acciones}</div>}
    </li>
  )
}
