import { Link } from 'react-router'
import { formatearFecha, formatearFechaHora } from '../lib/fechas'
import { diasRestantes, estaVencida, prioridadActual } from '../lib/priority'
import { NOMBRE_TIPO, recortarHora } from '../lib/tipos'
import EtiquetaPrioridad from './EtiquetaPrioridad'

function textoPlazo(dias) {
  if (dias === null) return ''
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  if (dias > 1) return `En ${dias} días`
  return dias === -1 ? 'Ayer' : `Hace ${-dias} días`
}

const ESTADOS = {
  completada: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  justificada: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
}

export default function TarjetaTarea({ tarea, onBorrar }) {
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
          {estaVencida(tarea) && (
            <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900">
              Vencida
            </span>
          )}
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

      <div className="mt-3 flex gap-2">
        <Link
          to={`/tareas/${tarea.id}/editar`}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Editar
        </Link>
        <button
          onClick={() => onBorrar(tarea)}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Borrar
        </button>
      </div>
    </li>
  )
}
