import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { camposCompletada, camposJustificada, camposPendiente } from '../../lib/checklist'
import { fechaEnLima, formatearDiaLargo, formatearFechaHora, horaEnLima } from '../../lib/fechas'
import AccionesChecklist from '../AccionesChecklist'
import { IconoAdvertencia, ListaChoques } from '../AdvertenciaChoques'
import TarjetaTarea from '../TarjetaTarea'
import { IconoGoogle } from './BloqueEvento'
import ColorEventoGoogle from './ColorEventoGoogle'
import PendienteGoogle from './PendienteGoogle'

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
//             `seguimiento`, los botones para marcarlos (Fui / Justificar) o quitarlos de tus pendientes.
//   choques:  los elementos con hora que se solapan con este evento (vacío si no hay); se explican en un aviso
//   cambiar:  (id, campos) => Promise, el `cambiar` de useTasks
//   sincronizar: (id, accion) => Promise, el `sincronizar` de useTasks ("Reintentar" si no se pudo añadir a Google)
//   seguimiento: lo que devuelve useSeguimientoGoogle(); sin él, los eventos de Google son de solo lectura
//   onBorrar: (tarea) => Promise; si se pasa, los pendientes de la app llevan "Borrar" (lanza error si no se pudo).
//             Los eventos de Google que no creó la app nunca lo llevan: se quitan de tus pendientes.
//   onCerrar: se llama al cerrar por cualquier vía (botón, Esc o clic afuera)
export default function PanelEvento({ evento, tarea, choques = [], cambiar, sincronizar, seguimiento, onBorrar, onCerrar }) {
  const dialogRef = useRef(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function borrar() {
    const enGoogle = tarea.google_event_id ? ' También se eliminará de Google Calendar.' : ''
    if (!window.confirm(`¿Borrar "${tarea.titulo}"?${enGoogle}`)) return
    setBorrando(true)
    setErrorBorrar('')
    try {
      await onBorrar(tarea) // si sale bien, el pendiente desaparece del calendario y el panel se cierra
    } catch {
      setErrorBorrar('No se pudo borrar el pendiente. Inténtalo de nuevo.')
      setBorrando(false)
    }
  }

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
              onReintentarGoogle={sincronizar ? () => sincronizar(tarea.id, 'crear') : undefined}
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
                  <div className="flex gap-2">
                    <Link
                      to={`/tareas/${tarea.id}/editar`}
                      className="inline-block rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      Editar
                    </Link>
                    {onBorrar && (
                      <button
                        type="button"
                        onClick={borrar}
                        disabled={borrando}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        {borrando ? 'Borrando…' : 'Borrar'}
                      </button>
                    )}
                  </div>
                  {errorBorrar && (
                    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                      {errorBorrar}
                    </p>
                  )}
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
            {evento.origen === 'google' && seguimiento && <ColorEventoGoogle evento={evento} seguimiento={seguimiento} />}
            {evento.origen === 'google' && seguimiento && <PendienteGoogle evento={evento} seguimiento={seguimiento} />}
          </div>
        )}

        {choques.length > 0 && (
          <div className="mt-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <IconoAdvertencia />
              Este horario se cruza con otro
            </p>
            <p className="text-sm">
              El ícono de advertencia en el calendario marca los eventos que se solapan en el tiempo. Se cruza con:
            </p>
            <ListaChoques choques={choques} />
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
