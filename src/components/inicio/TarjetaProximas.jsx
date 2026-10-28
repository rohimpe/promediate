import { useMemo } from 'react'
import { formatearFechaHora, textoPlazo } from '../../lib/fechas'
import { MAX_ITEMS, entregasPendientes } from '../../lib/inicio'
import { diasRestantes, estaVencida, prioridadActual } from '../../lib/priority'
import EtiquetaPrioridad from '../EtiquetaPrioridad'
import EtiquetaVencida from '../EtiquetaVencida'
import EstadoVacio from './EstadoVacio'
import TarjetaInicio from './TarjetaInicio'

// Las siguientes entregas pendientes por fecha límite; las vencidas sin completar van primero.
export default function TarjetaProximas({ tareas, cargando, error, hoy }) {
  const entregas = useMemo(() => entregasPendientes(tareas), [tareas])
  const visibles = entregas.slice(0, MAX_ITEMS)

  let contenido
  if (cargando) {
    contenido = <p className="text-gray-600 dark:text-gray-400">Cargando…</p>
  } else if (error) {
    contenido = (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    )
  } else if (entregas.length === 0) {
    contenido = (
      <EstadoVacio mensaje="No tienes entregas pendientes 🎉" textoBoton="Agregar una entrega" to="/tareas/nueva" />
    )
  } else {
    contenido = (
      <>
        <ul className="divide-y divide-gray-200 dark:divide-gray-800">
          {visibles.map((t) => {
            const vencida = estaVencida(t)
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium break-words">{t.titulo}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t.courses && (
                      <>
                        <span
                          className="mr-1 inline-block size-2 rounded-full bg-gray-400"
                          style={t.courses.color ? { backgroundColor: t.courses.color } : undefined}
                        />
                        {t.courses.nombre}
                        {' · '}
                      </>
                    )}
                    {formatearFechaHora(t.fecha_entrega)}
                    {' · '}
                    <span className={vencida ? 'font-medium text-red-700 dark:text-red-400' : ''}>
                      {textoPlazo(diasRestantes(t, hoy))}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {vencida && <EtiquetaVencida />}
                  <EtiquetaPrioridad prioridad={prioridadActual(t, hoy)} />
                </div>
              </li>
            )
          })}
        </ul>
        {entregas.length > MAX_ITEMS && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            y {entregas.length - MAX_ITEMS} más en “Ver todo”
          </p>
        )}
      </>
    )
  }

  return (
    <TarjetaInicio titulo="Próximas entregas" verTodo="/tareas">
      {contenido}
    </TarjetaInicio>
  )
}
