import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { camposCompletada, camposJustificada, camposPendiente } from '../../lib/checklist'
import { fechaEnLima, formatearDiaLargo, formatearFechaHora, horaEnLima } from '../../lib/fechas'
import AccionesChecklist from '../AccionesChecklist'
import TarjetaTarea from '../TarjetaTarea'
import { IconoGoogle } from './BloqueEvento'
import SeguimientoGoogle from './SeguimientoGoogle'

// 'Lunes 9 de noviembre · 10:00–11:30' (hora de Lima). Si cruza la medianoche, muestra ambas fechas.
function textoHorario(evento) {
  const dia = formatearDiaLargo(fechaEnLima(evento.inicio)).replace(/^./, (c) => c.toUpperCase())
  if (evento.todoElDia) return `${dia} · Todo el día`
  if (evento.fin <= evento.inicio) return `${dia} · ${horaEnLima(evento.inicio)}`
  if (fechaEnLima(evento.fin) !== fechaEnLima(evento.inicio)) {
    return `${formatearFechaHora(evento.inicio)} → ${formatearFechaHora(evento.fin)}`
  }
  return `${dia} · ${horaEnLima(evento.inicio)}–${horaEnLima(evento.fin)}`
}

// Panel con los detalles de un evento. Es un <dialog> nativo (como el resumen del día):
// el navegador maneja el fondo oscuro, la tecla Esc y el foco.
//
//   tarea:    la fila de `tasks` del evento (solo si su origen es la app); con ella se
//             muestran las mismas acciones que en "Hoy": Completar, Justificar, Deshacer.
//             Los eventos de Google (origen 'google') no tienen tarea: muestran sus detalles y, con
//             `seguimiento`, los botones para seguirlos y marcarlos (Fui / Justificar).
//   cambiar:  (id, campos) => Promise, el `cambiar` de useTasks
//   seguimiento: lo que devuelve useSeguimientoGoogle(); sin él, los eventos de Google son de solo lectura
//   onCerrar: se llama al cerrar por cualquier vía (botón, Esc o clic afuera)
export default function PanelEvento({ evento, tarea, cambiar, seguimiento, onCerrar }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onCerrar}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      aria-label={`Detalles de ${evento.titulo}`}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 backdrop:bg-black/50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
    >
      <div className="max-h-[80svh] overflow-y-auto p-4">
        {tarea ? (
          <ul>
            <TarjetaTarea
              tarea={tarea}
              acciones={
                <div className="space-y-3">
                  {/* key: al cambiar de estado se vuelve a montar y los botones salen sin "ocupado" */}
                  <AccionesChecklist
                    key={tarea.estado}
                    tarea={tarea}
                    onCompletar={() => cambiar(tarea.id, camposCompletada())}
                    onJustificar={(motivo) => cambiar(tarea.id, camposJustificada(motivo))}
                    onDeshacer={() => cambiar(tarea.id, camposPendiente())}
                  />
                  <Link
                    to={`/tareas/${tarea.id}/editar`}
                    className="inline-block rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    Editar
                  </Link>
                </div>
              }
            />
          </ul>
        ) : (
          // Eventos que no son pendientes de la app (los de Google): solo lectura.
          <div>
            {evento.origen === 'google' && (
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                <IconoGoogle /> Google Calendar
              </p>
            )}
            <h2 className="font-semibold">{evento.titulo}</h2>
            {evento.curso && <p className="text-sm text-gray-600 dark:text-gray-400">{evento.curso}</p>}
            {evento.origen === 'google' && (
              <div className="mt-2 space-y-1 text-sm">
                <p>{textoHorario(evento)}</p>
                {evento.lugar && <p className="break-words text-gray-600 dark:text-gray-400">📍 {evento.lugar}</p>}
                {evento.enlace && (
                  <a
                    href={evento.enlace}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block pt-1 font-medium text-indigo-700 underline dark:text-indigo-300"
                  >
                    Abrir en Google Calendar
                  </a>
                )}
              </div>
            )}
            {evento.origen === 'google' && seguimiento && <SeguimientoGoogle evento={evento} seguimiento={seguimiento} />}
          </div>
        )}

        <button
          type="button"
          onClick={() => dialogRef.current.close()}
          className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Cerrar
        </button>
      </div>
    </dialog>
  )
}
