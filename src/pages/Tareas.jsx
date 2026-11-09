import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import AccionesEventoGoogle from '../components/AccionesEventoGoogle'
import { IconoGoogle } from '../components/calendario/BloqueEvento'
import TarjetaGoogle from '../components/TarjetaGoogle'
import TarjetaTarea from '../components/TarjetaTarea'
import { usePendientesGoogle } from '../hooks/usePendientesGoogle'
import { useSeguimientoGoogle } from '../hooks/useSeguimientoGoogle'
import { useTasks } from '../hooks/useTasks'
import { hoyEnLima } from '../lib/fechas'
import { ordenarPorPrioridad } from '../lib/priority'
import { eventosParaPendientes, rangoPendientesGoogle } from '../lib/seguimiento'

const FILTRO_ACTIVO = 'bg-indigo-600 text-white'
const FILTRO_INACTIVO = 'border border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800'

// Avisos cuando Google no está disponible: se muestran solo los eventos ya guardados.
const AVISO_GOOGLE = {
  no_conectado: 'Google no está conectado.',
  reconectar: 'Google dejó de aceptar tu conexión.',
  permisos_incompletos: 'Falta el permiso de Google Calendar.',
}

export default function Tareas() {
  const { tareas, cargando, error, borrar, sincronizar } = useTasks()
  const [errorBorrar, setErrorBorrar] = useState('')
  const [avisoBorrar, setAvisoBorrar] = useState('') // se borró, pero el evento pudo quedar en Google
  const [filtro, setFiltro] = useState('app') // 'app' = tus pendientes · 'google' = eventos de Google

  const hoy = hoyEnLima()
  const seguimiento = useSeguimientoGoogle()
  // Solo se le pregunta a Google cuando se abre la pestaña "Google".
  // Mismo rango que Inicio y Hoy: los tres comparten una sola petición a Google.
  const google = usePendientesGoogle(seguimiento, rangoPendientesGoogle(hoy), filtro === 'google')
  const eventosGoogle = useMemo(() => eventosParaPendientes(google.eventos, hoy), [google.eventos, hoy])

  async function onBorrar(tarea) {
    if (!window.confirm(`¿Borrar "${tarea.titulo}"? No se puede deshacer.`)) return
    setErrorBorrar('')
    setAvisoBorrar('')
    try {
      const { eventoQuedo } = await borrar(tarea.id)
      if (eventoQuedo) {
        setAvisoBorrar(`Se borró "${tarea.titulo}", pero su evento pudo quedar en Google Calendar. Puedes borrarlo allí.`)
      }
    } catch {
      setErrorBorrar('No se pudo borrar el pendiente. Inténtalo de nuevo.')
    }
  }

  const boton = (valor, contenido) => (
    <button
      type="button"
      aria-pressed={filtro === valor}
      onClick={() => setFiltro(valor)}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
        filtro === valor ? FILTRO_ACTIVO : FILTRO_INACTIVO
      }`}
    >
      {contenido}
    </button>
  )

  const avisoGoogle = AVISO_GOOGLE[google.estadoGoogle]

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

      <div className="mb-4 flex gap-2">
        {boton('app', 'Mis pendientes')}
        {boton(
          'google',
          <>
            <IconoGoogle className="size-3.5" />
            Google
          </>,
        )}
      </div>

      {filtro === 'app' ? (
        <>
          {cargando && <p className="text-gray-600 dark:text-gray-400">Cargando…</p>}

          {(error || errorBorrar) && (
            <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
              {error || errorBorrar}
            </p>
          )}

          {avisoBorrar && (
            <p
              role="status"
              className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              {avisoBorrar}
            </p>
          )}

          {!cargando && !error && tareas.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400">
              Aún no tienes pendientes. Crea el primero con “+ Nuevo pendiente”.
            </p>
          )}

          <ul className="space-y-3">
            {ordenarPorPrioridad(tareas).map((t) => (
              <TarjetaTarea
                key={t.id}
                tarea={t}
                onReintentarGoogle={() => sincronizar(t.id, 'crear')}
                acciones={
                  <div className="flex gap-2">
                    <Link
                      to={`/tareas/${t.id}/editar`}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => onBorrar(t)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Borrar
                    </button>
                  </div>
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            Eventos de tu Google Calendar: los próximos 14 días y los de los últimos 7 que no marcaste. Quita los que no quieras desde el Calendario.
          </p>

          {google.cargando && <p className="text-gray-600 dark:text-gray-400">Cargando…</p>}

          {(seguimiento.error || google.errorGoogle) && (
            <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">
              {seguimiento.error || 'No se pudo cargar Google Calendar. Prueba de nuevo más tarde.'}
            </p>
          )}

          {avisoGoogle && (
            <p
              role="status"
              className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
            >
              {avisoGoogle} Solo se muestra lo que ya tenías guardado.{' '}
              <Link to="/conexiones" className="font-medium underline">
                Ir a Conexiones
              </Link>
            </p>
          )}

          {!google.cargando && !seguimiento.error && eventosGoogle.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400">
              No hay eventos de Google en estos días.
            </p>
          )}

          <ul className="space-y-3">
            {eventosGoogle.map((s) => (
              <TarjetaGoogle
                key={s.id}
                evento={s}
                acciones={<AccionesEventoGoogle evento={s} seguimiento={seguimiento} />}
              />
            ))}
          </ul>
        </>
      )}
    </>
  )
}
