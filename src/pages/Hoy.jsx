import { useState } from 'react'
import AccionesChecklist from '../components/AccionesChecklist'
import TarjetaTarea from '../components/TarjetaTarea'
import AccionesSeguido from '../components/AccionesSeguido'
import TarjetaGoogle from '../components/TarjetaGoogle'
import { useSeguidosGoogle } from '../hooks/useSeguidosGoogle'
import { useSeguimientoGoogle } from '../hooks/useSeguimientoGoogle'
import { useTasks } from '../hooks/useTasks'
import { camposCompletada, camposJustificada, camposPendiente, dividirChecklist } from '../lib/checklist'
import { formatearDiaLargo, hoyEnLima } from '../lib/fechas'
import { seguidosDeHoy } from '../lib/seguimiento'

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
export default function Hoy() {
  const { tareas, cargando, error, cambiar } = useTasks()
  // Ids que el usuario cerró en esta sesión: se quedan visibles en "Hechas" aunque
  // sean de días anteriores, para poder deshacer el cambio.
  const [cerradas, setCerradas] = useState(() => new Set())

  const seguimiento = useSeguimientoGoogle()

  const hoy = hoyEnLima()
  const lista = dividirChecklist(tareas, hoy, cerradas)
  const vencidas = lista.vencidas
  // Los eventos de Google que se siguen van en las mismas listas, primero (todo el día y luego por hora).
  const seguidos = useSeguidosGoogle(seguimiento, { desde: hoy, hasta: hoy })
  const deGoogle = seguidosDeHoy(seguidos.seguidos, hoy)
  const hoyPendientes = [...deGoogle.pendientes, ...lista.hoyPendientes]
  const hechas = [...deGoogle.hechas, ...lista.hechas]

  async function cerrar(tarea, campos) {
    await cambiar(tarea.id, campos)
    setCerradas((s) => new Set(s).add(tarea.id))
  }

  function tarjeta(t) {
    if (t.origen === 'google') {
      return <TarjetaGoogle key={t.id} seguido={t} acciones={<AccionesSeguido seguido={t} seguimiento={seguimiento} />} />
    }
    return (
      <TarjetaTarea
        key={t.id}
        tarea={t}
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

  const cargandoTodo = cargando || seguidos.cargando
  const nadaPendiente = !cargandoTodo && !error && vencidas.length === 0 && hoyPendientes.length === 0

  return (
    <>
      <h1 className="text-2xl font-bold">Hoy</h1>
      <p className="text-gray-600 capitalize dark:text-gray-400">{formatearDiaLargo(hoy)}</p>

      {cargandoTodo && <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando…</p>}
      {(seguimiento.error || seguidos.errorGoogle) && (
        <p role="status" className="mt-4 text-sm text-amber-800 dark:text-amber-300">
          No se pudieron cargar tus eventos de Google seguidos. Lo demás se ve normal.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {vencidas.length > 0 && (
        <Seccion titulo={`Vencidas (${vencidas.length})`} color="text-red-700 dark:text-red-400">
          {vencidas.map(tarjeta)}
        </Seccion>
      )}

      {hoyPendientes.length > 0 && (
        <Seccion titulo={`Para hoy (${hoyPendientes.length})`}>{hoyPendientes.map(tarjeta)}</Seccion>
      )}

      {nadaPendiente && (
        <p className="mt-6 rounded-xl border border-gray-200 p-4 text-center text-gray-600 dark:border-gray-800 dark:text-gray-400">
          No tienes nada pendiente para hoy. 🎉
        </p>
      )}

      {hechas.length > 0 && <Seccion titulo={`Hechas (${hechas.length})`}>{hechas.map(tarjeta)}</Seccion>}
    </>
  )
}
