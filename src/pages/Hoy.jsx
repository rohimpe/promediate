import { useState } from 'react'
import AccionesChecklist from '../components/AccionesChecklist'
import TarjetaTarea from '../components/TarjetaTarea'
import { useTasks } from '../hooks/useTasks'
import { camposCompletada, camposJustificada, camposPendiente, dividirChecklist } from '../lib/checklist'
import { formatearDiaLargo, hoyEnLima } from '../lib/fechas'

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

  const hoy = hoyEnLima()
  const { vencidas, hoyPendientes, hechas } = dividirChecklist(tareas, hoy, cerradas)

  async function cerrar(tarea, campos) {
    await cambiar(tarea.id, campos)
    setCerradas((s) => new Set(s).add(tarea.id))
  }

  function tarjeta(t) {
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

  const nadaPendiente = !cargando && !error && vencidas.length === 0 && hoyPendientes.length === 0

  return (
    <>
      <h1 className="text-2xl font-bold">Hoy</h1>
      <p className="text-gray-600 capitalize dark:text-gray-400">{formatearDiaLargo(hoy)}</p>

      {cargando && <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando…</p>}
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
