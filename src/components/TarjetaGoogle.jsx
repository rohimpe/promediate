import { diasEntre, fechaEnLima, formatearFecha, hoyEnLima, textoPlazo } from '../lib/fechas'
import { horarioEvento } from '../lib/seguimiento'
import { IconoGoogle } from './calendario/BloqueEvento'

const ESTADOS = {
  completada: 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  justificada: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
}

// Nota para lo que se muestra solo por su resumen guardado (Google no está disponible o ya no devuelve el evento).
export function NotaGuardado() {
  return <span className="text-xs text-gray-500 dark:text-gray-400"> (guardado)</span>
}

// Tarjeta de un evento de Google que es pendiente, con el mismo aspecto que <TarjetaTarea>: ícono de Google en lugar de
// la etiqueta de prioridad y, al marcarlo, la etiqueta de su estado.
//   evento: un item de lib/seguimiento.js
//   acciones: botones que muestra cada página debajo de la tarjeta
export default function TarjetaGoogle({ evento, acciones }) {
  const pendiente = evento.estado === 'pendiente'
  const dia = fechaEnLima(evento.inicio)

  return (
    <li
      className={`rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 ${
        pendiente ? '' : 'opacity-70'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className={`flex min-w-0 items-start gap-1.5 font-semibold ${pendiente ? '' : 'line-through'}`}>
          <IconoGoogle className="mt-1 size-3.5 text-gray-500 dark:text-gray-400" />
          <span className="min-w-0 break-words">{evento.titulo}</span>
        </h2>
        <div className="flex shrink-0 gap-1.5">
          {evento.sinMarcar && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Sin marcar
            </span>
          )}
          {!pendiente && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ESTADOS[evento.estado]}`}>
              {evento.estado}
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Google Calendar · {formatearFecha(dia)}, {horarioEvento(evento)} ({textoPlazo(diasEntre(hoyEnLima(), dia))})
        {evento.soloGuardado && <NotaGuardado />}
      </p>

      {acciones && <div className="mt-3">{acciones}</div>}
    </li>
  )
}
