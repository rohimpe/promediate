import { useMediaQuery } from '../../hooks/useMediaQuery'
import CalendarioConGoogle from '../calendario/CalendarioConGoogle'

// Calendario compacto de Inicio: semana en pantallas anchas y un solo día en celular,
// siempre con Anterior / Hoy / Siguiente. Reutiliza el calendario con los datos ya cargados.
export default function CalendarioInicio({ tareas, cambiar, crear, seguimiento }) {
  const ancha = useMediaQuery('(min-width: 640px)') // mismo punto que usa CalendarView

  return (
    <section
      aria-label="Calendario"
      className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
    >
      {/* key: si cambia el tamaño de la pantalla, el calendario se vuelve a montar con la vista que toca */}
      <CalendarioConGoogle
        key={ancha ? 'semana' : 'dia'}
        tareas={tareas}
        cambiar={cambiar}
        crear={crear}
        seguimiento={seguimiento}
        vistas={[ancha ? 'semana' : 'dia']}
        alturaMaxima={480}
      />
    </section>
  )
}
