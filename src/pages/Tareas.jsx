import { useState } from 'react'
import { Link } from 'react-router'
import TarjetaTarea from '../components/TarjetaTarea'
import { useTasks } from '../hooks/useTasks'
import { ordenarPorPrioridad } from '../lib/priority'

export default function Tareas() {
  const { tareas, cargando, error, borrar } = useTasks()
  const [errorBorrar, setErrorBorrar] = useState('')

  async function onBorrar(tarea) {
    if (!window.confirm(`¿Borrar "${tarea.titulo}"? No se puede deshacer.`)) return
    setErrorBorrar('')
    try {
      await borrar(tarea.id)
    } catch {
      setErrorBorrar('No se pudo borrar el pendiente. Inténtalo de nuevo.')
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Pendientes</h1>
        <Link
          to="/tareas/nueva"
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Nuevo pendiente
        </Link>
      </div>

      {cargando && <p className="text-gray-600 dark:text-gray-400">Cargando…</p>}

      {(error || errorBorrar) && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error || errorBorrar}
        </p>
      )}

      {!cargando && !error && tareas.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400">
          Aún no tienes pendientes. Crea el primero con “+ Nuevo pendiente”.
        </p>
      )}

      <ul className="space-y-3">
        {ordenarPorPrioridad(tareas).map((t) => (
          <TarjetaTarea key={t.id} tarea={t} onBorrar={onBorrar} />
        ))}
      </ul>
    </>
  )
}
