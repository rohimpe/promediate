import { useState } from 'react'
import AccionesChecklist from '../components/AccionesChecklist'
import AccionesEventoGoogle from '../components/AccionesEventoGoogle'
import TarjetaGoogle from '../components/TarjetaGoogle'
import TarjetaTarea from '../components/TarjetaTarea'
import { usePendientesGoogle } from '../hooks/usePendientesGoogle'
import { useSeguimientoGoogle } from '../hooks/useSeguimientoGoogle'
import { useTasks } from '../hooks/useTasks'
import { camposCompletada, camposJustificada, camposPendiente, dividirChecklist, unirListaHoy } from '../lib/checklist'
import { formatearDiaLargo, hoyEnLima } from '../lib/fechas'
import { resumenDeHoy } from '../lib/inicio'
import { eventosDeHoy, rangoPendientesGoogle } from '../lib/seguimiento'

function Seccion({ titulo, color = '', children }) {
  return (
    <section className="mt-6">
      <h2 className={`mb-3 text-sm font-semibold tracking-wide uppercase ${color || 'text-gray-600 dark:text-gray-400'}`}>
        {titulo}
      </h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  )
}

// Página "Hoy": el checklist diario. Se calcula al abrir, según el día actual en Lima.
// Entregas, actividades y eventos de Google van en una sola lista (ver unirListaHoy para el orden).
export default function Hoy() {
  const { tareas, cargando, error, cambiar, sincronizar } = useTasks()
  // Ids que el usuario cerró en esta sesión: se quedan visibles en "Hechas" aunque
  // sean de días anteriores, para poder deshacer el cambio.
  const [cerradas, setCerradas] = useState(() => new Set())

  const seguimiento = useSeguimientoGoogle()

  const hoy = hoyEnLima()
  const { vencidas, hoyPendientes, hechas } = dividirChecklist(tareas, hoy, cerradas)
  // Mismo rango que Inicio y Pendientes: los tres comparten una sola petición a Google.
  const google = usePendientesGoogle(seguimiento, rangoPendientesGoogle(hoy))
  const eventos = eventosDeHoy(google.eventos, hoy)

  const paraHoy = unirListaHoy(hoyPendientes, eventos.pendientes)
  const hechasHoy = unirListaHoy(
    hechas,
    eventos.eventos.filter((e) => e.estado !== 'pendiente'),
  )
  // "X de Y completados" cuenta todo lo de hoy: pendientes, actividades y eventos de Google.
  const { hechas: nHechas, total } = resumenDeHoy(tareas, hoy, google.eventos)

  async function cerrar(tarea, campos) {
    await cambiar(tarea.id, campos)
    setCerradas((s) => new Set(s).add(tarea.id))
  }

  function tarjeta(fila) {
    if (fila.origen === 'google') {
      return (
        <TarjetaGoogle
          key={fila.id}
          evento={fila.evento}
          acciones={<AccionesEventoGoogle evento={fila.evento} seguimiento={seguimiento} />}
        />
      )
    }
    const t = fila.tarea
    return (
      <TarjetaTarea
        key={t.id}
        tarea={t}
        conIcono
        onReintentarGoogle={() => sincronizar(t.id, 'crear')}
        acciones={
          <AccionesChecklist
            tarea={t}
            onCompletar={() => cerrar(t, camposCompletada())}
            onJustificar={(motivo) => cerrar(t, camposJustificada(motivo))}
            onDeshacer={() => cambiar(t.id, camposPendiente())}
          />
        }
      />
    )
  }

  const cargandoTodo = cargando || google.cargando
  const nadaPendiente = !cargandoTodo && !error && vencidas.length === 0 && paraHoy.length === 0

  return (
    <>
      <h1 className="text-2xl font-bold">Hoy</h1>
      <p className="text-gray-600 dark:text-gray-400">{formatearDiaLargo(hoy)}</p>
      {!cargandoTodo && !error && total > 0 && (
        <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          {nHechas} de {total} completados
        </p>
      )}

      {cargandoTodo && <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando…</p>}
      {(seguimiento.error || google.errorGoogle) && (
        <p role="status" className="mt-4 text-sm text-amber-800 dark:text-amber-300">
          No se pudieron cargar tus eventos de Google. Lo demás se ve normal.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {vencidas.length > 0 && (
        <Seccion titulo={`Vencidas (${vencidas.length})`} color="text-red-700 dark:text-red-400">
          {vencidas.map((t) => tarjeta({ id: t.id, origen: 'app', tarea: t }))}
        </Seccion>
      )}

      {paraHoy.length > 0 && <Seccion titulo={`Para hoy (${paraHoy.length})`}>{paraHoy.map(tarjeta)}</Seccion>}

      {nadaPendiente && (
        <p className="mt-6 rounded-xl border border-gray-200 p-4 text-center text-gray-600 dark:border-gray-800 dark:text-gray-400">
          No tienes nada pendiente para hoy. 🎉
        </p>
      )}

      {hechasHoy.length > 0 && <Seccion titulo={`Hechas (${hechasHoy.length})`}>{hechasHoy.map(tarjeta)}</Seccion>}
    </>
  )
}
