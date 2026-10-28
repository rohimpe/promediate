import { useMemo, useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { tareasAEventos } from '../../lib/calendario'
import CalendarView from '../calendario/CalendarView'
import PanelEvento from '../calendario/PanelEvento'
import NuevoPendienteModal from '../NuevoPendienteModal'

// Calendario compacto de Inicio: semana en pantallas anchas y un solo día en celular,
// siempre con Anterior / Hoy / Siguiente. Reutiliza <CalendarView> con los datos ya cargados.
export default function CalendarioInicio({ tareas, cambiar, crear }) {
  const ancha = useMediaQuery('(min-width: 640px)') // mismo punto que usa CalendarView
  const [seleccionado, setSeleccionado] = useState(null) // id del evento abierto
  const [nuevo, setNuevo] = useState(null) // valores iniciales del modal "Nuevo pendiente" (null = cerrado)

  const eventos = useMemo(() => tareasAEventos(tareas), [tareas])

  // Se busca por id en cada render para que el panel refleje los cambios (completar, deshacer…).
  const evento = eventos.find((e) => e.id === seleccionado)
  const tarea = evento ? tareas.find((t) => t.id === evento.id) : undefined

  return (
    <section
      aria-label="Calendario"
      className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      {/* key: si cambia el tamaño de la pantalla, el calendario se vuelve a montar con la vista que toca */}
      <CalendarView
        key={ancha ? 'semana' : 'dia'}
        eventos={eventos}
        vistas={[ancha ? 'semana' : 'dia']}
        alturaMaxima={480}
        onSeleccionar={(e) => setSeleccionado(e.id)}
        onCrear={setNuevo}
      />

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
    </section>
  )
}
