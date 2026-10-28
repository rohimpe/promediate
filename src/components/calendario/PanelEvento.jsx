import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { camposCompletada, camposJustificada, camposPendiente } from '../../lib/checklist'
import AccionesChecklist from '../AccionesChecklist'
import TarjetaTarea from '../TarjetaTarea'

// Panel con los detalles de un evento. Es un <dialog> nativo (como el resumen del día):
// el navegador maneja el fondo oscuro, la tecla Esc y el foco.
//
//   tarea:    la fila de `tasks` del evento (solo si su origen es la app); con ella se
//             muestran las mismas acciones que en "Hoy": Completar, Justificar, Deshacer.
//   cambiar:  (id, campos) => Promise, el `cambiar` de useTasks
//   onCerrar: se llama al cerrar por cualquier vía (botón, Esc o clic afuera)
export default function PanelEvento({ evento, tarea, cambiar, onCerrar }) {
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
          // Eventos que no son pendientes de la app (p. ej. Google en la Fase 3): solo lectura.
          <div>
            <h2 className="font-semibold">{evento.titulo}</h2>
            {evento.curso && <p className="text-sm text-gray-600 dark:text-gray-400">{evento.curso}</p>}
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
