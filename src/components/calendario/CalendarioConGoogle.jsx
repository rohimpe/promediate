import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useGoogleEventos } from '../../hooks/useGoogleEventos'
import { useMostrarGoogle } from '../../hooks/useMostrarGoogle'
import { tareasAEventos } from '../../lib/calendario'
import { conEstadoDePendiente } from '../../lib/seguimiento'
import NuevoPendienteModal from '../NuevoPendienteModal'
import { IconoGoogle } from './BloqueEvento'
import CalendarView from './CalendarView'
import PanelEvento from './PanelEvento'

const AVISO_AMBAR =
  'rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
const ENLACE = 'font-medium underline'

// Aviso según lo que respondió Google (no bloquea: el calendario sigue funcionando sin él).
function AvisoGoogle({ estado, error, truncado }) {
  if (error) {
    return (
      <p role="status" className={AVISO_AMBAR}>
        No se pudo cargar Google Calendar. Tus entregas y actividades se ven normal; prueba con «Actualizar».
      </p>
    )
  }
  if (estado === 'no_conectado') {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        <Link to="/conexiones" className={ENLACE}>
          Conecta Google para ver tu horario
        </Link>
      </p>
    )
  }
  if (estado === 'reconectar') {
    return (
      <p role="status" className={AVISO_AMBAR}>
        Google dejó de aceptar tu conexión.{' '}
        <Link to="/conexiones" className={ENLACE}>
          Reconéctala en Conexiones
        </Link>{' '}
        para ver tus eventos.
      </p>
    )
  }
  if (estado === 'permisos_incompletos') {
    return (
      <p role="status" className={AVISO_AMBAR}>
        Falta el permiso de Google Calendar.{' '}
        <Link to="/conexiones" className={ENLACE}>
          Vuelve a conectar tu cuenta
        </Link>{' '}
        y acepta todos los permisos.
      </p>
    )
  }
  if (truncado) {
    return (
      <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
        Hay tantos eventos de Google en este periodo que no se muestran todos. Prueba con una vista más corta.
      </p>
    )
  }
  return null
}

// <CalendarView> con los pendientes de la app y, si el usuario quiere, los eventos de Google Calendar
// (solo lectura). Es lo que usan la página Calendario y el calendario compacto del Inicio.
// Maneja el interruptor «Mostrar Google Calendar», los avisos, el panel de detalles y el modal para crear.
//
//   tareas, cambiar, crear:  los de useTasks
//   seguimiento:  el de useSeguimientoGoogle (la página lo crea una vez y lo comparte con Hoy, etc.).
//                 Los eventos de Google que entran a pendientes muestran su estado y se pueden marcar en el panel.
//   El resto de las propiedades (vistas, vistaInicial, alturaMaxima…) van directo a <CalendarView>.
export default function CalendarioConGoogle({ tareas, cambiar, crear, seguimiento, ...propsCalendario }) {
  const [mostrar, setMostrar] = useMostrarGoogle()
  const [rango, setRango] = useState(null) // días visibles, lo informa <CalendarView>
  const google = useGoogleEventos(rango, mostrar)
  const [seleccionado, setSeleccionado] = useState(null) // id del evento abierto
  const [nuevo, setNuevo] = useState(null) // valores iniciales del modal "Nuevo pendiente" (null = cerrado)

  const eventosApp = useMemo(() => tareasAEventos(tareas), [tareas])
  // Los eventos de Google que entran a pendientes llevan su estado (completada, justificada…); los ocultos quedan normales.
  const eventosGoogle = useMemo(
    () => google.eventos.map((e) => conEstadoDePendiente(e, seguimiento.reglas)),
    [google.eventos, seguimiento.reglas],
  )
  const eventos = useMemo(() => [...eventosApp, ...eventosGoogle], [eventosApp, eventosGoogle])

  // Se busca por id en cada render para que el panel refleje los cambios (completar, deshacer…).
  const evento = eventos.find((e) => e.id === seleccionado)
  const tarea = evento?.origen === 'app' ? tareas.find((t) => t.id === evento.id) : undefined

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            role="switch"
            checked={mostrar}
            onChange={(e) => setMostrar(e.target.checked)}
            className="size-4 accent-indigo-600"
          />
          <IconoGoogle className="size-3.5" />
          Mostrar Google Calendar
        </label>
        {mostrar && (
          <button
            type="button"
            onClick={google.actualizar}
            disabled={google.cargando}
            className="rounded-lg border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            {google.cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        )}
      </div>

      {mostrar && (
        <div className="mb-3 empty:hidden">
          <AvisoGoogle estado={google.estado} error={google.error} truncado={google.truncado} />
        </div>
      )}

      <CalendarView
        {...propsCalendario}
        eventos={eventos}
        onSeleccionar={(e) => setSeleccionado(e.id)}
        onCrear={setNuevo}
        onRangoVisible={setRango}
      />

      {evento && (
        <PanelEvento
          key={evento.id}
          evento={evento}
          tarea={tarea}
          cambiar={cambiar}
          seguimiento={seguimiento}
          onCerrar={() => setSeleccionado(null)}
        />
      )}

      {nuevo && <NuevoPendienteModal valoresIniciales={nuevo} onGuardar={crear} onCerrar={() => setNuevo(null)} />}
    </>
  )
}
