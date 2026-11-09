import { useMemo } from 'react'
import { Link } from 'react-router'
import { camposCompletada, camposJustificada } from '../../lib/checklist'
import { MAX_ITEMS, resumenDeHoy } from '../../lib/inicio'
import { prioridadActual } from '../../lib/priority'
import { horarioEvento } from '../../lib/seguimiento'
import { NOMBRE_TIPO, horarioTarea } from '../../lib/tipos'
import AccionesChecklist from '../AccionesChecklist'
import AccionesEventoGoogle from '../AccionesEventoGoogle'
import EtiquetaPrioridad from '../EtiquetaPrioridad'
import IconoFila from '../IconosTipo'
import { NotaGuardado } from '../TarjetaGoogle'
import EstadoVacio from './EstadoVacio'
import TarjetaInicio from './TarjetaInicio'

const LISTA = 'divide-y divide-gray-200 dark:divide-gray-800'
const ITEM = 'py-3 first:pt-0 last:pb-0'

// Lo de hoy (hora de Lima) en UNA sola lista, con tope de 4 filas respetando su orden (las entregas van primero,
// así que nunca quedan detrás de los eventos), y un solo contador "X de Y completados":
//   entregas por prioridad calculada → lo de todo el día → lo que tiene hora (actividades y eventos de Google), cronológico
// Cada fila lleva su ícono (entrega, actividad o Google); los eventos de Google no llevan etiqueta de prioridad.
//   tareas, cargando, error, cambiar: los de useTasks(), compartidos con las demás tarjetas
//   eventosGoogle, seguimiento: los eventos de Google (usePendientesGoogle) y las acciones (useSeguimientoGoogle)
export default function TarjetaHoy({ tareas, eventosGoogle, seguimiento, cargando, error, cambiar, hoy }) {
  const { pendientes, hechas, total, actividadesVencidas } = useMemo(
    () => resumenDeHoy(tareas, hoy, eventosGoogle),
    [tareas, eventosGoogle, hoy],
  )
  const visibles = pendientes.slice(0, MAX_ITEMS)

  function fila(f) {
    if (f.origen === 'google') {
      const e = f.evento
      return (
        <li key={f.id} className={ITEM}>
          <div className="flex items-start justify-between gap-3">
            {/* Franja con el color del evento en Google */}
            <div className="min-w-0 border-l-4 pl-2" style={{ borderLeftColor: e.color }}>
              <p className="flex items-start gap-1.5 font-medium">
                <IconoFila fila={f} className="mt-1 size-3.5 text-gray-500 dark:text-gray-400" />
                <span className="min-w-0 break-words">{e.titulo}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Google Calendar · {horarioEvento(e)}
                {e.soloGuardado && <NotaGuardado />}
              </p>
            </div>
          </div>
          <div className="mt-2">
            <AccionesEventoGoogle evento={e} seguimiento={seguimiento} />
          </div>
        </li>
      )
    }

    const t = f.tarea
    return (
      <li key={f.id} className={ITEM}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-start gap-1.5 font-medium">
              <IconoFila fila={f} className="mt-1 size-3.5 text-gray-500 dark:text-gray-400" />
              <span className="min-w-0 break-words">{t.titulo}</span>
            </p>
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
    )
  }

  let contenido
  if (cargando) {
    contenido = <p className="text-gray-600 dark:text-gray-400">Cargando…</p>
  } else if (error) {
    contenido = (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    )
  } else if (total === 0 && actividadesVencidas === 0) {
    contenido = (
      <EstadoVacio mensaje="No tienes nada para hoy 🎉" textoBoton="Nuevo pendiente" to="/tareas/nueva" />
    )
  } else {
    contenido = (
      <>
        {visibles.length === 0 ? (
          total > 0 && <p className="py-2 text-center text-gray-600 dark:text-gray-400">¡Todo listo por hoy! 🎉</p>
        ) : (
          <ul className={LISTA}>{visibles.map(fila)}</ul>
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
