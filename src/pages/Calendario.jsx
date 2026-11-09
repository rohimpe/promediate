import CalendarioConGoogle from '../components/calendario/CalendarioConGoogle'
import { useSeguimientoGoogle } from '../hooks/useSeguimientoGoogle'
import { useTasks } from '../hooks/useTasks'

// Página "Calendario": le pasa los pendientes al calendario, que además mezcla los eventos de Google
// (y permite seguirlos para marcarlos).
export default function Calendario() {
  const { tareas, cargando, error, cambiar, crear, sincronizar, borrar } = useTasks()
  const seguimiento = useSeguimientoGoogle()

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Calendario</h1>

      {cargando && <p className="mb-3 text-gray-600 dark:text-gray-400">Cargando…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <CalendarioConGoogle
        tareas={tareas}
        cambiar={cambiar}
        crear={crear}
        sincronizar={sincronizar}
        borrar={borrar}
        seguimiento={seguimiento}
      />
    </>
  )
}
