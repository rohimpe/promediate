import { useMemo } from 'react'
import { Link } from 'react-router'
import { camposCompletada, camposJustificada } from '../../lib/checklist'
import { MAX_ITEMS, resumenDeHoy } from '../../lib/inicio'
import { prioridadActual } from '../../lib/priority'
import { horarioEvento } from '../../lib/seguimiento'
import { NOMBRE_TIPO, horarioTarea } from '../../lib/tipos'
import AccionesChecklist from '../AccionesChecklist'
import AccionesEventoGoogle from '../AccionesEventoGoogle'
import { IconoGoogle } from '../calendario/BloqueEvento'
import EtiquetaPrioridad from '../EtiquetaPrioridad'
import { NotaGuardado } from '../TarjetaGoogle'
import EstadoVacio from './EstadoVacio'
import TarjetaInicio from './TarjetaInicio'

const LISTA = 'divide-y divide-gray-200 dark:divide-gray-800'
const ITEM = 'py-3 first:pt-0 last:pb-0'
const TITULO_SECCION = 'mb-2 text-sm font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400'

// Lo de hoy (hora de Lima) en dos secciones, cada una con su tope de 4 elementos para que los eventos no
// desplacen a tus pendientes:
//   - tus pendientes por prioridad calculada, con Completar y Justificar y su contador "X de Y completados"
//   - "Eventos de hoy": los eventos de Google que entran a pendientes, por hora, con su contador "X de Y"
//   tareas, cargando, error, cambiar: los de useTasks(), compartidos con las demás tarjetas
//   eventosGoogle, seguimiento: los eventos de Google (usePendientesGoogle) y las acciones (useSeguimientoGoogle)
export default function TarjetaHoy({ tareas, eventosGoogle, seguimiento, cargando, error, cambiar, hoy }) {
  const { pendientes, hechas, total, actividadesVencidas, eventos } = useMemo(
    () => resumenDeHoy(tareas, hoy, eventosGoogle),
    [tareas, eventosGoogle, hoy],
  )
  const visibles = pendientes.slice(0, MAX_ITEMS)
  const eventosVisibles = eventos.pendientes.slice(0, MAX_ITEMS)

  let contenido
  if (cargando) {
    contenido = <p className="text-gray-600 dark:text-gray-400">Cargando…</p>
  } else if (error) {
    contenido = (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    )
  } else if (total === 0 && actividadesVencidas === 0 && eventos.total === 0) {
    contenido = (
      <EstadoVacio mensaje="No tienes nada para hoy 🎉" textoBoton="Nuevo pendiente" to="/tareas/nueva" />
    )
  } else {
    contenido = (
      <>
        {visibles.length === 0 ? (
          // Si solo hay eventos, no se repite un mensaje de "todo listo" que contradiga lo que hay debajo.
          (total > 0 || eventos.total === 0) && (
            <p className="py-2 text-center text-gray-600 dark:text-gray-400">
              {total === 0 ? 'No tienes nada para hoy 🎉' : '¡Todo listo por hoy! 🎉'}
            </p>
          )
        ) : (
          <ul className={LISTA}>
            {visibles.map((t) => (
              <li key={t.id} className={ITEM}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{t.titulo}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {NOMBRE_TIPO[t.tipo]}
                      {horarioTarea(t) && ` · ${horarioTarea(t)}`}
                      {t.courses && ` · ${t.courses.nombre}`}
                    </p>
                  </div>
                  <EtiquetaPrioridad prioridad={prioridadActual(t, hoy)} />
                </div>
                <div className="mt-2">
                  <AccionesChecklist
                    tarea={t}
                    onCompletar={() => cambiar(t.id, camposCompletada())}
                    onJustificar={(motivo) => cambiar(t.id, camposJustificada(motivo))}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {pendientes.length > MAX_ITEMS && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            y {pendientes.length - MAX_ITEMS} más en “Ver todo”
          </p>
        )}
        {actividadesVencidas > 0 && (
          <p className="mt-3 text-sm text-red-700 dark:text-red-400">
            Tienes {actividadesVencidas} {actividadesVencidas === 1 ? 'actividad vencida' : 'actividades vencidas'}.{' '}
            <Link to="/hoy" className="font-medium underline">
              Revisar
            </Link>
          </p>
        )}

        {eventos.total > 0 && (
          <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-800">
            <h3 className={TITULO_SECCION}>
              Eventos de hoy · {eventos.hechas} de {eventos.total}
            </h3>
            {eventosVisibles.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">¡Ya marcaste todos tus eventos de hoy! 🎉</p>
            ) : (
              <ul className={LISTA}>
                {eventosVisibles.map((e) => (
                  // Evento de Google: ícono de Google en lugar de la etiqueta de prioridad.
                  <li key={e.id} className={ITEM}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium break-words">{e.titulo}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Google Calendar · {horarioEvento(e)}
                          {e.soloGuardado && <NotaGuardado />}
                        </p>
                      </div>
                      <IconoGoogle className="mt-1 size-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <div className="mt-2">
                      <AccionesEventoGoogle evento={e} seguimiento={seguimiento} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {eventos.pendientes.length > MAX_ITEMS && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                y {eventos.pendientes.length - MAX_ITEMS} más en “Ver todo”
              </p>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <TarjetaInicio
      titulo="Hoy"
      subtitulo={!cargando && !error && total > 0 ? `${hechas} de ${total} completados` : undefined}
      verTodo="/hoy"
    >
      {contenido}
    </TarjetaInicio>
  )
}
