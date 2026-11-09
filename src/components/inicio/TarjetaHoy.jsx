import { useMemo } from 'react'
import { Link } from 'react-router'
import { camposCompletada, camposJustificada } from '../../lib/checklist'
import { MAX_ITEMS, resumenDeHoy } from '../../lib/inicio'
import { prioridadActual } from '../../lib/priority'
import { horarioSeguido } from '../../lib/seguimiento'
import { NOMBRE_TIPO, horarioTarea } from '../../lib/tipos'
import AccionesChecklist from '../AccionesChecklist'
import AccionesSeguido from '../AccionesSeguido'
import { IconoGoogle } from '../calendario/BloqueEvento'
import EtiquetaPrioridad from '../EtiquetaPrioridad'
import { NotaGuardado } from '../TarjetaGoogle'
import EstadoVacio from './EstadoVacio'
import TarjetaInicio from './TarjetaInicio'

// Pendientes de hoy (hora de Lima), con Completar y Justificar: primero los eventos de Google que sigue el
// usuario (por hora, sin etiqueta de prioridad) y luego los pendientes por prioridad calculada.
//   tareas, cargando, error, cambiar: los de useTasks(), compartidos con las demás tarjetas
//   seguidos, seguimiento: los eventos de Google seguidos (useSeguidosGoogle) y las acciones (useSeguimientoGoogle)
export default function TarjetaHoy({ tareas, seguidos, seguimiento, cargando, error, cambiar, hoy }) {
  const { pendientes, hechas, total, actividadesVencidas } = useMemo(
    () => resumenDeHoy(tareas, hoy, seguidos),
    [tareas, seguidos, hoy],
  )
  const visibles = pendientes.slice(0, MAX_ITEMS)

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
          <p className="py-2 text-center text-gray-600 dark:text-gray-400">
            {total === 0 ? 'No tienes nada para hoy 🎉' : '¡Todo listo por hoy! 🎉'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {visibles.map((t) =>
              t.origen === 'google' ? (
                // Evento de Google seguido: ícono de Google en lugar de la etiqueta de prioridad.
                <li key={t.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{t.titulo}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Google Calendar · {horarioSeguido(t)}
                        {t.soloGuardado && <NotaGuardado />}
                      </p>
                    </div>
                    <IconoGoogle className="mt-1 size-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="mt-2">
                    <AccionesSeguido seguido={t} seguimiento={seguimiento} />
                  </div>
                </li>
              ) : (
                <li key={t.id} className="py-3 first:pt-0 last:pb-0">
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
              ),
            )}
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
