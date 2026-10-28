import { useMemo, useState } from 'react'
import CalendarView from '../components/calendario/CalendarView'
import PanelEvento from '../components/calendario/PanelEvento'
import NuevoPendienteModal from '../components/NuevoPendienteModal'
import { useTasks } from '../hooks/useTasks'
import { tareasAEventos } from '../lib/calendario'

// Página "Calendario": convierte los pendientes en eventos y se los pasa a <CalendarView>.
export default function Calendario() {
  const { tareas, cargando, error, cambiar, crear } = useTasks()
  const [seleccionado, setSeleccionado] = useState(null) // id del evento abierto
  const [nuevo, setNuevo] = useState(null) // valores iniciales del modal "Nuevo pendiente" (null = cerrado)

  const eventos = useMemo(() => tareasAEventos(tareas), [tareas])

  // Se busca por id en cada render para que el panel refleje los cambios (completar, deshacer…).
  const evento = eventos.find((e) => e.id === seleccionado)
  const tarea = evento?.origen === 'app' ? tareas.find((t) => t.id === evento.id) : undefined

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Calendario</h1>

      {cargando && <p className="mb-3 text-gray-600 dark:text-gray-400">Cargando…</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <CalendarView eventos={eventos} onSeleccionar={(e) => setSeleccionado(e.id)} onCrear={setNuevo} />

      {evento && (
        <PanelEvento
          key={evento.id}
          evento={evento}
          tarea={tarea}
          cambiar={cambiar}
          onCerrar={() => setSeleccionado(null)}
        />
      )}

      {nuevo && <NuevoPendienteModal valoresIniciales={nuevo} onGuardar={crear} onCerrar={() => setNuevo(null)} />}
    </>
  )
}
